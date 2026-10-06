# dsh-web-search-searxng

[English](README.md) | 中文

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：通过自托管的 [SearXNG](https://github.com/searxng/searxng) 元搜索实例搜索 web——不需要 API 密钥，也不产生每次搜索的模型调用成本。安装后还会在 Web 与桌面应用的 设置 → 插件 页添加 **SearXNG 搜索**卡片，实例地址、引擎限制与结果语言都可以在 GUI 里编辑。

## 前提

- 安装了带有 `ctx.web` 能力缝的 DeepSeek Harness（任何携带 `dsh-web` 的 dsh 版本）。
- 一个启用 JSON 输出的 SearXNG 实例——其 `settings.yml` 的 `search.formats` 必须包含 `json`（SearXNG 默认只提供 HTML）。例如 `docker run -p 8080:8080 searxng/searxng` 加上这一处改动。

## 安装

从 GitHub 安装到任意 dsh profile：

```sh
dsh plugin --profile <name> add <本仓库地址>
```

本地克隆或 tarball 也走同一命令，填绝对路径即可。安装会激活 bundle 的补丁层并注册提供方行；`dsh plugin --profile <name> remove dsh-web-search-searxng` 即可撤回。

## 配置与启用

注册不等于启用。两个开关都由你决定：

1. **指向你的实例**——打开 设置 → 插件 → SearXNG 搜索，填实例地址（例如 `http://localhost:8080`），或在启动 dsh 前导出 `SEARXNG_BASE_URL`。所有字段在下一次搜索即生效，无需重启。
2. **选择它执行搜索**——给 profile 的 `web` 行打补丁（补丁会整段替换一行的 config，因此需要重申 `fetchProvider`）：

```yaml
# $DSH_HOME/profiles/<name>/cordis.patch.yml
- id: web
  config:
    searchProvider: searxng
    fetchProvider: http
```

想切回去，删掉这个补丁即可（或写 `searchProvider: deepseek-official`）。未配置端点时提供方报告不可用，不改变任何现有行为。

## 搜索返回什么

每项 SearXNG 结果映射为可引用的来源：URL（缺失的条目被丢弃）、标题、引擎摘录作为 snippet、以及存在的发布日期。SearXNG 不返回生成答案，因此结果只带来源。实例返回 403 表示其 JSON 格式未启用——错误消息会直接说明。

## 开发

```sh
pnpm install     # 依赖全部来自 npm（@deepseek-ai/* 0.2.1-alpha.1 列车）
pnpm run build   # tsdown（宿主 + 浏览器双 bundle）+ tsc（浏览器声明）
pnpm test        # vitest：提供方行为、重定向策略、代理 egress、卡片表单
```

`lib/` 被刻意提交：从 git 地址安装时消费者直接拿到构建产物，无需构建链。`src/` 变更后请重建并重新提交 `lib/`。

已知缺口：卡片的 apply 级注册测试暂留在上游——已发布的 `@deepseek-ai/dsh-client-test-runtime` 引用了其 npm 包未携带的源文件，因此本仓库为其余卡片测试所需的两个 helper 保留了本地替身（`tests/helpers.ts`）。

## 许可证

MIT
