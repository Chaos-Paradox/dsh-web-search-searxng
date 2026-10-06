import z from "@deepseek-ai/schemastery";
import { WebSearchProvider, WebSearchRequest, WebSearchResult, WebSearchSource } from "@deepseek-ai/dsh-web";
import { Context, Volatile } from "@deepseek-ai/cordis";
//#region src/types.d.ts
/**
 * Wire types for the SearXNG metasearch API (`GET {baseURL}/search?format=json`).
 * Types only — no runtime code. SearXNG returns a flat `results[]` aggregated
 * from its configured engines; each entry carries a URL, an optional title, an
 * optional `content` excerpt, and an optional `publishedDate`. Entry fields
 * vary by engine, so the provider validates entries at the wire boundary.
 *
 * @module dsh-web-search-searxng/types
 */
/** One entry of SearXNG's flat `results[]`. */
interface SearxngResult {
  url: string;
  title?: string;
  /** Engine-supplied excerpt; the portable snippet source. */
  content?: string;
  publishedDate?: string;
}
/** SearXNG's search response envelope. */
interface SearxngSearchResponse {
  results?: SearxngResult[];
}
//#endregion
//#region src/provider.d.ts
/** Stable id this provider registers under. */
declare const SEARXNG_PROVIDER_ID = "searxng";
/** Resolved provider options (the plugin's `apply` supplies env-var defaults). */
interface SearxngSearchProviderOptions {
  /** SearXNG instance base; `/search` is appended. Empty makes the provider unavailable. */
  baseURL: string;
  /** Comma-separated engine restriction sent as SearXNG's `engines` parameter. */
  engines?: string;
  /** Preferred result language sent as SearXNG's `language` parameter. */
  language?: string;
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
declare function mapSearxngResult(entry: SearxngResult): WebSearchSource | undefined;
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
declare function mapSearxngResponse(response: SearxngSearchResponse): WebSearchResult;
/**
 * The SearXNG-backed search provider. HTTP redirects fail as `WEB_PROVIDER_ERROR`;
 * a 403 carries the JSON-format hint because instances commonly disable it.
 */
declare class SearxngSearchProvider implements WebSearchProvider {
  private readonly resolveOptions;
  readonly id = "searxng";
  /**
   * @param resolveOptions - the options for the NEXT operation, snapshotted
   * once at each operation's entry so one search never mixes two sections. A
   * thunk rather than a value because the plugin's settings section can change
   * between searches, and re-registering the provider to carry a new endpoint
   * would make the seam's selection observable to the user as a flicker.
   */
  constructor(resolveOptions: () => SearxngSearchProviderOptions);
  available(): boolean;
  search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
//#endregion
//#region src/index.d.ts
/** Cordis plugin name used by loader diagnostics. */
declare const name = "web-search-searxng";
/** The web seam this provider registers into. */
declare const inject: string[];
/** Plugin config (all optional and volatile — settings writes apply to the next search). */
interface Config {
  /** SearXNG instance base; `/search` is appended. Falls back to `$SEARXNG_BASE_URL`. Empty → provider unavailable. */
  baseURL: Volatile<string | undefined>;
  /** Comma-separated engine restriction sent as SearXNG's `engines` parameter (for example `bing,duckduckgo`). */
  engines: Volatile<string | undefined>;
  /** Preferred result language sent as SearXNG's `language` parameter (for example `zh-CN`). */
  language: Volatile<string | undefined>;
}
declare const Config: z<Config>;
/** Register the SearXNG search provider with `ctx.web`. */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, SEARXNG_PROVIDER_ID, type SearxngResult, SearxngSearchProvider, type SearxngSearchProviderOptions, type SearxngSearchResponse, apply, inject, mapSearxngResponse, mapSearxngResult, name };