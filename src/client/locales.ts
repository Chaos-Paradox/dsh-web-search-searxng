/** Locale bundles for the SearXNG search provider's settings page. */

import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives'

/** Locale keys the page renders. */
export type SearxngSearchSettingsLocaleKey =
  | 'title' | 'description'
  | 'baseUrl' | 'baseUrlHint' | 'engines' | 'enginesHint' | 'language' | 'languageHint'
  | 'overridden' | 'reset' | 'readOnly' | 'unavailable'
  | 'save' | 'saving' | 'saveFailed' | 'invalidValue'

/** English copy. */
export const en: Record<SearxngSearchSettingsLocaleKey, string> = {
  title: 'SearXNG search',
  description: 'Set up the self-hosted SearXNG search provider.',
  baseUrl: 'Instance endpoint',
  baseUrlHint: 'Leave blank to use the SEARXNG_BASE_URL environment variable.',
  engines: 'Engines',
  enginesHint: 'Comma-separated engine names; leave blank for the instance default.',
  language: 'Result language',
  languageHint: 'For example zh-CN; leave blank for the instance default.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  invalidValue: 'Enter text, or leave blank to use the default.',
}

/** Simplified Chinese copy. */
export const zh: Record<SearxngSearchSettingsLocaleKey, string> = {
  title: 'SearXNG 搜索',
  description: '设置自托管的 SearXNG 搜索提供方。',
  baseUrl: '实例地址',
  baseUrlHint: '留空则使用 SEARXNG_BASE_URL 环境变量。',
  engines: '引擎',
  enginesHint: '逗号分隔的引擎名；留空则使用实例默认配置。',
  language: '结果语言',
  languageHint: '例如 zh-CN；留空则使用实例默认。',
  overridden: '已覆盖',
  reset: '恢复默认',
  readOnly: '本部署的设置为只读。',
  unavailable: '该插件当前未加载，暂时无法配置。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  invalidValue: '请填文本；留空表示使用默认值。',
}

/**
 * The form frame's copy, read from this page's dictionary.
 * @param t - the page's locale reader.
 * @returns the labels the shared settings form renders.
 */
export function formLabels(t: (key: SearxngSearchSettingsLocaleKey) => string): SettingsFormLabels {
  return { unavailable: t('unavailable'), readOnly: t('readOnly'), saveFailed: t('saveFailed'), save: t('save'), saving: t('saving') }
}
