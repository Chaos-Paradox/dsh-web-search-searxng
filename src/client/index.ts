/**
 * The SearXNG search provider's settings page, browser half: the instance
 * endpoint, the engine restriction, and the result language over the
 * `web-search-searxng` namespace the provider registers. The page registers
 * into the Plugins page's `plugins.item` slot while the Host serves that
 * namespace, so a deployment without the provider shows no trace of it.
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ctx.configForms Context merge. Cross-plugin collaboration
// goes through the service, never a value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the Plugins page's SlotMap merge (the 'plugins.item' entry).
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { SearxngSearchCard } from './SearxngSearchCard.tsx'
import { SEARXNG_SEARCH_NS, SearxngSearchCardController } from './searxng-search-card-controller.ts'
import { en, zh, type SearxngSearchSettingsLocaleKey } from './locales.ts'
import { parseServiceStatus } from '../runtime-types.ts'

export type { SearxngSearchCardProps } from './SearxngSearchCard.tsx'
export type { SearxngSearchCardFace, SearxngSearchCardState, SearxngSearchSettings } from './searxng-search-card-controller.ts'
export type { SearxngSearchSettingsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** SearXNG search settings page copy. */
    'settings.webSearchSearxng': SearxngSearchSettingsLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.webSearchSearxng'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'configForms', 'connection']

/**
 * Mount the SearXNG search settings page while the Host serves its namespace.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as ConnectionHandle
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-web-search-searxng: dictionaries')
  const card = new SearxngSearchCardController(ctx.configForms.get(SEARXNG_SEARCH_NS))
  ctx.effect(() => () => { card.dispose() }, 'ui-settings-web-search-searxng: form subscription')
  ctx.effect(() => ctx.configForms.whileServed([SEARXNG_SEARCH_NS], () => ctx.slots.inject('plugins.item', () => ctx.slots.register({
    name: 'plugins.item', id: 'web-search-searxng', order: 41, label: () => t('title'), locale: NS, inject: () => ({
      ...card.inject(),
      async serviceCall(method: 'status' | 'restart' | 'stop' | 'test', signal: AbortSignal) {
        const result = await connection.rpc.call('/api', `searxngRuntime/${method}`, { args: {} }, signal)
        if (!result.ok) throw new Error(result.error.message)
        if (method === 'test') {
          if (!Number.isInteger(result.value) || typeof result.value !== 'number' || result.value < 0) throw new Error('Invalid search test response')
          return result.value
        }
        return parseServiceStatus(result.value)
      },
    }),
  }, SearxngSearchCard))), 'ui-settings-web-search-searxng: page')
}
