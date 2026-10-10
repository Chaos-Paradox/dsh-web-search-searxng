import { WebSearchProvider, WebSearchRequest, WebSearchResult, WebSearchSource } from "@deepseek-ai/dsh-web";
import { Context, Volatile } from "@deepseek-ai/cordis";
//#region src/runtime-types.d.ts
/** JSON values shared by the Host manager and browser card. */
type ServiceMode = 'auto' | 'local' | 'external';
//#endregion
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
//#region src/fallback.d.ts
/** One recorded degradation from SearXNG to the official route. */
interface FallbackRecord {
  /** The primary failure's message (query text deliberately excluded). */
  readonly reason: string;
  /** ISO-8601 time the degraded result was served. */
  readonly at: string;
  /** Sources the official route returned for the degraded request. */
  readonly sources: number;
}
/** Collaborators the fallback wrapper reads per request. */
interface OfficialFallback {
  /** Whether the deployment currently allows degradation (volatile field). */
  readonly enabled: () => boolean;
  /** Resolve the official provider, return undefined when unavailable, or reject for missing host capability. */
  readonly official: () => Promise<WebSearchProvider | undefined>;
  /** Record the paid attempt before dispatch, including attempts which fail. */
  readonly onAttempt: (reason: string) => void;
  /** Record one served degradation (host log owns the sink). */
  readonly onDegraded: (record: FallbackRecord) => void;
}
/**
 * Build the model-visible notice prepended to a degraded result's `content`.
 * Bilingual on purpose: the notice feeds the model's tool result, and the
 * model relays it to a user whose UI language this package cannot know.
 * @param reason - the primary failure's message, truncated.
 * @returns the notice text.
 */
declare function fallbackNotice(reason: string): string;
/**
 * The SearXNG provider with an opt-in per-request escape hatch. Registered
 * under the SearXNG id: it IS the SearXNG route — the fallback never changes
 * selection, it only answers one failed request through the official route
 * when the deployment explicitly allowed it. Availability stays the primary's:
 * an unconfigured endpoint means "search unavailable", never "silently serve
 * everything from the official route".
 */
declare class SearxngFallbackProvider implements WebSearchProvider {
  private readonly primary;
  private readonly fallback;
  readonly id = "searxng";
  /**
   * @param primary - the SearXNG provider every request tries first.
   * @param fallback - the per-request collaborators.
   */
  constructor(primary: WebSearchProvider, fallback: OfficialFallback);
  available(): boolean;
  search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
/** Public host operation required to reuse registered official search configuration. */
interface ExplicitSearchRuntime {
  searchWithProvider(id: string, request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
/** Detect the public API needed for fallback without accessing provider registries.
 * @param web Host web service.
 * @returns Whether explicit provider dispatch is available.
 */
declare function supportsOfficialFallback(web: object): web is ExplicitSearchRuntime;
/** Resolve an adapter to the host's registered official provider, never a new credentialed instance.
 * Disabled, missing, or unavailable providers fail through the host's normal selection errors.
 * @param ctx Plugin context supplying the web service.
 * @returns Resolver for one official request without changing the default route.
 */
declare function createOfficialFallbackResolver(ctx: Context): () => Promise<WebSearchProvider | undefined>;
//#endregion
//#region src/index.d.ts
/**
 * The Loader emits this on the owning fiber after committing a volatile
 * write. Declared here with its verbatim signature because this package does
 * not depend on the Loader package; interface merging keeps it compatible
 * with the host's own augmentation.
 */
declare module '@deepseek-ai/cordis' {
  interface Events {
    'loader/volatile-update'(paths: readonly (readonly string[])[]): void;
  }
}
/** Cordis plugin name used by loader diagnostics. */
declare const name = "web-search-searxng";
/** The web seam this provider registers into. */
declare const inject: string[];
/** Plugin config (all optional and volatile — settings writes apply to the next search). */
interface Config {
  /** Auto preserves existing URLs; otherwise prepares a local service. */
  mode: Volatile<ServiceMode | undefined>;
  /** Zero lets the OS atomically allocate a free loopback port. */
  managedPort: Volatile<number>;
  setupTimeoutMs: Volatile<number>;
  startupTimeoutMs: Volatile<number>;
  restartLimit: Volatile<number>;
  /** SearXNG instance base; `/search` is appended. Falls back to `$SEARXNG_BASE_URL`. Empty → provider unavailable. */
  baseURL: Volatile<string | undefined>;
  /** Comma-separated engine restriction sent as SearXNG's `engines` parameter (for example `bing,duckduckgo`). */
  engines: Volatile<string | undefined>;
  /** Preferred result language sent as SearXNG's `language` parameter (for example `zh-CN`). */
  language: Volatile<string | undefined>;
  /**
   * Per-request official-route escape hatch. Absent or `false` (the default):
   * a failed SearXNG search fails loudly and the official route is never
   * called, so an unnoticed failure cannot silently bill the deployment.
   * `true`, on a host exposing `web.searchWithProvider`: one failed request degrades to the built-in DeepSeek provider for
   * that request only, the result carries a bilingual cost notice, and every
   * degradation hits the host log. The route itself never changes. On hosts
   * without that public API, a failed search reports the capability limitation
   * alongside the SearXNG failure and makes no official request.
   */
  allowOfficialFallback: Volatile<boolean | undefined>;
}
declare const Config: Schemastery;
/** Register SearXNG with opt-in fallback and warn about a missing endpoint. */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, type FallbackRecord, type OfficialFallback, SEARXNG_PROVIDER_ID, SearxngFallbackProvider, type SearxngResult, SearxngSearchProvider, type SearxngSearchProviderOptions, type SearxngSearchResponse, apply, createOfficialFallbackResolver, fallbackNotice, inject, mapSearxngResponse, mapSearxngResult, name, supportsOfficialFallback };