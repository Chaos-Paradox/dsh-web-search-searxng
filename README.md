# Free & Private Web Search for DeepSeek Harness

**English** | [中文](README.zh.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![SearXNG](https://img.shields.io/badge/search-SearXNG-3050ff?logo=searxng&logoColor=white)](https://github.com/searxng/searxng)
[![DeepSeek Harness](https://img.shields.io/badge/plugin-DeepSeek%20Harness-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)

Give [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) web search through your own self-hosted [SearXNG](https://github.com/searxng/searxng) instance.

✅ **No API key**
✅ **No per-search API cost**
✅ **Self-hosted & private** — queries go to *your* instance, nowhere else
✅ **Configure directly in DSH Settings** — *Settings → Plugins → SearXNG search*
✅ **Tested end-to-end against the official web search** — [no quality difference observed](docs/quality-benchmark.md)

![SearXNG settings card preview with grouped engine choices and a language dropdown](docs/settings-card.en.png)

*Preview of the SearXNG search card in Settings → Plugins — grouped engine choices and a result-language dropdown. Save to apply changes to the next search without a restart.*

## Quick Start

Prerequisite: DeepSeek Harness **0.2.1-alpha.2** with the standard Web/base bundles. No host patch is required. See [configuration and upgrade notes](docs/configuration.md).

**Version 0.3.0 automatically prepares and starts a local SearXNG service by default, without user-installed Docker or Python.** First use downloads a setup tool, isolated Python and search dependencies; the card shows progress. Existing endpoints or `SEARXNG_BASE_URL` continue using an external service. See [managed runtime notes](docs/managed-runtime.md).

**1. Install the plugin:**

```sh
dsh plugin --profile <name> add https://github.com/Chaos-Paradox/dsh-web-search-searxng
```

**2. Set your preferences:** open **Settings → Plugins → SearXNG search**, wait for Ready, choose engines and result language, and save. Use Test search to check returned sources. A free port is selected automatically, so no endpoint entry is needed; advanced settings allow a specific port. To use your own existing service, select Existing instance and enter its endpoint.

Installing appends a bundle layer that selects SearXNG by default. Higher-priority user configuration still wins. Failed searches report an error and make no official search request by default. **Official fallback is unavailable on unpatched DSH 0.2.1-alpha.2**, even if the checkbox is enabled; the card and host errors explain this limit. Disabling the entire bundle or uninstalling exposes the remaining route configuration, while saved instance settings stay in your profile.

## Why use it?

An AI assistant can't browse the web by itself — to let it look things up you normally pay for a hosted search API: billed per query, API key required, queries passing through someone else's servers. This plugin takes a different route: you run a small search relay (SearXNG) on your own machine, and it asks Google, Bing, and 70+ other engines at the same time, then hands the combined results to the agent.

| | Hosted search APIs | **This plugin** |
|---|---|---|
| Cost | Pay per query | **Free** — your instance, your hardware |
| API key | Required, rotates, leaks | **None** |
| Privacy | Queries go to a third party | Queries go to **your** SearXNG, which aggregates 70+ engines for you |
| Rate limit | Yes | Only what your instance allows |
| Works offline / intranet | No | Yes — loopback and private-network endpoints are supported by design |

## Benchmark

**Does answer quality drop?** We benchmarked it end-to-end — a real dsh agent answering with real `web_search` calls, same model and prompts on both sides, blinded judging: **no quality difference observed (two 10-question runs: 6-2-2 and 3-4-3 win/loss/tie; average scores ≈4.8 vs ≈4.4)**. Methodology, per-question data, and honest limitations: [docs/quality-benchmark.md](docs/quality-benchmark.md).

## Architecture

The plugin registers the `searxng` provider into `ctx.web`. Each search starts with `GET {baseURL}/search?format=json`. Optional official fallback requires both an explicit opt-in and a host exposing public `web.searchWithProvider` dispatch; the currently tested unpatched host has no such API.

```
┌─────────────┐   web search   ┌──────────────┐   JSON API   ┌────────────────┐
│  dsh agent  │ ─────────────▶ │ ctx.web seam │ ───────────▶ │ your SearXNG   │
│  (LLM)      │ ◀───────────── │  (searxng    │ ◀─────────── │ instance       │
└─────────────┘  sources only  │  provider)   │   results[]  └───────┬────────┘
                               └──────────────┘                      │ aggregates
                                                          ┌──────────▼──────────┐
                                                          │ Google / Bing / DDG │
                                                          │ Brave / 70+ engines │
                                                          └─────────────────────┘
```

SearXNG returns no generated answer, so results carry **sources only** — the agent reads the pages itself with `fetch` when it needs content. Each result maps to a citeable source:

| SearXNG field | dsh source field | Notes |
|---|---|---|
| `url` | `url` | entries without one are dropped |
| `title` | `title` | omitted when blank |
| `content` | `snippet` | the engine's excerpt |
| `publishedDate` | `publishedAt` | when the engine provides it |

`truncated` is always `false` (the web service owns `maxResults` truncation), and no generated `content` answer is attached because SearXNG has none the seam could vouch for.

## Security

- 🔒 **No credentials to leak** — the provider is credential-free by design.
- ⛔ **Redirects fail closed** — HTTP redirects raise `WEB_PROVIDER_ERROR`, so a redirect can never forward your query text to another origin.
- 🏠 **Self-host friendly** — loopback (`http://localhost:8080`), private IPs, and subpath mounts (`http://host/searxng`) all work; `/search` is appended correctly.
- 💬 **Actionable errors** — a 403 response tells you exactly that the instance's JSON format is disabled.

Redirect fail-closed and credential-free are design constraints, not missing features (see [Contributing](#contributing)).

## Configuration

### Requirements

- DeepSeek Harness **0.2.1-alpha.2** (the tested host), standard base/Web bundles, and the public `ctx.web` service. DSH peers declare `>=0.2.1-alpha.2 <0.3.0`; earlier releases are not supported. Client development dependencies are pinned to the same release train.
- Local management needs GitHub and PyPI access from the DSH backend. Dependencies are cached in the profile's `searxng/` directory for subsequent launches. Existing-instance mode needs a running service with **JSON output enabled**.
- The host's Node.js runtime must satisfy `^22.19 || >=24`; source development requires the same range.

### Optional: deploy an external SearXNG instance

Install and start [Docker](https://docs.docker.com/get-started/get-docker/) first. The following is a macOS/Linux shell example; Windows users can run it in WSL with Docker integration configured, or adapt it to native PowerShell syntax. Alternatively, follow the [official SearXNG container deployment guide](https://docs.searxng.org/admin/installation-docker.html) or connect to an existing remote instance.

```sh
mkdir -p searxng && cd searxng
cat > settings.yml <<'EOF'
use_default_settings: true
server:
  secret_key: "change-me-to-a-long-random-string"
search:
  formats:
    - html
    - json   # ← required by this plugin
EOF
docker run -d --name searxng -p 8080:8080 \
  -v "$PWD/settings.yml:/etc/searxng/settings.yml" \
  searxng/searxng
```

This section is for Existing instance mode; default local management needs none of these commands. `-d` runs the container in the background without an automatic restart policy in this example. External containers remain operator-managed; the plugin never starts or stops them. Managed local services follow the plugin/DSH lifecycle.

If host port `8080` is occupied, use `-p 8088:8080` and enter `http://localhost:8088` in the card; the right-hand side remains the container port. A directly launched source instance instead needs a `server.port` change and a service restart; see [configuration notes](docs/configuration.md#searxng-service-and-ports).

Verify JSON is enabled:

```sh
curl "http://localhost:8080/search?q=test&format=json"
```

### Operating systems and validation coverage

Local setup selects macOS, Windows and Linux glibc x64/arm64 bootstrap tools and uses public DSH subprocess APIs. **Local validation is on macOS. Repository CI runs unit tests and clean first-use setup on Windows, macOS and Linux; the actual run records determine validation status. A complete CPU architecture and Linux distribution matrix is not covered.** Other systems can use an external instance. DSH version compatibility needs separate checks.

| DSH host platform | SearXNG deployment options | Current validation |
|---|---|---|
| macOS | Managed local service or existing local/remote instance | DSH 0.2.1-alpha.2 verified |
| Windows | Managed local service or existing local/remote instance | CI configured; check actual run results |
| Linux | Managed local service (glibc) or existing local/remote instance | CI configured; check actual run results |

The endpoint must be reachable from the **DSH backend**. `localhost` means the backend's host or container; a browser on another computer does not make that computer the backend's `localhost`. A remote instance does not require every user to start SearXNG locally. For connection errors, check that the service is running and JSON is enabled, then check the card's endpoint.

### Install options

**From GitHub (tracks latest):**

```sh
dsh plugin --profile <name> add https://github.com/Chaos-Paradox/dsh-web-search-searxng
```

**Pin a release version (recommended for reproducibility):**

```sh
dsh plugin --profile <name> add https://github.com/Chaos-Paradox/dsh-web-search-searxng#v<version>
```

See all versions on the [Releases page](https://github.com/Chaos-Paradox/dsh-web-search-searxng/releases).

**From a local clone or tarball:** the same command takes an absolute path, e.g. `dsh plugin --profile <name> add /path/to/dsh-web-search-searxng`. No build step needed — `lib/` is committed.

The bundle registers SearXNG and overlays the complete `web.config` with `searchProvider: searxng` and `fetchProvider: http`. DSH replaces config objects instead of merging fields. Profile/home/CLI overrides retain higher priority; custom fetch providers in earlier bundle layers need a later complete Web config. Disabling/removing the bundle restores those earlier layers without writing a route into the user profile. Verify the import:

```sh
dsh plugin --profile <name> list        # dsh-web-search-searxng should appear

# disable the whole bundle — expose the remaining route, keep saved settings
dsh plugin --profile <name> disable dsh-web-search-searxng

# remove — expose the remaining route, keep saved settings
dsh plugin --profile <name> remove dsh-web-search-searxng
```

### 1. Point it at your instance

**Option A — GUI (recommended):** choose a service mode, engines and result language, then save. Local mode supplies its endpoint automatically. Port changes restart the local service; engine/language changes do not. Existing-instance mode accepts your own endpoint.

The engine list groups common candidates by purpose: web, news, research, and technology/reference. It is not a live inventory of your instance; chosen names must exist and be enabled there. No selection uses the instance defaults. Other engine names and language codes remain available through the custom options, and existing custom values are preserved when editing a list selection.

**Option B — environment variable** before launching dsh:

```sh
export SEARXNG_BASE_URL="http://localhost:8080"
```

| Field | GUI label | Env fallback | Description |
|---|---|---|---|
| `mode` | Service mode | — | `auto` preserves existing endpoints, otherwise manages locally; `local` forces local; `external` uses an existing service. |
| `managedPort` | Local port | — | Default `0` selects a free port; occupied explicit ports fail visibly. |
| `baseURL` | Instance endpoint | `SEARXNG_BASE_URL` | External instance base; managed local mode uses its effective endpoint. |
| `engines` | Engines / 引擎限制 | — | Grouped multi-select list; stored as comma-separated names, e.g. `bing,duckduckgo`. Custom names are supported. |
| `language` | Language / 结果语言 | — | Dropdown for common languages plus a custom-code option, e.g. `zh-CN`, `en`, `ja`. |

Search reports unavailable while preparing, stopped or failed, or when external mode has no endpoint. The card exposes status, retry and logs. Test search only calls SearXNG, never official fallback.

### 2. Optional official fallback

The checkbox is off by default. Unpatched DSH 0.2.1-alpha.2 offers `registerSearchProvider`, `registerFetchProvider`, `search` and `fetch`, but cannot dispatch to a different registered provider for one request. Enabling the saved option does not prevent plugin activation or successful SearXNG searches. When SearXNG fails, the error includes the primary failure, missing host capability, and confirmation that no official request was made. The host also warns when the option is enabled. Cancelling never triggers fallback.

A future or extended host must expose public `web.searchWithProvider(id, request, signal)` that checks registration and availability, honors disablement, caps results, and uses the provider’s existing configuration and logging. Only then can opt-in fallback dispatch once to `deepseek-official`. Attempts are logged before dispatch; successful fallback results carry a bilingual cost notice. The plugin never reads private registries, copies credentials, or constructs an official provider. An unready service remains unavailable, even with fallback enabled.

### 3. Disable, uninstall and retained settings

Disable the **entire dsh-web-search-searxng bundle**, using its installed-bundle switch or `dsh plugin --profile <name> disable dsh-web-search-searxng`; enable uses the corresponding `enable` command. With HMR, route changes apply live; without HMR, restart. Removal uses `dsh plugin --profile <name> remove dsh-web-search-searxng` (stop a running profile first for CLI removal). The remaining bundle/profile/home/CLI layers determine the restored route, including a custom earlier provider or later manual override. Re-enabling appends the bundle and may change precedence relative to other bundles.

**Disabling only the `web-search-searxng` provider row does not restore routing.** Its bundle still selects `searxng`, so searches fail visibly with `WEB_PROVIDER_CONFIGURED_MISSING`; they do not silently use paid search. Enable that row again, or disable the whole bundle.

Version 0.3.0 retires `configEffects`, the activation journal gate and the companion host patch. Installation no longer writes route ownership to the profile; removal no longer rolls back card settings or arbitrary pre-install field values. Endpoint, engines, language and fallback choices saved by the user stay in the profile for reinstallation. Read [upgrade notes](docs/configuration.md#upgrading-from-020) if an earlier patched installation left a journal or explicit SearXNG route.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `SearXNG error (HTTP 403); the instance may refuse JSON output` | `settings.yml` lacks `json` in `search.formats` | Add it as shown above and restart the container |
| Search fails with provider unavailable (`WEB_PROVIDER_CONFIGURED_UNAVAILABLE`) | Local service is preparing/stopped/failed, or external mode has no endpoint | Check card status and retry; configure an address for external mode |
| Search went to another provider | A later bundle or higher-priority profile/home/CLI config | Check `--dump-config` and your overrides |
| `search request failed` / ECONNREFUSED | Instance down or wrong port | Check `docker ps`, try the curl verify command; the tested host cannot provide official fallback |
| A search result opens with a ⚠️ fallback notice | An extended host supports official fallback and SearXNG just failed once | Check the instance; disable the fallback on the card to return to strict mode |
| `WEB_PROVIDER_ERROR` mentioning a redirect | A proxy in front of SearXNG redirects | Point `baseURL` at the final address; redirects fail closed by design |
| Empty `sources` | Engines returned nothing usable (or all entries lacked URLs) | Loosen `engines`, check the instance in a browser |

## Development

```sh
pnpm install        # dependencies come from npm (@deepseek-ai/* 0.2.1-alpha.2 train)
pnpm run build      # tsdown (host + browser bundles) + tsc (browser declarations)
pnpm test           # vitest: provider behavior, redirect policy, proxy egress, card form
pnpm run typecheck  # tsc --noEmit
DSH_SOURCE_ROOT=/path/to/deepseek-harness pnpm run test:host  # after build; unpatched built host
SEARXNG_BASE_URL=http://localhost:8080 pnpm run test:e2e    # opt-in real instance
pnpm run test:managed  # clean automatic setup, real search, restart and cleanup (network required)
```

```
src/
  index.ts      plugin entry: config schema, env fallback, provider registration
  provider.ts   SearxngSearchProvider: JSON API call, result mapping, error policy
  fallback.ts   opt-in official fallback: per-request degrade, bilingual notice, host log
  types.ts      SearXNG response types
  client/       browser bundle: the Settings → Plugins card (React)
tests/          vitest suites incl. redirect & egress policy
```

`lib/` is committed on purpose: installing from a git URL gives the consumer the built artifacts without a build step. **Rebuild and recommit `lib/` whenever `src/` changes.**

Known gap: the card's apply-level registration test lives upstream for now — the published `@deepseek-ai/dsh-client-test-runtime` references source files its npm package does not ship, so this repo keeps local stand-ins (`tests/helpers.ts`) for the two helpers the remaining card specs use.

## Known Limitations

- Only unpatched DSH 0.2.1-alpha.2 has been verified. Optional official fallback is unsupported there; the checkbox retains an explicit preference for hosts with the required public API.
- The route is a bundle default, not an enforced activation condition. Later configuration may select another provider while SearXNG is still registered.
- Overlays replace the entire Web config. Include both `searchProvider` and your desired `fetchProvider` in a custom override; a partial override can remove the explicit search route and cause ambiguity.
- Bundle disable/removal restores composition, not a historical snapshot. User settings remain. Individual provider-row disable fails search until the row or bundle configuration changes.

## Contributing

Issues and pull requests are welcome. Please keep the provider credential-free and fail-closed on redirects — those are design constraints, not missing features.

## License

[MIT](LICENSE) © [Chaos-Paradox](https://github.com/Chaos-Paradox)

## Links

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the host project
- [SearXNG](https://github.com/searxng/searxng) — the metasearch engine
- [SearXNG JSON format docs](https://docs.searxng.org/admin/settings/settings_search.html) — enabling `search.formats`
