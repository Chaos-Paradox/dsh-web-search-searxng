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
}

export const Config: z<Config> = z.object({
  baseURL: z.string().volatile(),
  engines: z.string().volatile(),
  language: z.string().volatile(),
})

/**
 * Project the currently resolved fields into the options the provider serves
 * its next search with. Environment fallbacks stay here rather than in the
 * provider: every value it reads is already fully resolved.
 * @param ctx - plugin context supplying the launch environment.
 * @param config - the volatile config fields.
 * @returns options for one search.
 */
function resolveOptions(
  ctx: Context,
  config: { [K in keyof Config]: ReturnType<Config[K]['get']> },
): SearxngSearchProviderOptions {
  return {
    baseURL: config.baseURL ?? launchEnvironmentOf(ctx).get(SEARXNG_BASE_URL_ENV)?.value ?? '',
    ...config.engines !== undefined && config.engines.trim().length > 0 ? { engines: config.engines } : {},
    ...config.language !== undefined && config.language.trim().length > 0 ? { language: config.language } : {},
  }
}

/** Register the SearXNG search provider with `ctx.web`. */
export function apply(ctx: Context, config: Config): void {
  ctx.web.registerSearchProvider(new SearxngSearchProvider(() => resolveOptions(ctx, {
    baseURL: config.baseURL.get(),
    engines: config.engines.get(),
    language: config.language.get(),
  })))
}
