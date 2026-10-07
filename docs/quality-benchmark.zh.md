# 质量对照实验：SearXNG 提供方 vs 官方提供方

**中文** | [English](quality-benchmark.md)

> **一句话结论**：在"同一问题、同一答案模型、盲评打分"的对照设置下，无论是**线路级**还是**端到端（真实 dsh 智能体 + 真实 `web_search` 工具调用）**，都没有观察到换成 SearXNG 提供方带来答案质量下降。

这个插件把搜索来源从 DSH 内置的官方搜索（`deepseek-official`）换成你自托管的 SearXNG。合理的担心是：**免费的自托管元搜索喂给模型的"料"会不会更差？** 我们用两个互补的实验回答这个问题。

## 实验一：端到端对照（主证据）

脚本：[benchmarks/e2e-comparison.mjs](../benchmarks/e2e-comparison.mjs)；原始数据：[benchmarks/results/](../benchmarks/results/)（`e2e-*.json`，含事件流摘要与双份答案）。

这是最贴近真实使用的设计——**每一题都由一个真实的 dsh 智能体（headless profile）回答**，它必须真的调用 `web_search` 工具，事件流里逐题核实了搜索调用次数：

```
每道题 (10题, 中英各半)
  ├─ SearXNG 轮: dsh --profile headless --patch e2e-searxng.patch.yml "<题>"
  │              (补丁只做两件事: web 行 searchProvider: searxng
  │               + 插件行配置本地实例地址与引擎 bing,yahoo)
  ├─ 官方轮:     dsh --profile headless "<题>"
  │              (profile 原样, searchProvider: deepseek-official)
  │   —— 两轮用同一个智能体模型、同一套预设、同一份提示词,
  │      唯一变量是搜索提供方; 每题提示词要求先用 web_search 再作答
  └─ 评判: 盲评——评委模型 (deepseek-chat) 看不到答案来自哪边,
           对照每题参考要点按 0-5 打 事实准确性/完整性/引用支撑
```

### 结果（两次完整运行：2026-10-06 与 2026-10-07）

| 维度 (0-5) | 运行1 SearXNG | 运行1 官方 | 运行2 SearXNG | 运行2 官方 |
|---|---|---|---|---|
| 事实准确性 | 4.6 | 4.4 | 5.0 | 4.5 |
| 完整性 | 4.6 | 4.1 | 4.9 | 4.4 |
| 引用支撑 | 4.2 | 4.0 | 4.1 | 4.3 |
| 胜/负/平 | 6 / 2 / 2 | | 3 / 4 / 3 | |

逐题得分（a/c/c = 准确性/完整性/引用）：

| 题目 | 运行1 SX | 运行1 官方 | 运行2 SX | 运行2 官方 |
|---|---|---|---|---|
| 碳14半衰期 (en) | 5/5/4 ✓ | 5/4/4 | 5/5/4 | 5/5/5 ✓ |
| HTTP/2 vs 3 (en) | 4/4/3 | 5/5/5 ✓ | 5/4/4 | 5/5/5 ✓ |
| 2025 物理诺奖 (en) | 5/5/5 ✓ | 5/5/4 | 5/5/5 | 5/5/5 |
| 红楼梦作者 (zh) | 5/5/4 ✓ | 4/4/4 | 5/5/3 ✓ | 5/4/4 |
| 2024 中国 GDP (zh) | 5/5/5 ✓ | 3/2/4 | 5/5/5 ✓ | 4/4/4 |
| pnpm link vs file (zh) | 2/2/1 | 4/4/3 ✓ | 5/5/4 | 5/5/5 ✓ |
| SearXNG 开 JSON (en) | 5/5/5 ✓ | 5/4/3 | 5/5/4 | 5/5/4 |
| Vue ref vs reactive (zh) | 5/5/5 | 5/5/5 | 5/5/4 | 5/5/4 |
| Node.js 最新 LTS (en) | 5/5/5 ✓ | 3/3/3 | 5/5/5 ✓ | 1/1/2 |
| 2026 春节日期 (zh) | 5/5/5 | 5/5/5 | 5/5/3 | 5/5/5 ✓ |

✓ = 该题胜者。两次运行合计 **SearXNG 9 胜、官方 6 胜、5 平**，平均分几乎相同——结论读作"无质量差异"，而非"谁更好"。注意 pnpm 一题两次运行结果完全翻转（2/2/1 ↔ 5/5/4），说明单题分差里有相当的水分（评委与模型噪声），只有聚合结论有意义。

两轮 40 次运行**每次都真实发起了搜索**（每轮 SearXNG 侧各 12 次、官方侧各 20 次 `web_search` 调用），无一次退化为"凭记忆回答"。

### 我们怎么确认两轮真的各走各的通路？

