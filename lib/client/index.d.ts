/**
 * The SearXNG search provider's settings page, browser half: the instance
 * endpoint, the engine restriction, and the result language over the
 * `web-search-searxng` namespace the provider registers. The page registers
 * into the Plugins page's `plugins.item` slot while the Host serves that
 * namespace, so a deployment without the provider shows no trace of it.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type SearxngSearchSettingsLocaleKey } from './locales.ts';
export type { SearxngSearchCardProps } from './SearxngSearchCard.tsx';
export type { SearxngSearchCardFace, SearxngSearchCardState, SearxngSearchSettings } from './searxng-search-card-controller.ts';
export type { SearxngSearchSettingsLocaleKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** SearXNG search settings page copy. */
        'settings.webSearchSearxng': SearxngSearchSettingsLocaleKey;
    }
}
/** Dictionary namespace owned by this plugin. */
export declare const NS = "settings.webSearchSearxng";
/** Required services (cordis fiber inject). */
export declare const inject: string[];
/**
 * Mount the SearXNG search settings page while the Host serves its namespace.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map