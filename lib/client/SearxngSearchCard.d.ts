/** SearXNG settings and the staged opt-in official fallback checkbox. */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SearxngSearchCardFace } from './searxng-search-card-controller.ts';
/** Props the renderer binds for the SearXNG search page. */
export type SearxngSearchCardProps = PropsRuntime<'plugins.item'> & PropsLocale<'settings.webSearchSearxng'> & InjectFace<SearxngSearchCardFace>;
/**
 * Render the SearXNG search provider's one-liner or its settings form, as the Plugins page asks.
 * The fallback checkbox is staged with the other fields and takes effect on save.
 * Update checks run only on click.
 * @param props - the view asked for, locale copy, the form snapshot, and its actions.
 * @returns the one-liner, or the form.
 */
export declare function SearxngSearchCard(props: SearxngSearchCardProps): string | import("react").JSX.Element;
//# sourceMappingURL=SearxngSearchCard.d.ts.map