# Managed local runtime

English | [中文](managed-runtime.zh.md)

Plugin 0.3.0 defaults to `auto`: preserve an existing `baseURL` or `SEARXNG_BASE_URL`, otherwise prepare SearXNG locally. `local` forces local management; `external` connects to an existing instance. First use needs network access. The card displays preparation stages for the setup tool, SearXNG, Python and dependencies, then the active endpoint. Preparing local SearXNG requires no user-installed Docker, Python or Git, or terminal commands.

## Settings and use

Choose engines and result language and save; these preferences apply to the next request without restarting. The advanced local port defaults to `0`, allowing the OS to allocate an available port atomically at bind time. There is no fixed 8080 dependency or manual port-opening step. An occupied explicit port fails visibly without stopping its owner or falling back to another port. Set Local port back to `0` and save to restore automatic allocation. Saving a port change stops the old managed process, starts a new one, and updates the effective connection address without overwriting the external endpoint setting. A later launch may receive a different automatic port; the plugin follows it without manual endpoint edits.

For an installation that already has a saved `http://localhost:8080` endpoint, `auto` continues using that external instance. Select Managed local service (`local`) to switch to plugin ownership, leaving Local port at `0`. The old external service remains independently managed.

The card shows preparation, startup, readiness, stopped and failed states, with start/retry/restart, stop, test search and bounded diagnostic logs. Test search calls only SearXNG, never official fallback. Zero sources means a successful request with no sources, not demonstrated search quality. Searches fail explicitly while the service is unavailable. Unpatched DSH 0.2.1-alpha.2 cannot perform official fallback.

## Runtime and lifecycle

The profile's `searxng/` directory stores isolated Python, source, virtual environment, caches, a generated random secret and generated settings. System Python and PATH are unchanged. The six uv 0.13.0 platform archives and SearXNG revision `f4822b3fc46726bb259d14c6332b702c76b98f82` are checked against pinned SHA-256 hashes before extraction. Python 3.12.12 is managed and downloaded by uv. Python dependencies are installed through PyPI, with Waitress pinned to 3.0.2. Bootstrap and source versions are fixed per plugin release. Failed setup has no ready marker and can be retried; version directories remain reusable by earlier plugin releases.

The service binds only the DSH backend's `127.0.0.1`, using Waitress and a prebound socket. Search gets an endpoint only after checking the actual port and `/config` response. Public `ctx.subprocess` handles own processes. A profile file lock prevents duplicate owners. Unexpected exit triggers at most two automatic restarts. Configurable limits are `restartLimit` (0–10), `setupTimeoutMs` (default 600000) and `startupTimeoutMs` (default 120000). Failures remain visible for manual retry.

The service follows the enabled plugin and stays running between searches. Closing a browser tab does not stop the DSH backend or its service. Stop, switching to external mode, disabling the plugin or normal DSH backend shutdown awaits owned subprocess exit and releases the lock while retaining caches and preferences. DSH restart starts it again. No system startup service is registered. External mode never starts, stops or modifies the existing instance. Forced host termination relies on the DSH subprocess provider's cleanup, with stale-lock recovery; identical behavior for every OS termination mechanism is not guaranteed.

Cached launches avoid reinstalling the runtime; public web searches still require the selected upstream engines to be reachable over the network.

On Windows, setup applies a narrow compatibility patch after verifying the pinned source archive: the Valkey adapter treats Unix-only `pwd` account metadata as optional and uses an account-independent connection-error log. The patch validates the expected source before writing, and the ready marker includes its compatibility version. POSIX source behavior is unchanged. This is a plugin-maintained patch, not an upstream claim of Windows support.

## Platforms and validation

Bootstrap selection covers macOS/Windows/Linux glibc x64 and arm64. Unsupported systems report an error and can use an external instance. Local validation covers macOS arm64, unpatched DSH 0.2.1-alpha.2, clean downloads, real search, the full Web card, cached restart, stop and plugin teardown. On 2026-10-10, [GitHub Actions passed on Windows, macOS and Linux](https://github.com/Chaos-Paradox/dsh-web-search-searxng/actions/runs/38034853680), including unit tests, builds, clean service preparation, cached restart and cleanup. CI readiness tests do not depend on upstream engine results. A complete architecture/distribution matrix is not covered; Python and dependency availability on untested systems still needs validation. The declared DSH peer range is not a guarantee for every host version; only 0.2.1-alpha.2 was exercised.

After build, `pnpm run test:managed` uses shipped JS to prepare a real service in an empty temporary directory and checks sources, cached restart and cleanup, then deletes test data. `SEARXNG_SMOKE_SEARCH=0` limits the smoke to setup and lifecycle. See the repository's [validation notes](https://github.com/Chaos-Paradox/dsh-web-search-searxng/blob/main/docs/validation-managed-2026-10-10.md) for detailed results.

Upstreams: [uv Python management](https://docs.astral.sh/uv/guides/install-python/), [SearXNG source](https://github.com/searxng/searxng/tree/f4822b3fc46726bb259d14c6332b702c76b98f82), [Waitress](https://docs.pylonsproject.org/projects/waitress/en/latest/). Upstream licenses apply; downloaded SearXNG source retains its license file.
