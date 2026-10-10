# 本地自动托管

[English](managed-runtime.md) | 中文

插件 0.3.0 的默认 `auto` 模式会沿用已有 `baseURL` 或 `SEARXNG_BASE_URL`；没有地址时自动准备本地 SearXNG。`local` 强制本地托管，`external` 连接已有实例。首次本地准备需要网络，卡片依次显示安装工具、SearXNG、Python 和依赖的准备状态，完成后显示实际连接地址。准备本地 SearXNG 无需用户安装 Docker、Python、Git，或运行命令。

## 设置与日常使用

在卡片选择引擎、结果语言并保存；这些搜索偏好对下一次请求生效，不重启服务。高级设置的本地端口默认 `0`，由操作系统在绑定时分配空闲端口，没有固定的 8080 依赖，也无需手动开启端口。指定端口被占用时会明确报错，不停止占用者，也不自动改用其他端口。将「本地端口」改回 `0` 并保存即可恢复自动分配。修改端口并保存会停止原有托管进程，再按新端口启动，连接地址由管理器同步，不写入外部实例地址。后续启动可能分配不同端口，插件会自动跟随，无需手改地址。

之前已保存 `http://localhost:8080` 的安装，在 `auto` 模式下继续使用该外部实例。切换到「本地自动托管」（`local`），将「本地端口」保持为 `0`，即可改用插件管理；原外部服务仍由部署者独立管理。

卡片显示准备、启动、可用、停止或失败状态，提供启动/重试/重启、停止、测试搜索和最近诊断日志。测试搜索只访问当前 SearXNG，不调用可能付费的官方备用。显示来源数为 0 表示请求成功但没有来源，不能作为搜索质量合格的证明。服务未就绪时实际搜索明确失败；当前未打补丁的 DSH 0.2.1-alpha.2 不支持官方备用。

## 运行环境与生命周期

本地托管使用当前 DSH profile 的 `searxng/` 目录，存放独立 Python、SearXNG 源码、虚拟环境、缓存、随机生成的服务 secret 与生成的配置。不改变系统 Python 或 PATH。安装工具 uv 0.13.0 的六个平台压缩包和 SearXNG 源码 `f4822b3fc46726bb259d14c6332b702c76b98f82` 均校验固定 SHA-256 后解压；Python 固定为 3.12.12，由 uv 管理下载；Python 依赖通过 PyPI 安装，Waitress 固定为 3.0.2。uv 与源码版本随插件发布固定，失败安装没有就绪标记，下次重试重新准备；版本目录保留以供旧插件复用。

服务只监听 DSH 后端的 `127.0.0.1`，使用 Waitress 与预先绑定的 socket 提供 HTTP 服务。就绪检查确认实际端口与 `/config` 响应后才对搜索提供地址。进程通过 DSH 的公开 `ctx.subprocess` 管理，profile 文件锁防止两个 DSH 进程同时启动同一目录的服务。进程意外退出最多自动重试 2 次；配置可调整 `restartLimit`（0–10）、`setupTimeoutMs`（默认 600000）与 `startupTimeoutMs`（默认 120000）。失败显示在卡片，可手动重试。

服务随启用的插件运行，查询之间保持运行并复用。关闭浏览器标签页不会停止 DSH 后端及其服务。手动停止、切换外部模式、禁用插件或正常退出 DSH 后端时，等待自己启动的子进程退出并释放文件锁；依赖缓存与偏好保留。重启 DSH 时自动重新启动。没有向操作系统注册开机常驻服务。外部模式不启动、停止或修改已有实例。强制终止宿主时的进程清理由 DSH 子进程提供方负责，文件锁具备过期恢复；不能保证所有操作系统强制终止方式的相同行为。

缓存启动无需重复安装运行环境；搜索公开网页仍需通过网络访问所选上游引擎。

Windows 在固定源码压缩包校验后应用一项兼容修正：Valkey 适配器将 Unix 专有的 `pwd` 用户信息模块改为可选，连接失败时使用不依赖该模块的日志。修改前匹配预期源码，就绪标记包含兼容版本；POSIX 行为保持不变。这是插件维护的修正，不代表上游承诺支持 Windows。

## 平台与验证

安装工具覆盖 macOS/Windows/Linux glibc 的 x64 与 arm64；不支持的系统显示明确错误，可使用外部实例。本机验证覆盖 macOS arm64、未打补丁的 DSH 0.2.1-alpha.2，以及从空目录下载、真实搜索、完整 Web 卡片、缓存重启、停止和插件退出清理。[Windows、macOS、Linux GitHub Actions 已于 2026-10-10 通过](https://github.com/Chaos-Paradox/dsh-web-search-searxng/actions/runs/38034853680)，包含单元测试、构建、从空目录准备服务、缓存重启与清理。CI 就绪验证不依赖上游搜索引擎结果，完整 CPU/发行版矩阵未覆盖；未测试系统的 Python 与依赖可用性仍需验证。DSH peer 范围也不等于对所有宿主版本的兼容保证，目前仅实际测试 0.2.1-alpha.2。

`pnpm run test:managed` 使用构建后的发布 JS，从临时空目录准备真实服务，检查来源、缓存重启和清理，结束后删除临时数据。设置 `SEARXNG_SMOKE_SEARCH=0` 可只验证服务准备与生命周期。详细结果见仓库中的[验证记录](https://github.com/Chaos-Paradox/dsh-web-search-searxng/blob/main/docs/validation-managed-2026-10-10.md)。

上游：[uv 的 Python 管理](https://docs.astral.sh/uv/guides/install-python/)、[SearXNG 源码](https://github.com/searxng/searxng/tree/f4822b3fc46726bb259d14c6332b702c76b98f82)、[Waitress](https://docs.pylonsproject.org/projects/waitress/en/latest/)。各项目采用其上游许可证；下载的 SearXNG 源码保留其许可证文件。
