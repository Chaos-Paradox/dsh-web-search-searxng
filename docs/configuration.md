# Configuration and upgrading

English | [中文](configuration.zh.md)

## Supported composition

Version 0.3.0 is tested against unpatched DSH 0.2.1-alpha.2 with standard base/Web bundles. The bundle must follow the layer declaring `id: web`. It replaces the complete Web config with `searchProvider: searxng` and `fetchProvider: http`, inserts the provider, and defaults `allowOfficialFallback` to false. It never writes a route into the user profile. Direct `ctx.plugin()` use only registers the provider: the caller must configure `WebRuntime` routing itself.

DSH applies bundle layers in `dsh.profile.bundles` order, then profile, home, and CLI overlays. Later layers win and replace the entire config object. A profile with a custom fetch provider should contain this complete override:

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

The custom fetch provider must already be registered. An intentional `searchProvider: deepseek-official` override wins without preventing SearXNG activation. A partial `web.config` can drop the explicit search route and make multiple usable providers ambiguous. `DSH_WEB_*_PROVIDER` values only apply when the corresponding explicit field is absent. Inspect `dsh --profile <name> --dump-config` to see the effective composition; it may contain secrets, so do not share it unredacted.

## Lifecycle

Managed local mode prepares and starts the service with the plugin; disabling or removing it stops the owned service and retains caches. External mode does not manage instance processes. The card exposes connection, port, preferences and service controls; see [managed runtime notes](managed-runtime.md).

Bundle enable/disable changes the ordered manifest list. Disable the whole installed bundle to restore routing; with HMR the remaining composition applies live, otherwise restart. Individual provider-row disable leaves the route selected and searches fail visibly. Removal also exposes the remaining layers, including custom earlier defaults and current user overrides. CLI removal requires the profile process to be stopped; the running Plugins page can remove bundles live with HMR.

Card writes are normal user settings. Endpoint, engines, language and fallback preference stay in the profile after bundle disable/removal and become available on reinstallation. Restoration means resolving the remaining configuration today; no pre-install snapshot or field ownership transaction is maintained. Re-enabling appends the bundle, so another bundle's relative priority may change. A higher home/CLI settings override can make a card write fail; the host preserves the previous profile values in that case.

## SearXNG service and ports

Managed local mode selects a free port automatically. Changing the advanced `managedPort` setting restarts the service and updates its effective endpoint. External instances require changing their own listener/container mapping and then updating `baseURL`; an endpoint change alone cannot change their port. Each search reuses the running service.

Version 0.3.0 uses persistent profile caches and follows DSH startup/shutdown without installing a system startup service. The manually started `/tmp` instance from 0.2.1 validation is historical test infrastructure, not the new managed runtime.

## Official fallback capability

Default false and cancellation make no official request. Unpatched DSH 0.2.1-alpha.2 cannot perform per-request official fallback: its `search()` uses the selected SearXNG route, and calling it again would recurse. The plugin accesses no private registry and creates no credentialed official provider.

An extended host must expose public `web.searchWithProvider(id, request, signal)` with registration/availability checks, disablement, existing provider configuration/logging and result limits. Explicitly enabling fallback then permits one official attempt after a primary failure. Attempt and degradation logs plus a bilingual result notice disclose cost. On an unsupported host, activation and successful SearXNG search continue; failed opted-in searches report both the primary failure and capability limit with no official dispatch. The checkbox remains editable so an inherited true can be explicitly disabled.

## Upgrading from 0.2.0

Back up the profile's `package.json`, lockfile and `cordis.patch.yml` before installing 0.3.0. An unpatched installation that only failed the old activation gate can install the new package directly. No ledger is required.

If an old patched host wrote `dsh-config-effects/v1` and an explicit SearXNG route into the profile, first disable/remove the old bundle through that matching host so its journal can restore owned values. Then install 0.3.0 on current mainline. If that host is unavailable, keep a backup and manually review only the old route/settings overrides and journal before removing obsolete ownership; preserve intended user overrides and all model/credential settings. This release cannot infer a historical route or roll back a legacy journal on an unpatched host.

The removed promises are activation-enforced routing, automatic preservation of every earlier fetch field, field-level uninstall rollback, and official fallback on unpatched mainline. The replacement promises are a bundle routing default, higher-priority user configuration, restoration by layer removal, retained user settings, and explicit failure without unapproved paid search.

## Regression checks

`pnpm run build` prepares committed `lib/`. `DSH_SOURCE_ROOT=/path/to/deepseek-harness pnpm run test:host` uses that artifact with a built, unpatched 0.2.1-alpha.2 checkout. It exercises real profile loading, runtime package resolution, Include, Loader, WebRuntime, settings writes, HMR and bundle management. A local JSON endpoint and registered official probe supply deterministic HTTP sources and count official-route attempts. This is separate from live upstream-engine validation, which runs with `SEARXNG_BASE_URL=... pnpm run test:e2e`.
