/** Locale bundles for the SearXNG search provider's settings page. */

import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives'

/** Locale keys the page renders. */
export type SearxngSearchSettingsLocaleKey =
  | 'title' | 'description'
  | 'baseUrl' | 'baseUrlHint' | 'engines' | 'enginesHint' | 'language' | 'languageHint'
  | 'overridden' | 'reset' | 'readOnly' | 'unavailable'
  | 'save' | 'saving' | 'saveFailed' | 'invalidValue'
  | 'fallbackLabel' | 'fallbackHint'
  | 'currentVersion' | 'checkUpdate' | 'checkingUpdate'
  | 'updateAvailable' | 'updateReleases' | 'updateHowTo' | 'updateLatest' | 'updateFailed'

/** English copy. */
export const en: Record<SearxngSearchSettingsLocaleKey, string> = {
  title: 'SearXNG search',
  description: 'Set up the self-hosted SearXNG search provider.',
  baseUrl: 'Instance endpoint',
  baseUrlHint: 'Leave blank to use the SEARXNG_BASE_URL environment variable; with neither set, search reports itself unavailable.',
  engines: 'Engines',
  enginesHint: 'Comma-separated engine names, e.g. bing,duckduckgo; leave blank to search every engine the instance enables in its settings.yml.',
  language: 'Result language',
  languageHint: 'For example zh-CN; leave blank for no language restriction (the instance default, usually "all").',
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  invalidValue: 'Enter text, or leave blank to use the default.',
  fallbackLabel: 'Allow official fallback (may incur search fees)',
  fallbackHint: 'Default off: SearXNG failures report a search error. Enable and save to try official DeepSeek search after a failed SearXNG request. Each fallback includes a cost notice; the next request still starts with SearXNG.',
  currentVersion: 'Installed version',
  checkUpdate: 'Check for updates',
  checkingUpdate: 'Checking…',
  updateAvailable: 'New version available:',
  updateReleases: 'Release notes',
  updateHowTo: 'To update: run dsh plugin --profile <name> update dsh-web-search-searxng (or uninstall and reinstall from the Plugins page), then restart.',
  updateLatest: 'You are on the latest version.',
  updateFailed: 'Could not reach the GitHub releases page right now; please try again later.',
}

/** Simplified Chinese copy. */
export const zh: Record<SearxngSearchSettingsLocaleKey, string> = {
  title: 'SearXNG 搜索',
  description: '设置自托管的 SearXNG 搜索提供方。',
  baseUrl: '实例地址',
  baseUrlHint: '留空则使用 SEARXNG_BASE_URL 环境变量；两者都未设置时搜索不可用。',
  engines: '引擎',
  enginesHint: '逗号分隔的引擎名，如 bing,duckduckgo；留空则搜索实例 settings.yml 中启用的全部引擎。',
  language: '结果语言',
  languageHint: '例如 zh-CN；留空则不限语言（使用实例默认，通常为 all）。',
  overridden: '已覆盖',
  reset: '恢复默认',
  readOnly: '本部署的设置为只读。',
  unavailable: '该插件当前未加载，暂时无法配置。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  invalidValue: '请填文本；留空表示使用默认值。',
  fallbackLabel: '允许官方备用（可能产生搜索费用）',
  fallbackHint: '默认关闭：SearXNG 失败时明确报告搜索失败。勾选并保存后，失败的单次请求可改用 DeepSeek 官方搜索，并提示可能产生费用；下一次请求仍优先 SearXNG。',
  currentVersion: '当前版本',
  checkUpdate: '检查更新',
  checkingUpdate: '正在检查…',
  updateAvailable: '发现新版本：',
  updateReleases: '发布说明',
  updateHowTo: '更新方式：运行 dsh plugin --profile <名称> update dsh-web-search-searxng（或在插件页卸载后重装），然后重启。',
  updateLatest: '已是最新版本。',
  updateFailed: '暂时无法访问 GitHub 发布页，请稍后再试。',
}

/**
 * The form frame's copy, read from this page's dictionary.
 * @param t - the page's locale reader.
 * @returns the labels the shared settings form renders.
 */
export function formLabels(t: (key: SearxngSearchSettingsLocaleKey) => string): SettingsFormLabels {
  return { unavailable: t('unavailable'), readOnly: t('readOnly'), saveFailed: t('saveFailed'), save: t('save'), saving: t('saving') }
}
