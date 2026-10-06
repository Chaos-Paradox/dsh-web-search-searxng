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
export interface SearxngResult {
  url: string
  title?: string
  /** Engine-supplied excerpt; the portable snippet source. */
  content?: string
  publishedDate?: string
}

/** SearXNG's search response envelope. */
export interface SearxngSearchResponse {
  results?: SearxngResult[]
}
