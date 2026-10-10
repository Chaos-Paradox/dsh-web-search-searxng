/** Locale bundles for the SearXNG search provider's settings page. */

import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives'

/** Locale keys the page renders. */
export type SearxngSearchSettingsLocaleKey =
  | 'title' | 'description'
  | 'modeLabel' | 'modeAuto' | 'modeLocal' | 'modeExternal' | 'modeHint' | 'advanced' | 'managedPort' | 'managedPortHint'
  | 'serviceTitle' | 'serviceIdle' | 'servicePreparing' | 'serviceStarting' | 'serviceReady' | 'serviceStopped' | 'serviceFailed' | 'serviceExternal'
  | 'activeEndpoint' | 'serviceHint' | 'serviceRestart' | 'serviceStop' | 'serviceTest' | 'serviceTestResult' | 'serviceLogs'
  | 'setupUv' | 'setupSource' | 'setupPython' | 'setupDependencies'
  | 'baseUrl' | 'baseUrlHint' | 'engines' | 'enginesHint' | 'language' | 'languageHint'
  | 'enginesDefault' | 'enginesSelected' | 'enginesWeb' | 'enginesNews' | 'enginesScience' | 'enginesKnowledge'
  | 'enginesCustom' | 'enginesCustomNames' | 'enginesCustomHint' | 'enginesCustomSelected'
  | 'languageDefault' | 'languageAll' | 'languageZhCN' | 'languageZhTW' | 'languageEn' | 'languageJa' | 'languageKo'
  | 'languageFr' | 'languageDe' | 'languageEs' | 'languageRu' | 'languageCustom' | 'languageCustomCode'
  | 'overridden' | 'reset' | 'readOnly' | 'unavailable'
  | 'save' | 'saving' | 'saveFailed' | 'invalidValue'
  | 'fallbackLabel' | 'fallbackHint'
  | 'routeHint' | 'resetAll'
  | 'currentVersion' | 'checkUpdate' | 'checkingUpdate'
  | 'updateAvailable' | 'updateReleases' | 'updateHowTo' | 'updateLatest' | 'updateFailed'

