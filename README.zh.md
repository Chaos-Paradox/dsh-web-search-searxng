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

![设置 → 插件 页中的 SearXNG 搜索卡片](docs/settings-card.zh.png)

*设置 → 插件 页中的 SearXNG 搜索卡片——实例地址、引擎限制与结果语言，改动对下一次搜索立即生效，无需重启。*

## 快速开始

前提：使用已应用[配套宿主集成](host-integration/README.md)的 DSH。缺少这些接口的宿主无法支持这套卸载账本。

**1. 安装插件：**

```sh
dsh plugin --profile <名称> add https://github.com/Chaos-Paradox/dsh-web-search-searxng
```

**2. 指向你的 SearXNG 实例：** 打开 **设置 → 插件 → SearXNG 搜索**，填写实例地址（例如 `http://localhost:8080`）。还没有实例？[两分钟 Docker 搭建](#搭建-searxng-实例)。

配合 [DSH 宿主集成](host-integration/README.md)，安装后默认使用 SearXNG。搜索失败会明确报错，不发起官方搜索请求。如需付费备用，在卡片勾选「允许官方备用」并保存。卸载会恢复账本记录的安装前配置；后续手动修改会保留并报告冲突。

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

插件以稳定 id `searxng` 注册进 dsh 的 `ctx.web` 能力缝；每一次智能体网页搜索都由 `GET {baseURL}/search?format=json` 提供服务。

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

- 安装了带有 `ctx.web` 能力缝的 DeepSeek Harness（任何携带 `dsh-web` 的 dsh 版本）。
- 一个**启用 JSON 输出**的 SearXNG 实例——其 `settings.yml` 的 `search.formats` 必须包含 `json`（SearXNG 默认只提供 HTML）。
- Node.js `^22.19 || >=24`（仅开发需要；使用者只需 dsh）。

### 搭建 SearXNG 实例

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

验证 JSON 已启用：

```sh
curl "http://localhost:8080/search?q=test&format=json"
```

### 安装选项

**从 GitHub 直接导入（跟踪最新 main）：**

```sh
dsh plugin --profile <名称> add https://github.com/Chaos-Paradox/dsh-web-search-searxng
```

**指定发布版本（推荐，可复现）：**

```sh
dsh plugin --profile <名称> add https://github.com/Chaos-Paradox/dsh-web-search-searxng#v0.2.0
```

所有版本见 [Releases 页面](https://github.com/Chaos-Paradox/dsh-web-search-searxng/releases)。

**本地克隆或 tarball：** 同一命令填绝对路径即可，例如 `dsh plugin --profile <名称> add /path/to/dsh-web-search-searxng`。无需构建——`lib/` 已提交。

Bundle 注册 SearXNG；集成后的宿主记录并应用 `web.searchProvider: searxng`，同时保留原有 fetch 提供方。验证导入结果：

```sh
dsh plugin --profile <名称> list        # 应能看到 dsh-web-search-searxng

# 卸载 —— 恢复账本记录的安装前路由与设置
dsh plugin --profile <名称> remove dsh-web-search-searxng
```

### 1. 指向你的实例

**方式 A —— GUI（推荐）：** 打开 **设置 → 插件 → SearXNG 搜索** 填写字段。所有字段在下一次搜索即生效，无需重启。

**方式 B —— 环境变量**，启动 dsh 前导出：

```sh
export SEARXNG_BASE_URL="http://localhost:8080"
```

| 字段 | GUI 标签 | 环境变量回退 | 说明 |
|---|---|---|---|
| `baseURL` | 实例地址 | `SEARXNG_BASE_URL` | SearXNG 实例基础地址，自动拼接 `/search`。留空 → 提供方报告不可用。 |
| `engines` | 引擎限制 | — | 逗号分隔的引擎白名单，例如 `bing,duckduckgo`。 |
| `language` | 结果语言 | — | 偏好的结果语言，例如 `zh-CN`、`en`、`ja`。 |

⚠️ **接管中但未配置端点时，搜索会明确报错**（提供方不可用），而不会静默回退 DeepSeek——沉默的回退正是计费惊喜的来源，本插件拒绝这么做。失败会体现在搜索结果本身中，host 日志也会给出警告。（卡片刻意不显示端点警告：字段留空仍可能来自 `$SEARXNG_BASE_URL`，只有宿主知道真相。）

### 2. 可选官方备用

「允许官方备用（可能产生搜索费用）」复选框默认关闭。勾选并保存后，仍优先调用 SearXNG，仅在该次请求失败时尝试已注册的 DeepSeek 官方提供方。每次备用尝试都会在发出请求前写入日志；成功的备用结果带有费用提醒。两条路线都失败时，错误会明确报告两次失败。取消请求不会启动备用。取消勾选并保存会明确写入 `false`，即使下层配置开启了备用，也能关闭。

备用复用宿主已有官方提供方的凭据、模型和限额。官方提供方被禁用、未注册或不可用时，不会自行创建实例绕过这些设置。未配置 SearXNG 地址时，即使开启备用，搜索仍报告不可用。这控制的是额外搜索提供方费用；正常模型使用及自建 SearXNG 的成本另计。

### 3. 卸载与恢复

宿主在 profile YAML 的 `dsh-config-effects/v1` 注释中保存逐字段账本，与配置值一起原子写入。账本记录所有者、原值、原先是否存在以及最后写入值，不备份整个文件。安装时选择 SearXNG 并关闭官方备用；卡片修改会更新需要追踪的设置字段。

通过插件页或 `dsh plugin --profile <名称> remove dsh-web-search-searxng` 卸载。宿主在实时移除前撤销仍属于插件的字段，CLI 也可在包文件已删除后按账本恢复。原本不存在的值会删除，原有值会恢复；后续手动修改会保留并报告冲突。更新、重启和 HMR 不会重置安装前基线。原路由可以是任何提供方，不固定为 DeepSeek。

## 故障排查

| 症状 | 原因 | 解决办法 |
|---|---|---|
| `SearXNG error (HTTP 403); the instance may refuse JSON output` | `settings.yml` 的 `search.formats` 缺少 `json` | 按上文添加并重启容器 |
| 搜索报提供方不可用（`WEB_PROVIDER_CONFIGURED_UNAVAILABLE`） | 接管已生效但未配置端点 | 填写卡片字段或设置 `SEARXNG_BASE_URL` |
| 搜索走了其他提供方 | 更高优先级的 home/CLI 覆盖或后续手动修改 | 检查 `--dump-config` 与覆盖配置 |
| `search request failed` / ECONNREFUSED | 实例未运行或端口不对 | 检查 `docker ps`，用 curl 验证命令测试；或开启官方备用作为逐请求兜底 |
| 搜索结果开头出现 ⚠️ 降级提醒 | 官方备用已允许且 SearXNG 刚失败了一次 | 检查实例；在卡片关闭备用即恢复严格模式 |
| `WEB_PROVIDER_ERROR` 提到 redirect | SearXNG 前有代理发生重定向 | 将 `baseURL` 指向最终地址；重定向按设计直接失败 |
| `sources` 为空 | 引擎没有返回可用结果（或条目都缺 URL） | 放宽 `engines`，在浏览器里检查实例 |

## 开发

```sh
pnpm install        # 依赖全部来自 npm（@deepseek-ai/* 0.2.1-alpha.1 列车）
pnpm run build      # tsdown（宿主 + 浏览器双 bundle）+ tsc（浏览器声明）
pnpm test           # vitest：提供方行为、重定向策略、代理 egress、卡片表单
pnpm run typecheck  # tsc --noEmit
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

- 本次改动需要配套 [DSH 宿主集成](host-integration/README.md)。未修改的宿主会明确拒绝激活；单独安装插件无法给 DSH 补上可靠的卸载事务。
- home/CLI 覆盖保留正常优先级，可能导致 SearXNG 激活失败。使用有意覆盖的路由前，请检查 `--dump-config`。
- 请通过 DSH 插件管理流程卸载。直接 `pnpm remove` 或删除包文件会绕过宿主事务；账本仍保留，可供后续协调恢复。

## 参与贡献

欢迎 Issue 与 Pull Request。请保持提供方「无凭据」与「重定向失败关闭」这两条设计约束——它们是设计决策，不是缺失的功能。

## 许可证

[MIT](LICENSE) © [Chaos-Paradox](https://github.com/Chaos-Paradox)

## 相关链接

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)——宿主项目
- [SearXNG](https://github.com/searxng/searxng)——元搜索引擎
- [SearXNG JSON 格式文档](https://docs.searxng.org/admin/settings/settings_search.html)——启用 `search.formats`
