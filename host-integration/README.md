# Retired host integration / 已停用的宿主集成

Version 0.3.0 runs on unpatched DSH 0.2.1-alpha.2. Routing now comes from `cordis.patch.yml` as a normal bundle layer; `configEffects`, the journal gate, the companion patch and its implementation/tests have been removed and are no longer shipped. Read [configuration and upgrade notes](../docs/configuration.md) before migrating a profile that used the old patch.

0.3.0 可在未打补丁的 DSH 0.2.1-alpha.2 上运行，路由由普通 bundle 层 `cordis.patch.yml` 提供。`configEffects`、账本校验、配套补丁及其实现/测试已移除，不再发布。旧补丁安装的 profile 升级前请阅读[配置与升级说明](../docs/configuration.zh.md)。

Optional official fallback requires public `web.searchWithProvider(id, request, signal)` that reuses registered providers, checks availability, honors disablement and caps results. Unpatched DSH 0.2.1-alpha.2 has no such method. The plugin reports this limitation without blocking activation or successful SearXNG requests. The old patch is not a supported way to add this API to current mainline.

可选官方备用需宿主公开 `web.searchWithProvider(id, request, signal)`，复用已注册提供方、检查可用性、遵守禁用并限制结果数量。未打补丁的 DSH 0.2.1-alpha.2 没有此方法，插件会报告限制，但不阻止激活或成功的 SearXNG 请求。旧补丁不再是为当前主线添加该接口的受支持方式。
