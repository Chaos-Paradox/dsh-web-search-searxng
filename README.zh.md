# 免费、私密的 DeepSeek Harness 网页搜索

[English](README.md) | **中文**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![SearXNG](https://img.shields.io/badge/search-SearXNG-3050ff?logo=searxng&logoColor=white)](https://github.com/searxng/searxng)
[![DeepSeek Harness](https://img.shields.io/badge/plugin-DeepSeek%20Harness-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)

通过你自己托管的 [SearXNG](https://github.com/searxng/searxng) 实例，为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）提供网页搜索能力。

✅ **无需 API 密钥**
✅ **没有按次计费的搜索成本**
✅ **自托管、保护隐私**——查询只发往*你自己的*实例
✅ **直接在 DSH 设置中配置**——设置 → 插件 → SearXNG 搜索
✅ **与官方网页搜索做过端到端对照**——[未观察到质量差异](docs/quality-benchmark.zh.md)

![SearXNG 设置卡片预览：分组引擎列表与结果语言下拉选择](docs/settings-card.zh.png)

*设置 → 插件 页中的 SearXNG 搜索卡片预览——分组引擎列表与结果语言下拉选择，保存后对下一次搜索生效，无需重启。*

## 快速开始

前提：使用 **DeepSeek Harness 0.2.1-alpha.2** 及标准 base/Web bundle，无需宿主补丁。详见[配置与升级说明](docs/configuration.zh.md)。

**0.3.0 默认自动准备并启动本地 SearXNG，无需用户安装 Docker 或 Python。** 首次使用需要联网下载安装工具、独立 Python 和搜索服务依赖；卡片会显示准备进度。已有实例地址或 `SEARXNG_BASE_URL` 会继续使用外部服务，避免改变原有部署。详见[本地托管说明](docs/managed-runtime.zh.md)。

**1. 安装插件：**

```sh
dsh plugin --profile <名称> add https://github.com/Chaos-Paradox/dsh-web-search-searxng
```

**2. 设置偏好：** 打开 **设置 → 插件 → SearXNG 搜索**，等待服务显示「可用」，选择引擎和结果语言并保存。点击「测试搜索」检查实际返回的来源。默认自动选择空闲端口，用户无需填写地址；高级设置可指定端口。连接自己的现有服务时，选择「连接已有实例」并填写地址。

安装会追加默认选择 SearXNG 的 bundle 层，更高优先级的用户配置仍然生效。默认搜索失败会明确报错，不发起官方请求。**未打补丁的 DSH 0.2.1-alpha.2 不支持官方备用**，即使勾选也不会调用官方搜索；卡片与宿主错误会说明限制。禁用整个 bundle 或卸载后，其余配置层决定恢复的路由；已保存的实例设置会保留在 profile。

## 为什么用它？

AI 助手本身不会上网。想让它查资料，通常得买托管搜索 API——按次收费、要 API 密钥、你搜的内容还会经过别人的服务器。这个插件的做法是：在你自己电脑上跑一个搜索中转站（SearXNG），它同时去问谷歌、必应等 70 多个搜索引擎，把汇总结果交给智能体。

| | 托管搜索 API | **本插件** |
|---|---|---|
| 成本 | 按查询计费 | **免费**——你的实例、你的硬件 |
| API 密钥 | 必需，会轮换、会泄露 | **完全没有** |
| 隐私 | 查询发往第三方 | 查询只发往**你的** SearXNG，由它替你聚合 70+ 引擎 |
| 速率限制 | 有 | 只取决于你自己实例的限制 |
| 离线 / 内网可用 | 否 | 是——设计上支持回环地址与内网地址 |

## 基准测试

**答案质量会下降吗？** 我们做了端到端对照实验——真实的 dsh 智能体真实调用 `web_search`，两侧同一模型同一提示词，盲评打分：**未观察到质量差异（两次 10 题运行：胜负平 6-2-2 与 3-4-3，平均分 ≈4.8 vs ≈4.4）**。实验方法、逐题数据与诚实的限制说明：[docs/quality-benchmark.zh.md](docs/quality-benchmark.zh.md)。

## 架构

插件以稳定 id `searxng` 注册进 dsh 的 `ctx.web` 能力缝；选择该路由后由 `GET {baseURL}/search?format=json` 提供搜索服务。可选官方备用同时要求用户明确开启及宿主公开 `web.searchWithProvider`；当前已验证的未打补丁宿主没有该接口。

```
┌─────────────┐   网页搜索     ┌──────────────┐   JSON API   ┌────────────────┐
│  dsh 智能体 │ ─────────────▶ │ ctx.web 能力缝│ ───────────▶ │ 你的 SearXNG   │
│  (LLM)      │ ◀───────────── │ （searxng    │ ◀─────────── │ 实例           │
└─────────────┘   仅来源       │   提供方）   │   results[]  └───────┬────────┘
                               └──────────────┘                      │ 聚合
                                                          ┌──────────▼──────────┐
                                                          │ Google / Bing / DDG │
                                                          │ Brave / 70+ 引擎    │
                                                          └─────────────────────┘
```

SearXNG 不返回生成答案，因此结果只带**来源**——需要正文时智能体会自行用 `fetch` 读取页面。每项结果映射为可引用的来源：

| SearXNG 字段 | dsh 来源字段 | 说明 |
|---|---|---|
| `url` | `url` | 缺失的条目被丢弃 |
| `title` | `title` | 空白时省略 |
| `content` | `snippet` | 引擎摘录 |
| `publishedDate` | `publishedAt` | 引擎提供时才有 |

`truncated` 恒为 `false`（`maxResults` 截断由 web 服务负责）；不附带生成式 `content` 答案，因为 SearXNG 没有可供能力缝担保的答案。

## 安全

- 🔒 **没有可泄露的凭据**——提供方在设计上就是无凭据的。
- ⛔ **重定向直接失败**——HTTP 重定向抛出 `WEB_PROVIDER_ERROR`，查询文本永远不会被重定向转发到别的源。
- 🏠 **自托管友好**——回环地址（`http://localhost:8080`）、内网 IP、子路径挂载（`http://host/searxng`）全部支持，`/search` 会被正确拼接。
- 💬 **可操作的错误信息**——403 响应会明确提示实例的 JSON 格式未启用。

「无凭据」与「重定向失败关闭」是设计约束，不是缺失的功能（见[参与贡献](#参与贡献)）。

## 配置

### 前提条件

- **DeepSeek Harness 0.2.1-alpha.2**（已验证宿主）、标准 base/Web bundle 及公开 `ctx.web` 服务。DSH peer 声明为 `>=0.2.1-alpha.2 <0.3.0`，不支持更早版本；客户端开发依赖固定在同一发布版本。
- 本地托管需要从 DSH 后端访问 GitHub 与 PyPI；依赖缓存于当前 profile 的 `searxng/` 目录，后续启动复用。外部实例模式需要一个运行中且**启用 JSON 输出**的服务。
- 宿主的 Node.js 运行环境需满足 `^22.19 || >=24`；从源码开发也需要此范围的 Node.js。

### 可选：自行搭建外部 SearXNG 实例

先安装并启动 [Docker](https://docs.docker.com/get-started/get-docker/)。以下是 macOS/Linux 的 shell 示例；Windows 可在已配置 Docker 集成的 WSL 中执行，原生 PowerShell 需使用对应语法。也可以按 [SearXNG 官方容器部署说明](https://docs.searxng.org/admin/installation-docker.html)部署，或连接已有远程实例。

```sh
mkdir -p searxng && cd searxng
cat > settings.yml <<'EOF'
use_default_settings: true
server:
  secret_key: "换成一段足够长的随机字符串"
search:
  formats:
    - html
    - json   # ← 本插件必需
EOF
docker run -d --name searxng -p 8080:8080 \
  -v "$PWD/settings.yml:/etc/searxng/settings.yml" \
  searxng/searxng
```

本节用于「连接已有实例」模式，默认本地托管无需执行。`-d` 表示容器在后台运行；上述示例未配置自动重启。外部容器由部署者管理，插件不会启停它；本地托管则随插件/DSH 的生命周期自动启停。

若本机 `8080` 被占用，可将映射改为 `-p 8088:8080`，再在插件卡片填写 `http://localhost:8088`；映射右侧仍是容器端口。源码直接启动的实例则修改 `server.port` 并重启服务，详见[配置说明](docs/configuration.zh.md#searxng-服务与端口)。

验证 JSON 已启用：

```sh
curl "http://localhost:8080/search?q=test&format=json"
```

### 操作系统与验证范围

本地托管提供 macOS、Windows 与 Linux glibc 的 x64/arm64 安装工具选择，使用公开 DSH 子进程接口。**本机实际验证为 macOS；仓库 CI 在 Windows、macOS、Linux 上执行单元测试与从空目录准备服务的验证，结果以对应运行记录为准。未覆盖所有 CPU 架构与 Linux 发行版。** 其他系统可连接外部实例；DSH 版本兼容仍需独立验证。

| DSH 所在平台 | SearXNG 部署选择 | 当前验证状态 |
|---|---|---|
| macOS | 自动托管，或已有本机/远程实例 | 已验证 DSH 0.2.1-alpha.2 |
| Windows | 自动托管，或已有本机/远程实例 | 已加入 CI；以实际运行结果为准 |
| Linux | 自动托管（glibc），或已有本机/远程实例 | 已加入 CI；以实际运行结果为准 |

实例地址必须从 **DSH 后端**可达。`localhost` 指 DSH 后端所在的主机或容器；浏览器在另一台电脑上时，不能把浏览器所在电脑当作后端的 `localhost`。使用远程实例无需在每位用户的电脑上再启动一个 SearXNG。连接错误应先检查服务是否运行及 JSON 是否启用，再检查卡片地址。

### 安装选项

**从 GitHub 直接导入（跟踪最新 main）：**

```sh
dsh plugin --profile <名称> add https://github.com/Chaos-Paradox/dsh-web-search-searxng
```

**指定发布版本（推荐，可复现）：**

```sh
dsh plugin --profile <名称> add https://github.com/Chaos-Paradox/dsh-web-search-searxng#v<version>
```

所有版本见 [Releases 页面](https://github.com/Chaos-Paradox/dsh-web-search-searxng/releases)。

**本地克隆或 tarball：** 同一命令填绝对路径即可，例如 `dsh plugin --profile <名称> add /path/to/dsh-web-search-searxng`。无需构建——`lib/` 已提交。

Bundle 注册 SearXNG，将完整 `web.config` 覆盖为 `searchProvider: searxng`、`fetchProvider: http`。DSH 整体替换 config，不逐字段合并；更高优先级的 profile/home/CLI 配置仍然生效。较早 bundle 中的自定义 fetch 提供方需要在后续完整 Web 配置中指定。禁用或移除 bundle 会恢复其余配置层，不向用户 profile 写入路由。验证导入结果：

```sh
dsh plugin --profile <名称> list        # 应能看到 dsh-web-search-searxng

# 禁用整个 bundle —— 恢复其余配置决定的路由，保留设置
dsh plugin --profile <名称> disable dsh-web-search-searxng

# 卸载 —— 恢复其余配置决定的路由，保留设置
dsh plugin --profile <名称> remove dsh-web-search-searxng
```

### 1. 指向你的实例

**方式 A —— GUI（推荐）：** 打开 **设置 → 插件 → SearXNG 搜索**，选择服务模式、引擎与结果语言并保存。本地模式自动提供连接地址；修改本地端口会自动重启服务，修改引擎或语言无需重启。已有实例模式填写该实例的地址。

引擎列表按用途分为通用网页、新闻资讯、学术研究、技术与百科，展示常用候选，并非实例的实时清单；所选名称须在你的实例中存在且已启用。未勾选时使用实例默认配置。其他引擎名和语言代码可通过自定义选项填写，修改列表选择时会保留已有的自定义值。

**方式 B —— 环境变量**，启动 dsh 前导出：

```sh
export SEARXNG_BASE_URL="http://localhost:8080"
```

| 字段 | GUI 标签 | 环境变量回退 | 说明 |
|---|---|---|---|
| `mode` | 服务模式 | — | `auto` 沿用现有地址，没有地址时本地托管；`local` 强制本地；`external` 连接已有实例。 |
| `managedPort` | 本地端口 | — | 默认 `0` 自动选择空闲端口；指定端口占用时明确报错。 |
| `baseURL` | 实例地址 | `SEARXNG_BASE_URL` | 外部实例基础地址，自动拼接 `/search`；本地模式使用管理器实际地址。 |
| `engines` | 引擎限制 | — | 按用途分组的多选列表，仍保存为逗号分隔的名称，例如 `bing,duckduckgo`；支持自定义名称。 |
| `language` | 结果语言 | — | 常用语言下拉列表与自定义代码选项，例如 `zh-CN`、`en`、`ja`。 |

服务准备中、已停止或失败时搜索会明确报告不可用；外部模式缺少地址也会报错。可在卡片查看状态、重试及诊断日志。测试搜索只调用 SearXNG，不调用官方备用。

### 2. 可选官方备用

复选框默认关闭。未打补丁的 DSH 0.2.1-alpha.2 只公开 `registerSearchProvider`、`registerFetchProvider`、`search` 和 `fetch`，不能为单次请求指定另一个已注册的提供方。勾选并保存不会阻止插件激活或成功的 SearXNG 搜索。SearXNG 失败时，错误同时报告原始失败、宿主能力缺失以及未发起官方请求；宿主也会在开启该选项时警告。取消请求不会启动备用。

未来或扩展后的宿主需要公开 `web.searchWithProvider(id, request, signal)`，检查提供方注册和可用性、遵守禁用、限制结果数量，并复用已有配置与日志。仅在具备该接口且用户明确开启时，插件才会为失败的单次请求调用 `deepseek-official`。尝试前记录日志，成功结果附中英双语费用提醒。插件不会读取私有注册表、复制凭据或自行创建官方提供方。服务未就绪时，即使开启备用，SearXNG 搜索仍不可用。

### 3. 禁用、卸载与保留设置

通过已安装 bundle 的开关，或 `dsh plugin --profile <名称> disable dsh-web-search-searxng`，禁用**整个 dsh-web-search-searxng bundle**；重新启用用对应的 `enable` 命令。开启 HMR 时路由实时生效，否则需重启。卸载用 `dsh plugin --profile <名称> remove dsh-web-search-searxng`，CLI 卸载前需停止运行中的 profile。其余 bundle/profile/home/CLI 层决定恢复的路由，包括之前的自定义提供方或后续手动覆盖。重新启用会追加 bundle，可能改变它与其他 bundle 的优先级。

**仅禁用 `web-search-searxng` 提供方行不会恢复路由。** Bundle 仍选择 `searxng`，搜索会明确报 `WEB_PROVIDER_CONFIGURED_MISSING`，不会悄悄使用付费搜索。请重新启用该行，或禁用整个 bundle。

0.3.0 移除了 `configEffects`、激活账本校验和配套宿主补丁。安装不再向 profile 写入路由归属；卸载不再回滚卡片设置或任意安装前字段值。用户保存的实例地址、引擎、语言和备用选项会保留，供重新安装使用。若旧版补丁安装留下账本或显式 SearXNG 路由，请阅读[升级说明](docs/configuration.zh.md#从-020-升级)。

## 故障排查

| 症状 | 原因 | 解决办法 |
|---|---|---|
| `SearXNG error (HTTP 403); the instance may refuse JSON output` | `settings.yml` 的 `search.formats` 缺少 `json` | 按上文添加并重启容器 |
| 搜索报提供方不可用（`WEB_PROVIDER_CONFIGURED_UNAVAILABLE`） | 本地服务准备中、已停止、失败，或外部模式缺少地址 | 检查卡片状态并重试；外部模式填写地址 |
| 搜索走了其他提供方 | 后续 bundle 或更高优先级的 profile/home/CLI 配置 | 检查 `--dump-config` 与覆盖配置 |
| `search request failed` / ECONNREFUSED | 实例未运行或端口不对 | 检查 `docker ps`，用 curl 验证命令测试；当前已验证宿主不支持官方备用 |
| 搜索结果开头出现 ⚠️ 降级提醒 | 扩展后的宿主支持官方备用，且 SearXNG 刚失败了一次 | 检查实例；在卡片关闭备用即恢复严格模式 |
| `WEB_PROVIDER_ERROR` 提到 redirect | SearXNG 前有代理发生重定向 | 将 `baseURL` 指向最终地址；重定向按设计直接失败 |
| `sources` 为空 | 引擎没有返回可用结果（或条目都缺 URL） | 放宽 `engines`，在浏览器里检查实例 |

## 开发

```sh
pnpm install        # 依赖全部来自 npm（@deepseek-ai/* 0.2.1-alpha.2 列车）
pnpm run build      # tsdown（宿主 + 浏览器双 bundle）+ tsc（浏览器声明）
pnpm test           # vitest：提供方行为、重定向策略、代理 egress、卡片表单
pnpm run typecheck  # tsc --noEmit
DSH_SOURCE_ROOT=/path/to/deepseek-harness pnpm run test:host  # build 后；未打补丁的已构建宿主
SEARXNG_BASE_URL=http://localhost:8080 pnpm run test:e2e    # 可选外部真实实例
pnpm run test:managed  # 从空目录自动准备、真实搜索、重启及清理（需要联网）
```

```
src/
  index.ts      插件入口：配置 schema、环境变量回退、提供方注册
  provider.ts   SearxngSearchProvider：JSON API 调用、结果映射、错误策略
  fallback.ts   可选官方备用：逐请求降级、中英双语提醒、host 日志
  types.ts      SearXNG 响应类型
  client/       浏览器 bundle：设置 → 插件 页卡片（React）
tests/          vitest 套件，含重定向与 egress 策略
```

`lib/` 被刻意提交：从 git 地址安装时消费者直接拿到构建产物，无需构建链。**`src/` 变更后请重建并重新提交 `lib/`。**

已知缺口：卡片的 apply 级注册测试暂留在上游——已发布的 `@deepseek-ai/dsh-client-test-runtime` 引用了其 npm 包未携带的源文件，因此本仓库为其余卡片测试所需的两个 helper 保留了本地替身（`tests/helpers.ts`）。

## 已知限制

- 仅验证了未打补丁的 DSH 0.2.1-alpha.2。该版本不支持官方备用；复选框保存的是可供具备公开接口的宿主使用的明确偏好。
- 路由是 bundle 默认值，不是激活的强制条件。后续配置可选择其他提供方，同时 SearXNG 仍保持注册。
- Overlay 整体替换 Web config。自定义覆盖应同时写入 `searchProvider` 和所需的 `fetchProvider`；部分字段覆盖可能删除显式搜索路由并导致多提供方歧义。
- 禁用/卸载恢复其余配置层决定的路由，不恢复历史快照，用户设置会保留。仅禁用提供方行会导致搜索失败，直到重新启用该行或调整 bundle 配置。

## 参与贡献

欢迎 Issue 与 Pull Request。请保持提供方「无凭据」与「重定向失败关闭」这两条设计约束——它们是设计决策，不是缺失的功能。

## 许可证

[MIT](LICENSE) © [Chaos-Paradox](https://github.com/Chaos-Paradox)

## 相关链接

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)——宿主项目
- [SearXNG](https://github.com/searxng/searxng)——元搜索引擎
- [SearXNG JSON 格式文档](https://docs.searxng.org/admin/settings/settings_search.html)——启用 `search.formats`
