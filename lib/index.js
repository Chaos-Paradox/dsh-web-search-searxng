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
const USER_AGENT = "dsh-web-search-searxng/0.1.0";
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
//#region src/index.ts
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
	language: z.string().volatile()
});
/**
* Project the currently resolved fields into the options the provider serves
* its next search with. Environment fallbacks stay here rather than in the
* provider: every value it reads is already fully resolved.
* @param ctx - plugin context supplying the launch environment.
* @param config - the volatile config fields.
* @returns options for one search.
*/
function resolveOptions(ctx, config) {
	return {
		baseURL: config.baseURL ?? launchEnvironmentOf(ctx).get(SEARXNG_BASE_URL_ENV)?.value ?? "",
		...config.engines !== void 0 && config.engines.trim().length > 0 ? { engines: config.engines } : {},
		...config.language !== void 0 && config.language.trim().length > 0 ? { language: config.language } : {}
	};
}
/** Register the SearXNG search provider with `ctx.web`. */
function apply(ctx, config) {
	ctx.web.registerSearchProvider(new SearxngSearchProvider(() => resolveOptions(ctx, {
		baseURL: config.baseURL.get(),
		engines: config.engines.get(),
		language: config.language.get()
	})));
}
//#endregion
export { Config, SEARXNG_PROVIDER_ID, SearxngSearchProvider, apply, inject, mapSearxngResponse, mapSearxngResult, name };