/** English copy. */
export const en: Record<SearxngSearchSettingsLocaleKey, string> = {
  title: 'SearXNG search',
  description: 'Set up the self-hosted SearXNG search provider.',
  modeLabel: 'Service mode', modeAuto: 'Automatic', modeLocal: 'Managed local service', modeExternal: 'Existing instance',
  modeHint: 'Automatic uses your existing endpoint/environment setting when present; otherwise it prepares a local service. Local mode requires no Docker or system Python. Save to apply.',
  advanced: 'Advanced settings', managedPort: 'Local port', managedPortHint: '0 automatically selects an available port. A specific occupied port reports an error. Saving a change restarts the local service.',
  serviceTitle: 'Search service', serviceIdle: 'Waiting', servicePreparing: 'Preparing first-use runtime', serviceStarting: 'Starting',
  serviceReady: 'Ready', serviceStopped: 'Stopped', serviceFailed: 'Failed', serviceExternal: 'Using existing instance',
  activeEndpoint: 'Active endpoint', serviceHint: 'Local setup downloads pinned dependencies on first use. The local service follows DSH and stops when the plugin is disabled or DSH exits. Existing instances remain independently managed.',
  serviceRestart: 'Start / retry / restart', serviceStop: 'Stop', serviceTest: 'Test search', serviceTestResult: 'Search succeeded; sources returned', serviceLogs: 'Diagnostic log',
  setupUv: 'Downloading setup tool', setupSource: 'Downloading SearXNG', setupPython: 'Preparing Python', setupDependencies: 'Installing dependencies',
  baseUrl: 'Instance endpoint',
  baseUrlHint: 'Existing-instance mode uses this address, or SEARXNG_BASE_URL when blank. Automatic mode prepares a local service when neither is set.',
  engines: 'Engines',
  enginesHint: 'Choose multiple engines. These are common candidates, not a live list from your instance; names must exist and be enabled in your SearXNG configuration.',
  enginesDefault: 'No restriction: use the instance’s default engines.',
  enginesSelected: 'Search only the selected engines.',
  enginesWeb: 'Web · websites and general information',
  enginesNews: 'News · reporting and current events',
  enginesScience: 'Research · papers and preprints',
  enginesKnowledge: 'Technology and reference · repositories, Q&A and encyclopedias',
  enginesCustom: 'Other engines (custom names)',
  enginesCustomNames: 'Custom engine names',
  enginesCustomHint: 'Use the exact names from your instance, separated by commas. List selections are preserved.',
  enginesCustomSelected: 'Also selected',
  language: 'Result language',
  languageHint: 'Choose a preferred result language; instance default inherits your deployment configuration. Other languages can use a custom code.',
  languageDefault: 'Instance default',
  languageAll: 'All languages',
  languageZhCN: 'Simplified Chinese (zh-CN)',
  languageZhTW: 'Traditional Chinese (zh-TW)',
  languageEn: 'English (en)',
  languageJa: 'Japanese (ja)',
  languageKo: 'Korean (ko)',
  languageFr: 'French (fr)',
  languageDe: 'German (de)',
  languageEs: 'Spanish (es)',
  languageRu: 'Russian (ru)',
  languageCustom: 'Other language (custom code)',
  languageCustomCode: 'Custom language code',
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  invalidValue: 'Enter text, or leave blank to use the default.',
  fallbackLabel: 'Allow official fallback (may incur search fees)',
  fallbackHint: 'Default off. DSH 0.2.1-alpha.2 has no official fallback API: enabling this option cannot start an official search, and failures report that limitation. A host with public searchWithProvider support can reuse its registered official provider after a failure; fees may apply. Cancellation never starts fallback.',
  routeHint: 'This bundle selects SearXNG unless a later bundle, profile, home or CLI config overrides it. Disable the entire dsh-web-search-searxng bundle to restore the remaining route. Disabling only its provider row leaves the SearXNG route selected and searches fail. Saved instance settings are retained.',
  resetAll: 'Reset all to defaults',
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
  modeLabel: '服务模式', modeAuto: '自动选择', modeLocal: '本地自动托管', modeExternal: '连接已有实例',
  modeHint: '自动选择会沿用已填写的地址或环境变量；没有地址时自动准备本地服务。本地托管无需 Docker 或系统 Python，保存后生效。',
  advanced: '高级设置', managedPort: '本地端口', managedPortHint: '0 表示自动选择空闲端口。指定的端口被占用时会报错；保存端口修改会自动重启本地服务。',
  serviceTitle: '搜索服务', serviceIdle: '等待中', servicePreparing: '首次准备运行环境', serviceStarting: '正在启动',
  serviceReady: '可用', serviceStopped: '已停止', serviceFailed: '失败', serviceExternal: '使用已有实例',
  activeEndpoint: '当前地址', serviceHint: '本地服务首次使用会下载固定版本的依赖，随 DSH 运行，禁用插件或退出 DSH 时停止。已有实例由其部署者独立管理。',
  serviceRestart: '启动 / 重试 / 重启', serviceStop: '停止', serviceTest: '测试搜索', serviceTestResult: '搜索成功，返回来源数', serviceLogs: '诊断日志',
  setupUv: '正在下载安装工具', setupSource: '正在下载 SearXNG', setupPython: '正在准备 Python', setupDependencies: '正在安装依赖',
  baseUrl: '实例地址',
  baseUrlHint: '已有实例模式使用此地址，留空则使用 SEARXNG_BASE_URL；自动选择模式下，两者都未设置时自动准备本地服务。',
  engines: '引擎',
  enginesHint: '可多选。这里是常用候选，并非实例的实时清单；引擎名须在你的 SearXNG 配置中存在且已启用。',
  enginesDefault: '未限制引擎：使用实例默认配置。',
  enginesSelected: '仅搜索勾选的引擎。',
  enginesWeb: '通用网页 · 网站与综合资料',
  enginesNews: '新闻资讯 · 报道与近期事件',
  enginesScience: '学术研究 · 论文与预印本',
  enginesKnowledge: '技术与百科 · 代码仓库、问答与百科资料',
  enginesCustom: '其他引擎（自定义名称）',
  enginesCustomNames: '自定义引擎名称',
  enginesCustomHint: '填写实例中的准确名称，多个名称用逗号分隔；列表中勾选的引擎会保留。',
  enginesCustomSelected: '另外已选择',
  language: '结果语言',
  languageHint: '选择偏好的结果语言；「实例默认」沿用部署配置，其他语言可填写自定义代码。',
  languageDefault: '实例默认',
  languageAll: '不限语言',
  languageZhCN: '简体中文（zh-CN）',
  languageZhTW: '繁体中文（zh-TW）',
  languageEn: '英语（en）',
  languageJa: '日语（ja）',
  languageKo: '韩语（ko）',
  languageFr: '法语（fr）',
  languageDe: '德语（de）',
  languageEs: '西班牙语（es）',
  languageRu: '俄语（ru）',
  languageCustom: '其他语言（自定义代码）',
  languageCustomCode: '自定义语言代码',
  overridden: '已覆盖',
  reset: '恢复默认',
  readOnly: '本部署的设置为只读。',
  unavailable: '该插件当前未加载，暂时无法配置。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  invalidValue: '请填文本；留空表示使用默认值。',
  fallbackLabel: '允许官方备用（可能产生搜索费用）',
  fallbackHint: '默认关闭。DSH 0.2.1-alpha.2 没有官方备用接口：勾选后也不会发起官方搜索，失败时会明确提示此限制。支持公开 searchWithProvider 的宿主可在失败后复用已注册的官方提供方，可能产生费用。取消请求不会启动备用。',
  routeHint: '此 bundle 默认选择 SearXNG，后续 bundle、profile、home 或 CLI 配置可覆盖路由。请禁用整个 dsh-web-search-searxng bundle 来恢复其余配置决定的路由；仅禁用提供方行会留下 SearXNG 路由并导致搜索失败。已保存的实例设置会保留。',
  resetAll: '全部恢复默认',
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
