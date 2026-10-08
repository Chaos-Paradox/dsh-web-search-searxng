/**
 * Register a SearXNG-backed provider in `ctx.web`. It calls the instance's JSON
 * search API (`GET {baseURL}/search?format=json`). The provider needs no API key;
 * the instance base URL comes from the (volatile) config section or
 * `$SEARXNG_BASE_URL`, and may be a loopback or private-network address because
 * the deployment — not the model — chooses it.
 * @module dsh-web-search-searxng
 */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type {} from '@deepseek-ai/dsh-web'
import { createOfficialFallbackResolver, SearxngFallbackProvider } from './fallback.ts'
import { SearxngSearchProvider } from './provider.ts'
import type { SearxngSearchProviderOptions } from './provider.ts'


export {
  mapSearxngResponse,
  mapSearxngResult,
  SEARXNG_PROVIDER_ID,
  SearxngSearchProvider,
} from './provider.ts'
export type { SearxngSearchProviderOptions } from './provider.ts'
export type { SearxngResult, SearxngSearchResponse } from './types.ts'
export {
  createOfficialFallbackResolver,
  fallbackNotice,
  SearxngFallbackProvider,
} from './fallback.ts'
export type { FallbackRecord, OfficialFallback } from './fallback.ts'

/**
 * The Loader emits this on the owning fiber after committing a volatile
 * write. Declared here with its verbatim signature because this package does
 * not depend on the Loader package; interface merging keeps it compatible
 * with the host's own augmentation.
 */
declare module '@deepseek-ai/cordis' {
  interface Events {
    'loader/volatile-update'(paths: readonly (readonly string[])[]): void
  }
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-searxng'

/** The web seam this provider registers into. */
export const inject = ['web']

/**
 * Environment variable naming the instance base URL. The deployment owns this
 * endpoint: the provider sends model-chosen query text to it, so it must never
 * come from model-visible input.
 */
const SEARXNG_BASE_URL_ENV = 'SEARXNG_BASE_URL'

/** Plugin config (all optional and volatile — settings writes apply to the next search). */
export interface Config {
  /** SearXNG instance base; `/search` is appended. Falls back to `$SEARXNG_BASE_URL`. Empty → provider unavailable. */
  baseURL: Volatile<string | undefined>
  /** Comma-separated engine restriction sent as SearXNG's `engines` parameter (for example `bing,duckduckgo`). */
  engines: Volatile<string | undefined>
  /** Preferred result language sent as SearXNG's `language` parameter (for example `zh-CN`). */
  language: Volatile<string | undefined>
  /**
   * Per-request official-route escape hatch. Absent or `false` (the default):
   * a failed SearXNG search fails loudly and the official route is never
   * called, so an unnoticed failure cannot silently bill the deployment.
   * `true`: one failed request degrades to the built-in DeepSeek provider for
   * that request only, the result carries a bilingual cost notice, and every
   * degradation hits the host log. The route itself never changes.
   */
  allowOfficialFallback: Volatile<boolean | undefined>
}

// Annotated with the global schemastery interface rather than left inferred:
// the declaration emitter cannot name the inferred schema type portably, and
// a `z<Config>` annotation misstates the volatile field types.
export const Config: Schemastery = z.object({
  baseURL: z.string().volatile(),
  engines: z.string().volatile(),
  language: z.string().volatile(),
  allowOfficialFallback: z.boolean().volatile(),
})

/**
 * Project the currently resolved fields into the options the provider serves
 * its next search with. Environment fallbacks stay here rather than in the
 * provider: every value it reads is already fully resolved.
 * @param ctx - plugin context supplying the launch environment.
 * @param config - the volatile config fields the provider consumes.
 * @returns options for one search.
 */
function resolveOptions(
  ctx: Context,
  config: { [K in 'baseURL' | 'engines' | 'language']: ReturnType<Config[K]['get']> },
): SearxngSearchProviderOptions {
  return {
    baseURL: config.baseURL ?? launchEnvironmentOf(ctx).get(SEARXNG_BASE_URL_ENV)?.value ?? '',
    ...config.engines !== undefined && config.engines.trim().length > 0 ? { engines: config.engines } : {},
    ...config.language !== undefined && config.language.trim().length > 0 ? { language: config.language } : {},
  }
}

/** Register SearXNG with opt-in fallback and warn about a missing endpoint. */
export function apply(ctx: Context, config: Config): void {
  const editor = ctx.get('configEditor') as {
    supportsBundleConfigEffects: boolean
    configuration(): { entry: { options: { id: string; config?: { searchProvider?: string } } } }[]
  } | undefined
  if (editor?.supportsBundleConfigEffects !== true) {
    throw new Error('web-search-searxng requires DSH bundle config-effects integration for default routing and uninstall restoration; apply host-integration/dsh-config-effects.patch before enabling this bundle')
  }
  const route = editor.configuration().find(row => row.entry.options.id === 'web')?.entry.options.config?.searchProvider
  if (route !== 'searxng') {
    throw new Error(`web-search-searxng expected the installed SearXNG route, but web.searchProvider is ${String(route)}; remove conflicting home/CLI overrides, or re-apply the bundle route by disabling and re-enabling the bundle (dsh plugin disable/enable or remove/add)`)
  }
  const provider = new SearxngSearchProvider(() => resolveOptions(ctx, {
    baseURL: config.baseURL.get(),
    engines: config.engines.get(),
    language: config.language.get(),
  }))
  const routed = new SearxngFallbackProvider(provider, {
    enabled: () => config.allowOfficialFallback.get() === true,
    official: createOfficialFallbackResolver(ctx),
    onAttempt: reason => ctx.logger.warn('web-search-searxng: SearXNG search failed (%s); trying the user-enabled official fallback; search fees may apply', reason),
    onDegraded: record => ctx.logger.warn(
      'web-search-searxng: SearXNG search failed (%s); served this one request through deepseek-official '
      + '(%d sources) — extra cost may apply, and the route itself was not changed',
      record.reason,
      record.sources,
    ),
  })
  ctx.web.registerSearchProvider(routed)

  let warnedMissingEndpoint = false
  const checkEndpoint = (): void => {
    if (!provider.available()) {
      if (warnedMissingEndpoint) return
      warnedMissingEndpoint = true
      ctx.logger.warn(
        'web-search-searxng: search is routed to SearXNG, but no instance endpoint is configured, '
        + 'so every search will fail with the provider unavailable. Set the endpoint on the plugin '
        + 'card or export SEARXNG_BASE_URL, then save the settings.',
      )
      return
    }
    warnedMissingEndpoint = false
  }
  checkEndpoint()
  ctx.on('loader/volatile-update', checkEndpoint)
}
