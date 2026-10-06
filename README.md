# dsh-web-search-searxng

English | [中文](README.zh.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that searches the web through a self-hosted [SearXNG](https://github.com/searxng/searxng) metasearch instance — no API key, no per-search model cost. Installing it also adds a **SearXNG search** card to the Settings → Plugins page of the Web and Desktop apps, so the endpoint, engine restriction, and result language are editable from the GUI.

## Requirements

- A DeepSeek Harness installation whose `ctx.web` seam is present (any `dsh` release carrying `dsh-web`).
- A SearXNG instance with JSON output enabled — its `settings.yml` must list `json` under `search.formats` (SearXNG's default serves HTML only). For example: `docker run -p 8080:8080 searxng/searxng` with that one change.

## Install

Into any dsh profile, from GitHub:

```sh
dsh plugin --profile <name> add <this-repo-url>
```

From a local clone or tarball, the same command takes the absolute path. Installing activates the bundle's patch layer, which registers the provider row. `dsh plugin --profile <name> remove dsh-web-search-searxng` withdraws it.

## Configure and select

Registration alone does not route searches. Two switches, both yours:

1. **Point it at your instance** — open **Settings → Plugins → SearXNG 搜索** and fill in the endpoint (for example `http://localhost:8080`), or export `SEARXNG_BASE_URL` before launching dsh. All fields apply to the next search without a restart.
2. **Select it for search** — patch the profile's `web` row (a patch replaces the row's whole config, so restate `fetchProvider`):

```yaml
# $DSH_HOME/profiles/<name>/cordis.patch.yml
- id: web
  config:
    searchProvider: searxng
    fetchProvider: http
```

To switch back, drop the patch (or set `searchProvider: deepseek-official`). With no endpoint configured the provider reports itself unavailable and nothing changes.

## What a search returns

Each SearXNG result maps to a citeable source: URL (entries without one are dropped), title, the engine's excerpt as the snippet, and the publication date when present. SearXNG returns no generated answer, so results carry sources only. A 403 from the instance means its JSON format is disabled — the error message says so.

## Develop

```sh
pnpm install     # dependencies come from npm (@deepseek-ai/* 0.2.1-alpha.1 train)
pnpm run build   # tsdown (host + browser bundles) + tsc (browser declarations)
pnpm test        # vitest: provider behavior, redirect policy, proxy egress, card form
```

`lib/` is committed on purpose: installing from a git URL gives the consumer the built artifacts without a build step. Rebuild and recommit `lib/` whenever `src/` changes.

Known gap: the card's apply-level registration test lives upstream for now — the published `@deepseek-ai/dsh-client-test-runtime` references source files its npm package does not ship, so this repo keeps local stand-ins (`tests/helpers.ts`) for the two helpers the remaining card specs use.

## License

MIT
