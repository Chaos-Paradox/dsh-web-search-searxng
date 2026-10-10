# 配置与升级

[English](configuration.md) | 中文

## 支持的组合

0.3.0 已在未打补丁的 DSH 0.2.1-alpha.2 及标准 base/Web bundle 上验证。插件 bundle 必须位于声明 `id: web` 的层之后。它将完整 Web config 替换为 `searchProvider: searxng`、`fetchProvider: http`，插入提供方，并将 `allowOfficialFallback` 默认为 false，不向用户 profile 写入路由。直接调用 `ctx.plugin()` 只注册提供方，调用者需自行配置 `WebRuntime` 路由。

DSH 按 `dsh.profile.bundles` 顺序应用 bundle，再应用 profile、home、CLI overlay。后续层优先，config 对象整体替换。使用自定义 fetch 提供方的 profile 应写完整覆盖，例如：

```yaml
- id: web
  config:
    searchProvider: searxng
    fetchProvider: my-fetch-provider
- id: web-search-searxng
  config:
    baseURL: http://localhost:8080
    engines: bing,duckduckgo
    language: zh-CN
    allowOfficialFallback: false
```

自定义 fetch 提供方需已注册。用户有意设置 `searchProvider: deepseek-official` 时该覆盖优先，且不会阻止 SearXNG 激活。部分 `web.config` 覆盖可能删除显式搜索路由，导致多个可用提供方存在歧义。仅当对应显式字段缺失时，`DSH_WEB_*_PROVIDER` 才生效。可通过 `dsh --profile <名称> --dump-config` 检查组合；输出可能包含密钥，不应未经脱敏分享。

## 生命周期

本地托管随插件启用而准备和启动，禁用、卸载或正常退出 DSH 后端时停止自己启动的服务并保留缓存。查询复用运行中的服务；关闭浏览器标签页不会停止后端。外部模式不管理实例进程。卡片提供连接、端口、搜索偏好与服务操作，详见[本地托管说明](managed-runtime.zh.md)。

启用/禁用 bundle 修改 manifest 中的有序列表。恢复路由需禁用整个已安装 bundle；有 HMR 时其余组合实时生效，否则需重启。仅禁用提供方行会留下原路由，搜索明确失败。卸载同样恢复其余配置层，包括较早自定义默认值和当前用户覆盖。CLI 卸载前需停止 profile；开启 HMR 的插件页可实时卸载。

卡片写入是普通用户设置。实例地址、引擎、语言和备用选项在禁用/卸载后保留，重新安装即可继续使用。恢复是依据当前其余配置层重新解析，不记录安装前快照或字段归属事务。重新启用会追加 bundle，可能改变其他 bundle 的相对优先级。较高优先级的 home/CLI 设置覆盖可能使卡片保存失败，此时宿主保留原 profile 值。

## SearXNG 服务与端口

本地托管的 `managedPort` 默认 `0`：操作系统分配空闲的回环端口，插件自动同步实际地址，无需手动开启端口或填写地址。若明确指定 `8080` 等端口且已被占用，启动会报错，不会自动换端口；改为 `0` 并保存即可恢复自动分配，也可选择其他空闲固定端口。修改 `managedPort` 并保存会自动重启服务并同步实际地址。

`auto` 沿用已有 `baseURL` 或 `SEARXNG_BASE_URL`。若之前连接手动启动的 8080 服务，可在卡片选择「本地自动托管」（`local`），端口保持 `0`，切换到插件自动管理。外部实例需自行修改监听或容器映射，再在卡片更新 `baseURL`；仅修改外部地址不会改变其服务端口。例如 Docker `-p 8088:8080` 将容器的 8080 暴露在本机 8088，卡片地址应填 `http://localhost:8088`。插件不会启停该外部容器。

0.3.0 使用 profile 内的持久缓存，随 DSH 启停，不注册系统开机服务。0.2.1 验证时手动启动的 `/tmp` 实例属于历史测试环境，不是新的自动托管运行环境。

## 官方备用能力

默认 false 不发起官方请求，取消也不发起官方请求。未打补丁的 DSH 0.2.1-alpha.2 无法逐请求调用官方备用：它的 `search()` 使用已选择的 SearXNG 路由，再次调用会递归。插件不会访问私有注册表或创建带凭据的官方提供方。

扩展后的宿主需公开 `web.searchWithProvider(id, request, signal)`，执行注册/可用性检查、遵守禁用、复用提供方配置/日志并限制结果数量。明确开启备用才允许在原请求失败后尝试一次官方搜索。尝试和降级日志以及双语结果提醒会披露费用。缺少接口时，插件仍可激活并完成成功的 SearXNG 搜索；开启备用后失败会同时报告原始原因和能力限制，不发起官方请求。复选框仍可编辑，以便明确关闭下层继承的 true。

## 从 0.2.0 升级

安装 0.3.0 前备份 profile 的 `package.json`、锁文件和 `cordis.patch.yml`。未打补丁的安装若只是被旧激活校验阻止，可直接安装新包，不需要账本。

若旧补丁宿主已向 profile 写入 `dsh-config-effects/v1` 和显式 SearXNG 路由，应先通过对应旧宿主禁用/卸载旧 bundle，使其账本恢复归属字段，再在当前主线上安装 0.3.0。若无法使用旧宿主，先保留备份，逐项检查旧路由/设置覆盖和账本，确认后再清理过时归属；保留有意设置的用户覆盖，以及模型和凭据配置。本版本无法在未打补丁宿主上推断历史路由或回滚旧账本。

已移除的承诺包括激活时强制路由、自动保留所有较早 fetch 字段、卸载逐字段回滚，以及在未打补丁主线上使用官方备用。新的承诺是 bundle 默认路由、保留更高优先级用户配置、移除层后恢复路由、保留用户设置，以及未经明确允许不使用付费搜索并明确报告失败。

## 回归检查

`pnpm run build` 生成需要提交的 `lib/`。`DSH_SOURCE_ROOT=/path/to/deepseek-harness pnpm run test:host` 在已构建且未打补丁的 0.2.1-alpha.2 宿主中使用这些发布文件，验证真实 profile 加载、包解析、Include、Loader、WebRuntime、设置写入、HMR 和 bundle 管理。本地 JSON 端点和已注册官方探针提供稳定 HTTP 来源并记录官方调用次数。上游引擎真实验证单独通过 `SEARXNG_BASE_URL=... pnpm run test:e2e` 运行。