发布前做过三组取证（细节见[下文](#引擎取证)）：

1. **配置树**：`--dump-config` 显示无补丁时 `web` 行 `searchProvider: deepseek-official`（来自 dsh-base bundle），叠加补丁后变为 `searxng`。
2. **因果探针**：把补丁里的 `baseURL` 改成一个无监听的端口，SearXNG 轮的 `web_search` 立刻报插件自己的错误文案（`SearXNG search request failed: fetch failed`）——证明该轮搜索确实由本插件的 provider 执行；官方轮不受影响。
3. **服务器侧日志**：本地 SearXNG 实例的日志里，每道题目只出现一次（来自 SearXNG 轮）——官方轮从未触碰本地实例；若两轮同源，结果与分数不会呈现差异。

## 实验二：线路级对照（辅助证据）

脚本：[benchmarks/quality-comparison.mjs](../benchmarks/quality-comparison.mjs)。不经过 dsh 运行时，直接向两个 provider 的上游端点发**与生产代码逐行对应**的请求，各取 top-8 来源后交给同一答案模型、同一盲评流程。

结论方向与端到端一致，并贡献了检索层观察：**两侧来源域名重合度仅 0.082（Jaccard）——取材路径完全不同，答案却命中相同的事实要点**。

<a id="引擎取证"></a>
## 引擎取证：一段比实验本身更有教育意义的插曲

实验过程中我们在引擎配置上栽了两次，完整的因果链值得公开，因为它正是"自托管质量取决于实例状态"这句提醒的实证：

1. **第一轮（线路级）**用 `bing,startpage`：Bing 对本机的自托管流量返回降级结果（词典页面），SearXNG 侧全军覆没。
2. **换成 `startpage,mojeek` 后"痊愈"**——线路级与第一次端到端运行都拿到了好成绩。我们一度以为是 Startpage+Mojeek 的功劳。
3. **取证推翻了结论**：用一个记录原始 URL 的桩服务器证实插件**每次都正确透传了 `engines` 参数**；但查询本地实例的 `/config` 发现，这个 git 主线构建的实例里**根本没有注册 startpage/mojeek**（261 个引擎，名字已换代；只有 ahmia/torch 注册时大声报错，缺失的引擎在查询时被**静默丢弃**）。请求因此回退到默认引擎池，当时唯一稳定出活的是 **google cse**——好成绩的真正来源。
4. **修正后复跑**：把补丁改成实例里确实存在且当时可用的 `bing,yahoo`（第二次端到端运行），结果依然稳健。

所以插件文档里"引擎"一项的建议值得重复：**引擎名必须在你的实例上真实存在且在你的网络下可用**——用 `curl "http://你的实例/config" | grep 引擎名` 先验证，再填进卡片。插件会忠实转发，但实例对不认识的引擎名不会报错，只会悄悄回退。

## 诚实的限制（请务必读）

1. **样本小**：10 题 × 2 次运行。结论只能读作"未观察到下降"，不能读作"永远更好"。同题跨运行胜负翻转（pnpm）说明单题噪声不小。
2. **评委是 LLM**：可能犯错；原始 JSON 保留了每题的双份答案与评判理由，欢迎人工复核。
3. **端到端轮次的智能体模型**是 headless profile 的默认模型（`deepseek-flash`）；你自己的日常使用模型不同，绝对分数会变，但"两侧对称"的对照性质不变。
4. **引擎的现实**：SearXNG 侧的答案质量最终取决于你的实例里哪些引擎可用、以及你的网络到各引擎的可达性（见上面的取证插曲）。本实验两次运行分别由 google cse（回退）与 bing+yahoo（显式）供数，结论一致，但你自己的实例表现请以自测为准。
5. **官方侧的搜索触发**由 `deepseek-v4-flash` 的 web_search 工具决定：线路级实验里出现过零结果（弃权）；端到端轮中官方智能体会自动补搜（搜索次数更多），这也是产品行为的一部分。

## 自己动手复现

```sh
# 前置: 一个开了 JSON 输出的 SearXNG 实例（README 有 Docker 方法）
# 密钥从环境变量或 ~/.dsh/.credentials.yaml 读取，只发往 api.deepseek.com

# 端到端（需要 dsh CLI 检出; 插件装进 headless profile 一次即可）:
node /path/to/deepseek-harness/apps/cli/lib/bin.js plugin --profile headless add /path/to/dsh-web-search-searxng
# 按你的实例修改 benchmarks/e2e-searxng.patch.yml 里的 baseURL 与 engines
SEARXNG_BASE_URL=http://127.0.0.1:8080 node benchmarks/e2e-comparison.mjs

# 线路级:
SEARXNG_BASE_URL=http://127.0.0.1:8080 node benchmarks/quality-comparison.mjs

# 可选环境变量: SEARXNG_ENGINES / DEEPSEEK_SEARCH_MODEL / DEEPSEEK_ANSWER_MODEL / DEEPSEEK_API_KEY
```

每次运行都在 `benchmarks/results/` 落一份原始 JSON（线路级含来源列表；端到端含事件流摘要、双份答案与评判）。
