import { readFileSync } from "node:fs";
import z from "@deepseek-ai/schemastery";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { WebError } from "@deepseek-ai/dsh-web";
//#region src/provider.ts
/**
* SearXNG metasearch through the instance's JSON API (`GET {baseURL}/search?format=json`).
* SearXNG is self-hosted, so the endpoint is deployment configuration — never a
* model-chosen value — and may legitimately be a loopback or private-network
* address. The provider carries no credentials; redirects fail as
* `WEB_PROVIDER_ERROR` so a redirect never forwards the query text to another
* origin.
* @module dsh-web-search-searxng/provider
*/
/** Stable id this provider registers under. */
const SEARXNG_PROVIDER_ID = "searxng";
/** Attribution header sent on every request. Bump with the package version. */
const USER_AGENT = "dsh-web-search-searxng/0.2.0";
/**
* Map one SearXNG result to a normalized source, or `undefined` when the entry
* carries no usable URL. Engines disagree on which fields they return, so
* `title`, `content` (as `snippet`), and `publishedDate` (as `publishedAt`)
* attach only when present and non-blank; a URL-only source stays valid because
* the seam's citation shape permits it.
*
* @param entry - one entry of SearXNG's `results[]`.
* @returns the normalized source, or `undefined` for an entry without a usable URL.
*/
function mapSearxngResult(entry) {
	if (typeof entry.url !== "string" || entry.url.trim().length === 0) return void 0;
	return {
		url: entry.url,
		...typeof entry.title === "string" && entry.title.length > 0 ? { title: entry.title } : {},
		...typeof entry.content === "string" && entry.content.trim().length > 0 ? { snippet: entry.content } : {},
		...typeof entry.publishedDate === "string" && entry.publishedDate.length > 0 ? { publishedAt: entry.publishedDate } : {}
	};
}
/**
* Map a SearXNG response envelope to a normalized search result. SearXNG
* returns no generated answer the seam could vouch for, so `content` is
* omitted. The web service owns the final `maxResults` truncation, so
* `truncated` is always `false` here.
*
* @param response - the parsed search response body.
* @returns the normalized result with URL-less entries dropped.
* @throws {@link WebError} when a present `results` field is not an array.
*/
function mapSearxngResponse(response) {
	if (response.results !== void 0 && !Array.isArray(response.results)) throw new WebError("SearXNG returned a malformed results field", "WEB_PROVIDER_ERROR");
	return {
		sources: (response.results ?? []).map(mapSearxngResult).filter((source) => source !== void 0),
		truncated: false
	};
}
/**
* The SearXNG-backed search provider. HTTP redirects fail as `WEB_PROVIDER_ERROR`;
* a 403 carries the JSON-format hint because instances commonly disable it.
*/
var SearxngSearchProvider = class {
	resolveOptions;
	id = SEARXNG_PROVIDER_ID;
	/**
	* @param resolveOptions - the options for the NEXT operation, snapshotted
	* once at each operation's entry so one search never mixes two sections. A
	* thunk rather than a value because the plugin's settings section can change
	* between searches, and re-registering the provider to carry a new endpoint
	* would make the seam's selection observable to the user as a flicker.
	*/
	constructor(resolveOptions) {
		this.resolveOptions = resolveOptions;
	}
	available() {
		const options = this.resolveOptions();
		return options.baseURL.length > 0 && URL.canParse(options.baseURL);
	}
	async search(request, signal) {
		const options = this.resolveOptions();
		const url = searchUrl(options.baseURL);
		url.searchParams.set("q", request.query);
		url.searchParams.set("format", "json");
		if (options.engines !== void 0 && options.engines.trim().length > 0) url.searchParams.set("engines", options.engines);
		if (options.language !== void 0 && options.language.trim().length > 0) url.searchParams.set("language", options.language);
		let response;
		try {
			response = await fetch(url, {
				method: "GET",
				redirect: "error",
				headers: {
					"accept": "application/json",
					"user-agent": USER_AGENT
				},
				...signal !== void 0 ? { signal } : {}
			});
		} catch (error) {
			if (signal?.aborted === true || isAbortError(error)) throw new WebError("SearXNG search aborted", "WEB_ABORTED", { cause: error });
			throw new WebError(`SearXNG search request failed: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
		if (!response.ok) {
			let message = `SearXNG error (HTTP ${response.status})`;
			if (response.status === 403) message += "; the instance may refuse JSON output — enable the \"json\" format in its search.formats setting";
			throw new WebError(message, "WEB_PROVIDER_ERROR");
		}
		try {
			return mapSearxngResponse(await response.json());
		} catch (error) {
			if (signal?.aborted === true || isAbortError(error)) throw new WebError("SearXNG search aborted", "WEB_ABORTED", { cause: error });
			const message = error instanceof WebError ? error.message : `SearXNG returned an unprocessable response body: ${String(error)}`;
			throw new WebError(message, "WEB_PROVIDER_ERROR", { cause: error });
		}
	}
};
/**
* Resolve the search endpoint under the configured base, preserving a subpath
* mount (`http://host/searxng` → `http://host/searxng/search`).
*
* @param baseURL - the configured instance base; `available()` guarantees it parses.
* @returns the absolute search URL without query parameters.
*/
function searchUrl(baseURL) {
	return new URL("search", baseURL.endsWith("/") ? baseURL : `${baseURL}/`);
}
/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error) {
	return error instanceof DOMException && error.name === "AbortError";
}
//#endregion
//#region src/fallback.ts
/**
* Opt-in official-route fallback. The default posture is strict: a failed
* SearXNG search fails loudly and the official route is never called, so an
* unnoticed failure cannot silently start billing the deployment. When the
* deployment explicitly enables `allowOfficialFallback`, one failed request
* degrades to the built-in DeepSeek provider for THAT REQUEST ONLY — the
* route itself never changes — and the result carries a bilingual notice so
* the model (and the user reading the tool output) sees that the fallback
* fired, why, and that extra cost may apply. Every degradation is recorded
* through the host logger with the actual provider and the failure reason.
* @module dsh-web-search-searxng/fallback
*/
/** Upper bound for the failure reason embedded in the model-visible notice. */
const REASON_MAX_CHARS = 200;
function aborted(signal) {
	return signal?.aborted === true;
}
/**
* Build the model-visible notice prepended to a degraded result's `content`.
* Bilingual on purpose: the notice feeds the model's tool result, and the
* model relays it to a user whose UI language this package cannot know.
* @param reason - the primary failure's message, truncated.
* @returns the notice text.
*/
function fallbackNotice(reason) {
	const trimmed = reason.length > REASON_MAX_CHARS ? `${reason.slice(0, REASON_MAX_CHARS)}…` : reason;
	return `⚠️ SearXNG search failed (${trimmed}); this request fell back to the official DeepSeek search — extra cost may apply, and the route itself was NOT changed.\n⚠️ SearXNG 搜索失败（${trimmed}），本次请求已降级到 DeepSeek 官方搜索——可能产生额外费用；路由本身未被更改。`;
}
/**
* The SearXNG provider with an opt-in per-request escape hatch. Registered
* under the SearXNG id: it IS the SearXNG route — the fallback never changes
* selection, it only answers one failed request through the official route
* when the deployment explicitly allowed it. Availability stays the primary's:
* an unconfigured endpoint means "search unavailable", never "silently serve
* everything from the official route".
*/
var SearxngFallbackProvider = class {
	primary;
	fallback;
	id = SEARXNG_PROVIDER_ID;
	/**
	* @param primary - the SearXNG provider every request tries first.
	* @param fallback - the per-request collaborators.
	*/
	constructor(primary, fallback) {
		this.primary = primary;
		this.fallback = fallback;
	}
	available() {
		return this.primary.available();
	}
	async search(request, signal) {
		try {
			return await this.primary.search(request, signal);
		} catch (error) {
			if (aborted(signal) || error instanceof WebError && error.code === "WEB_ABORTED") throw error;
			if (!this.fallback.enabled()) throw error;
			const official = await this.fallback.official();
			if (official === void 0 || !official.available()) throw error;
			const reason = error instanceof Error ? error.message : String(error);
			if (aborted(signal) || !this.fallback.enabled()) throw error;
			this.fallback.onAttempt(reason);
			let result;
			try {
				result = await official.search(request, signal);
			} catch (fallbackError) {
				if (aborted(signal) || fallbackError instanceof WebError && fallbackError.code === "WEB_ABORTED") throw fallbackError;
				const detail = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
				throw new WebError(`SearXNG search failed (${reason}); official fallback also failed (${detail}); the official attempt may incur search fees`, "WEB_PROVIDER_ERROR", { cause: fallbackError });
			}
			this.fallback.onDegraded({
				reason,
				at: (/* @__PURE__ */ new Date()).toISOString(),
				sources: result.sources.length
			});
			return {
				...result,
				content: `${fallbackNotice(reason)}\n\n${result.content ?? ""}`.trimEnd()
			};
		}
	}
};
/** Resolve an adapter to the host's registered official provider, never a new credentialed instance.
* Disabled, missing, or unavailable providers fail through the host's normal selection errors.
* @param ctx Plugin context supplying the web service.
* @returns Resolver for one official request without changing the default route.
*/
function createOfficialFallbackResolver(ctx) {
	return async () => {
		const web = ctx.web;
		if (typeof web.searchWithProvider !== "function") throw new WebError("Official fallback requires DSH host integration: web.searchWithProvider is unavailable", "WEB_PROVIDER_CONFIGURED_MISSING");
		const search = web.searchWithProvider.bind(web);
		return {
			id: "deepseek-official",
			available: () => true,
			search: (request, signal) => search("deepseek-official", request, signal)
		};
	};
}
//#endregion
//#region src/index.ts
/**
* Register a SearXNG-backed provider in `ctx.web`. It calls the instance's JSON
* search API (`GET {baseURL}/search?format=json`). The provider needs no API key;
* the instance base URL comes from the (volatile) config section or
* `$SEARXNG_BASE_URL`, and may be a loopback or private-network address because
* the deployment — not the model — chooses it.
* @module dsh-web-search-searxng
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "web-search-searxng";
/** The web seam this provider registers into. */
const inject = ["web"];
/**
* Environment variable naming the instance base URL. The deployment owns this
* endpoint: the provider sends model-chosen query text to it, so it must never
* come from model-visible input.
*/
const SEARXNG_BASE_URL_ENV = "SEARXNG_BASE_URL";
const Config = z.object({
	baseURL: z.string().volatile(),
	engines: z.string().volatile(),
	language: z.string().volatile(),
	allowOfficialFallback: z.boolean().volatile()
});
/**
* Project the currently resolved fields into the options the provider serves
* its next search with. Environment fallbacks stay here rather than in the
* provider: every value it reads is already fully resolved.
* @param ctx - plugin context supplying the launch environment.
* @param config - the volatile config fields the provider consumes.
* @returns options for one search.
*/
function resolveOptions(ctx, config) {
	return {
		baseURL: config.baseURL ?? launchEnvironmentOf(ctx).get(SEARXNG_BASE_URL_ENV)?.value ?? "",
		...config.engines !== void 0 && config.engines.trim().length > 0 ? { engines: config.engines } : {},
		...config.language !== void 0 && config.language.trim().length > 0 ? { language: config.language } : {}
	};
}
/** Marker comment of the host's journaled config-effects transaction in the profile patch. */
const JOURNAL_MARKER = "dsh-config-effects/v1: ";
/**
* Field-ownership fragment in the journal JSON: some bundle owns
* `web.searchProvider`. Ownership uniqueness is enforced host-side at
* reconcile time, so the gate does not care which package name owns it —
* fixture profiles and forks may mount this plugin under another name.
*/
const ROUTE_OWNER_FRAGMENT = "\"web\":{\"searchProvider\":{";
/**
* Why activation must refuse, or undefined when search is routed to the
* journaled SearXNG route. Pure so tests can drive it directly; apply()
* wires the loader's composed rows and the profile patch text into it.
* @param route - the effective `web` row's searchProvider value.
* @param patchText - the profile patch file's text, when readable.
* @returns the refusal message, or undefined to proceed.
*/
function activationGate(route, patchText) {
	if (patchText === void 0 || !patchText.includes(JOURNAL_MARKER) || !patchText.includes(ROUTE_OWNER_FRAGMENT)) return "web-search-searxng requires DSH bundle config-effects integration for default routing and uninstall restoration; apply host-integration/dsh-config-effects.patch before enabling this bundle";
	if (route !== "searxng") return `web-search-searxng expected the installed SearXNG route, but web.searchProvider is ${String(route)}; remove conflicting home/CLI overrides, or re-apply the bundle route by disabling and re-enabling the bundle (dsh plugin disable/enable or remove/add)`;
}
/** Register SearXNG with opt-in fallback and warn about a missing endpoint. */
function apply(ctx, config) {
	const profile = ctx.get("profileContext");
	let patchText;
	if (profile?.patchPath !== void 0) try {
		patchText = readFileSync(profile.patchPath, "utf8");
	} catch {
		patchText = void 0;
	}
	const route = [...ctx.get("loader")?.entries() ?? []].find((entry) => entry.options?.id === "web")?.options?.config?.searchProvider;
	const refusal = activationGate(route, patchText);
	if (refusal !== void 0) throw new Error(refusal);
	const provider = new SearxngSearchProvider(() => resolveOptions(ctx, {
		baseURL: config.baseURL.get(),
		engines: config.engines.get(),
		language: config.language.get()
	}));
	const routed = new SearxngFallbackProvider(provider, {
		enabled: () => config.allowOfficialFallback.get() === true,
		official: createOfficialFallbackResolver(ctx),
		onAttempt: (reason) => ctx.logger.warn("web-search-searxng: SearXNG search failed (%s); trying the user-enabled official fallback; search fees may apply", reason),
		onDegraded: (record) => ctx.logger.warn("web-search-searxng: SearXNG search failed (%s); served this one request through deepseek-official (%d sources) — extra cost may apply, and the route itself was not changed", record.reason, record.sources)
	});
	ctx.web.registerSearchProvider(routed);
	let warnedMissingEndpoint = false;
	const checkEndpoint = () => {
		if (!provider.available()) {
			if (warnedMissingEndpoint) return;
			warnedMissingEndpoint = true;
			ctx.logger.warn("web-search-searxng: search is routed to SearXNG, but no instance endpoint is configured, so every search will fail with the provider unavailable. Set the endpoint on the plugin card or export SEARXNG_BASE_URL, then save the settings.");
			return;
		}
		warnedMissingEndpoint = false;
	};
	checkEndpoint();
	ctx.on("loader/volatile-update", checkEndpoint);
}
//#endregion
export { Config, SEARXNG_PROVIDER_ID, SearxngFallbackProvider, SearxngSearchProvider, activationGate, apply, createOfficialFallbackResolver, fallbackNotice, inject, mapSearxngResponse, mapSearxngResult, name };
