/**
 * Opt-in official-route fallback. The default posture is strict: a failed
 * SearXNG search fails loudly and the official route is never called, so an
 * unnoticed failure cannot silently start billing the deployment. When the
 * deployment explicitly enables `allowOfficialFallback`, one failed request
 * degrades to the built-in DeepSeek provider for THAT REQUEST ONLY — the
 * route itself never changes — and the result carries a bilingual notice so
 * the model (and the user reading the tool output) sees that the fallback
 * fired, why, and that extra cost may apply. Every degradation is recorded
 * through the host logger with the actual provider and the failure reason.
 * @module dsh-web-search-searxng/fallback
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
} from '@deepseek-ai/dsh-web'
import type { Context } from '@deepseek-ai/cordis'
import { SEARXNG_PROVIDER_ID } from './provider.ts'

/** One recorded degradation from SearXNG to the official route. */
export interface FallbackRecord {
  /** The primary failure's message (query text deliberately excluded). */
  readonly reason: string
  /** ISO-8601 time the degraded result was served. */
  readonly at: string
  /** Sources the official route returned for the degraded request. */
  readonly sources: number
}

/** Collaborators the fallback wrapper reads per request. */
export interface OfficialFallback {
  /** Whether the deployment currently allows degradation (volatile field). */
  readonly enabled: () => boolean
  /** Resolve the official provider, or undefined when unavailable here. */
  readonly official: () => Promise<WebSearchProvider | undefined>
  /** Record the paid attempt before dispatch, including attempts which fail. */
  readonly onAttempt: (reason: string) => void
  /** Record one served degradation (host log owns the sink). */
  readonly onDegraded: (record: FallbackRecord) => void
}

/** Upper bound for the failure reason embedded in the model-visible notice. */
const REASON_MAX_CHARS = 200

function aborted(signal: AbortSignal | undefined): boolean { return signal?.aborted === true }

/**
 * Build the model-visible notice prepended to a degraded result's `content`.
 * Bilingual on purpose: the notice feeds the model's tool result, and the
 * model relays it to a user whose UI language this package cannot know.
 * @param reason - the primary failure's message, truncated.
 * @returns the notice text.
 */
export function fallbackNotice(reason: string): string {
  const trimmed = reason.length > REASON_MAX_CHARS ? `${reason.slice(0, REASON_MAX_CHARS)}…` : reason
  return `⚠️ SearXNG search failed (${trimmed}); this request fell back to the official DeepSeek search — extra cost may apply, and the route itself was NOT changed.\n`
    + `⚠️ SearXNG 搜索失败（${trimmed}），本次请求已降级到 DeepSeek 官方搜索——可能产生额外费用；路由本身未被更改。`
}

/**
 * The SearXNG provider with an opt-in per-request escape hatch. Registered
 * under the SearXNG id: it IS the SearXNG route — the fallback never changes
 * selection, it only answers one failed request through the official route
 * when the deployment explicitly allowed it. Availability stays the primary's:
 * an unconfigured endpoint means "search unavailable", never "silently serve
 * everything from the official route".
 */
export class SearxngFallbackProvider implements WebSearchProvider {
  readonly id = SEARXNG_PROVIDER_ID

  /**
   * @param primary - the SearXNG provider every request tries first.
   * @param fallback - the per-request collaborators.
   */
  constructor(
    private readonly primary: WebSearchProvider,
    private readonly fallback: OfficialFallback,
  ) {}

  available(): boolean {
    return this.primary.available()
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    try {
      return await this.primary.search(request, signal)
    } catch (error: unknown) {
      // A cancelled request never degrades: the caller asked for a stop, not
      // for a second, slower search on a paid route.
      if (aborted(signal) || (error instanceof WebError && error.code === 'WEB_ABORTED')) throw error
      if (!this.fallback.enabled()) throw error
      const official = await this.fallback.official()
      if (official === undefined || !official.available()) throw error
      const reason = error instanceof Error ? error.message : String(error)
      // Recheck after asynchronous resolution: cancellation or disabling must stop dispatch.
      if (aborted(signal) || !this.fallback.enabled()) throw error
      this.fallback.onAttempt(reason)
      let result: WebSearchResult
      try {
        result = await official.search(request, signal)
      } catch (fallbackError) {
        if (aborted(signal) || (fallbackError instanceof WebError && fallbackError.code === 'WEB_ABORTED')) throw fallbackError
        const detail = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        throw new WebError(`SearXNG search failed (${reason}); official fallback also failed (${detail}); the official attempt may incur search fees`, 'WEB_PROVIDER_ERROR', { cause: fallbackError })
      }
      this.fallback.onDegraded({ reason, at: new Date().toISOString(), sources: result.sources.length })
      return {
        ...result,
        content: `${fallbackNotice(reason)}\n\n${result.content ?? ''}`.trimEnd(),
      }
    }
  }
}

/** Public host operation required to reuse registered official search configuration. */
interface ExplicitSearchRuntime {
  searchWithProvider(id: string, request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>
}

/** Resolve an adapter to the host's registered official provider, never a new credentialed instance.
 * Disabled, missing, or unavailable providers fail through the host's normal selection errors.
 * @param ctx Plugin context supplying the web service.
 * @returns Resolver for one official request without changing the default route.
 */
export function createOfficialFallbackResolver(ctx: Context): () => Promise<WebSearchProvider | undefined> {
  return async () => {
    const web = ctx.web as typeof ctx.web & Partial<ExplicitSearchRuntime>
    if (typeof web.searchWithProvider !== 'function') {
      throw new WebError('Official fallback requires DSH host integration: web.searchWithProvider is unavailable', 'WEB_PROVIDER_CONFIGURED_MISSING')
    }
    const search = web.searchWithProvider.bind(web)
    return {
      id: 'deepseek-official',
      available: () => true,
      search: (request, signal) => search('deepseek-official', request, signal),
    }
  }
}
