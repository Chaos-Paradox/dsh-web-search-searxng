/**
 * SearXNG metasearch through the instance's JSON API (`GET {baseURL}/search?format=json`).
 * SearXNG is self-hosted, so the endpoint is deployment configuration — never a
 * model-chosen value — and may legitimately be a loopback or private-network
 * address. The provider carries no credentials; redirects fail as
 * `WEB_PROVIDER_ERROR` so a redirect never forwards the query text to another
 * origin.
 * @module dsh-web-search-searxng/provider
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'
import type { SearxngResult, SearxngSearchResponse } from './types.ts'

/** Stable id this provider registers under. */
export const SEARXNG_PROVIDER_ID = 'searxng'

/** Attribution header sent on every request. Bump with the package version. */
const USER_AGENT = 'dsh-web-search-searxng/0.1.0'

/** Resolved provider options (the plugin's `apply` supplies env-var defaults). */
export interface SearxngSearchProviderOptions {
  /** SearXNG instance base; `/search` is appended. Empty makes the provider unavailable. */
  baseURL: string
  /** Comma-separated engine restriction sent as SearXNG's `engines` parameter. */
  engines?: string
  /** Preferred result language sent as SearXNG's `language` parameter. */
  language?: string
}

/**
 * Map one SearXNG result to a normalized source, or `undefined` when the entry
 * carries no usable URL. Engines disagree on which fields they return, so
 * `title`, `content` (as `snippet`), and `publishedDate` (as `publishedAt`)
 * attach only when present and non-blank; a URL-only source stays valid because
 * the seam's citation shape permits it.
 *
 * @param entry - one entry of SearXNG's `results[]`.
 * @returns the normalized source, or `undefined` for an entry without a usable URL.
 */
export function mapSearxngResult(entry: SearxngResult): WebSearchSource | undefined {
  if (typeof entry.url !== 'string' || entry.url.trim().length === 0) return undefined
  return {
    url: entry.url,
    ...typeof entry.title === 'string' && entry.title.length > 0 ? { title: entry.title } : {},
    ...typeof entry.content === 'string' && entry.content.trim().length > 0 ? { snippet: entry.content } : {},
    ...typeof entry.publishedDate === 'string' && entry.publishedDate.length > 0 ? { publishedAt: entry.publishedDate } : {},
  }
}

/**
 * Map a SearXNG response envelope to a normalized search result. SearXNG
 * returns no generated answer the seam could vouch for, so `content` is
 * omitted. The web service owns the final `maxResults` truncation, so
 * `truncated` is always `false` here.
 *
 * @param response - the parsed search response body.
 * @returns the normalized result with URL-less entries dropped.
 * @throws {@link WebError} when a present `results` field is not an array.
 */
export function mapSearxngResponse(response: SearxngSearchResponse): WebSearchResult {
  if (response.results !== undefined && !Array.isArray(response.results)) {
    throw new WebError('SearXNG returned a malformed results field', 'WEB_PROVIDER_ERROR')
  }
  const sources = (response.results ?? [])
    .map(mapSearxngResult)
    .filter((source): source is WebSearchSource => source !== undefined)
  return { sources, truncated: false }
}

/**
 * The SearXNG-backed search provider. HTTP redirects fail as `WEB_PROVIDER_ERROR`;
 * a 403 carries the JSON-format hint because instances commonly disable it.
 */
export class SearxngSearchProvider implements WebSearchProvider {
  readonly id = SEARXNG_PROVIDER_ID

  /**
   * @param resolveOptions - the options for the NEXT operation, snapshotted
   * once at each operation's entry so one search never mixes two sections. A
   * thunk rather than a value because the plugin's settings section can change
   * between searches, and re-registering the provider to carry a new endpoint
   * would make the seam's selection observable to the user as a flicker.
   */
  constructor(private readonly resolveOptions: () => SearxngSearchProviderOptions) {}

  available(): boolean {
    const options = this.resolveOptions()
    return options.baseURL.length > 0 && URL.canParse(options.baseURL)
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    // One snapshot for the whole operation: a settings write landing mid-search
    // must not split the endpoint from the engine and language preferences.
    const options = this.resolveOptions()
    const url = searchUrl(options.baseURL)
    url.searchParams.set('q', request.query)
    url.searchParams.set('format', 'json')
    if (options.engines !== undefined && options.engines.trim().length > 0) {
      url.searchParams.set('engines', options.engines)
    }
    if (options.language !== undefined && options.language.trim().length > 0) {
      url.searchParams.set('language', options.language)
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        headers: {
          'accept': 'application/json',
          'user-agent': USER_AGENT,
        },
        ...signal !== undefined ? { signal } : {},
      })
    } catch (error: unknown) {
      if (signal?.aborted === true || isAbortError(error)) {
        throw new WebError('SearXNG search aborted', 'WEB_ABORTED', { cause: error })
      }
      throw new WebError(`SearXNG search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }

    if (!response.ok) {
      let message = `SearXNG error (HTTP ${response.status})`
      if (response.status === 403) {
        // The common cause: the instance's settings.yml does not list json under
        // search.formats, which is SearXNG's default for non-HTML output.
        message += '; the instance may refuse JSON output — enable the "json" format in its search.formats setting'
      }
      throw new WebError(message, 'WEB_PROVIDER_ERROR')
    }

    try {
      const payload = await response.json() as SearxngSearchResponse
      return mapSearxngResponse(payload)
    } catch (error: unknown) {
      if (signal?.aborted === true || isAbortError(error)) {
        throw new WebError('SearXNG search aborted', 'WEB_ABORTED', { cause: error })
      }
      const message = error instanceof WebError
        ? error.message
        : `SearXNG returned an unprocessable response body: ${String(error)}`
      throw new WebError(message, 'WEB_PROVIDER_ERROR', { cause: error })
    }
  }
}

/**
 * Resolve the search endpoint under the configured base, preserving a subpath
 * mount (`http://host/searxng` → `http://host/searxng/search`).
 *
 * @param baseURL - the configured instance base; `available()` guarantees it parses.
 * @returns the absolute search URL without query parameters.
 */
function searchUrl(baseURL: string): URL {
  return new URL('search', baseURL.endsWith('/') ? baseURL : `${baseURL}/`)
}

/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
