/**
 * The SearXNG search provider's settings page: its instance endpoint, engine
 * restriction, and result language. Every field belongs to the settings
 * section — the provider carries no credential, so the three text fields share
 * one declaration row each in FIELDS.
 */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SearxngSearchCardFace } from './searxng-search-card-controller.ts';
/** Props the renderer binds for the SearXNG search page. */
export type SearxngSearchCardProps = PropsRuntime<'plugins.item'> & PropsLocale<'settings.webSearchSearxng'> & InjectFace<SearxngSearchCardFace>;
/**
 * Render the SearXNG search provider's one-liner or its settings form, as the Plugins page asks.
 * @param props - the view asked for, locale copy, the form snapshot, and its actions.
 * @returns the one-liner, or the form.
 */
export declare function SearxngSearchCard(props: SearxngSearchCardProps): string | import("react").JSX.Element;
//# sourceMappingURL=SearxngSearchCard.d.ts.map