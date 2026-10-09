/** Locale bundles for the SearXNG search provider's settings page. */
import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives';
/** Locale keys the page renders. */
export type SearxngSearchSettingsLocaleKey = 'title' | 'description' | 'baseUrl' | 'baseUrlHint' | 'engines' | 'enginesHint' | 'language' | 'languageHint' | 'enginesDefault' | 'enginesSelected' | 'enginesWeb' | 'enginesNews' | 'enginesScience' | 'enginesKnowledge' | 'enginesCustom' | 'enginesCustomNames' | 'enginesCustomHint' | 'enginesCustomSelected' | 'languageDefault' | 'languageAll' | 'languageZhCN' | 'languageZhTW' | 'languageEn' | 'languageJa' | 'languageKo' | 'languageFr' | 'languageDe' | 'languageEs' | 'languageRu' | 'languageCustom' | 'languageCustomCode' | 'overridden' | 'reset' | 'readOnly' | 'unavailable' | 'save' | 'saving' | 'saveFailed' | 'invalidValue' | 'fallbackLabel' | 'fallbackHint' | 'routeHint' | 'resetAll' | 'currentVersion' | 'checkUpdate' | 'checkingUpdate' | 'updateAvailable' | 'updateReleases' | 'updateHowTo' | 'updateLatest' | 'updateFailed';
/** English copy. */
export declare const en: Record<SearxngSearchSettingsLocaleKey, string>;
/** Simplified Chinese copy. */
export declare const zh: Record<SearxngSearchSettingsLocaleKey, string>;
/**
 * The form frame's copy, read from this page's dictionary.
 * @param t - the page's locale reader.
 * @returns the labels the shared settings form renders.
 */
export declare function formLabels(t: (key: SearxngSearchSettingsLocaleKey) => string): SettingsFormLabels;
//# sourceMappingURL=locales.d.ts.map