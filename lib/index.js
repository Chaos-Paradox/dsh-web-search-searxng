import z from "@deepseek-ai/schemastery";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { WebError } from "@deepseek-ai/dsh-web";
import { join } from "node:path";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import lockfile from "proper-lockfile";
import { x } from "tar";
import { unzipSync } from "fflate";
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
const USER_AGENT = "dsh-web-search-searxng/0.3.0";
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
			let official;
			try {
				official = await this.fallback.official();
			} catch (resolutionError) {
				if (aborted(signal)) throw error;
				const detail = resolutionError instanceof Error ? resolutionError.message : String(resolutionError);
				throw new WebError(`SearXNG search failed (${error instanceof Error ? error.message : String(error)}); official fallback unavailable (${detail}); no official request was made`, "WEB_PROVIDER_ERROR", { cause: error });
			}
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
/** Detect the public API needed for fallback without accessing provider registries.
* @param web Host web service.
* @returns Whether explicit provider dispatch is available.
*/
function supportsOfficialFallback(web) {
	return "searchWithProvider" in web && typeof web.searchWithProvider === "function";
}
/** Resolve an adapter to the host's registered official provider, never a new credentialed instance.
* Disabled, missing, or unavailable providers fail through the host's normal selection errors.
* @param ctx Plugin context supplying the web service.
* @returns Resolver for one official request without changing the default route.
*/
function createOfficialFallbackResolver(ctx) {
	return async () => {
		const web = ctx.web;
		if (!supportsOfficialFallback(web)) throw new WebError("this host does not expose web.searchWithProvider; DSH 0.2.1-alpha.2 cannot perform official fallback", "WEB_PROVIDER_CONFIGURED_MISSING");
		const search = web.searchWithProvider.bind(web);
		return {
			id: "deepseek-official",
			available: () => true,
			search: (request, signal) => search("deepseek-official", request, signal)
		};
	};
}
//#endregion
//#region src/runtime-installer.ts
/** Pinned, verified bootstrap downloads; setup never changes system Python or PATH. */
const UV_VERSION = "0.13.0";
const SEARXNG_REVISION = "f4822b3fc46726bb259d14c6332b702c76b98f82";
const PYTHON_VERSION = "3.12.12";
const SOURCE_SHA256 = "a377e229d3f05bba445894f83c0d450093174201c416441b565c772787f85ffd";
const UV_ASSETS = {
	"darwin-arm64": {
		name: "uv-aarch64-apple-darwin.tar.gz",
		hash: "a9c1b29002cf3c83f07fa9cd8a887a3be0107d90e23189721221e7257db8e3d6"
	},
	"darwin-x64": {
		name: "uv-x86_64-apple-darwin.tar.gz",
		hash: "5f44dcbde809b632f47c36fadb241cb4d6f9af71d0c8f172b5d2026d3dde742c"
	},
	"linux-arm64": {
		name: "uv-aarch64-unknown-linux-gnu.tar.gz",
		hash: "3ccfb6af6e242433eb552f7d9676abd5412c6595c497e990d9c8cb7b5bd4d2c3"
	},
	"linux-x64": {
		name: "uv-x86_64-unknown-linux-gnu.tar.gz",
		hash: "1468ebd5a5541121837c5a2817b9972ba6090fa6caa3d142620850a47fb75154"
	},
	"win32-arm64": {
		name: "uv-aarch64-pc-windows-msvc.zip",
		hash: "cb54028b59aa87f11cf6dec293ce000420043a49a8aea522e822a671321f8932"
	},
	"win32-x64": {
		name: "uv-x86_64-pc-windows-msvc.zip",
		hash: "088962f9e7b7bd9ea740c04c650b2a21c8928c345bd99ac24350dc924dba656c"
	}
};
/** Resolve a supported uv binary without shell commands or OS path assumptions. */
function uvAsset(platform, arch) {
	const asset = UV_ASSETS[`${platform}-${arch}`];
	if (!asset) throw new Error(`Automatic setup is unavailable on ${platform}/${arch}; use an external instance`);
	return asset;
}
/** Download with cancellation, bounded size, and a pinned SHA-256 before extraction. */
async function verifiedDownload(url, hash, target, signal) {
	const response = await fetch(url, { signal });
	if (!response.ok || !response.body) throw new Error(`Runtime download failed: HTTP ${response.status}`);
	const chunks = [];
	let size = 0;
	for await (const chunk of response.body) {
		size += chunk.byteLength;
		if (size > 134217728) throw new Error("Runtime archive exceeds size limit");
		chunks.push(chunk);
	}
	const data = Buffer.concat(chunks);
	if (createHash("sha256").update(data).digest("hex") !== hash) throw new Error("Runtime archive checksum mismatch");
	signal.throwIfAborted();
	await writeFile(target, data);
}
/** Extract a pinned archive into a private staging directory; links are excluded. */
async function extractRuntimeArchive(archive, destination, uvOnly = false) {
	await mkdir(destination, { recursive: true });
	if (archive.endsWith(".zip")) {
		const entries = unzipSync(await readFile(archive), { filter: (file) => file.name === "uv.exe" || file.name.endsWith("/uv.exe") });
		const binary = Object.values(entries);
		if (binary.length !== 1) throw new Error("uv archive contains no unique executable");
		await writeFile(join(destination, "uv.exe"), binary[0]);
		return;
	}
	await x({
		file: archive,
		cwd: destination,
		strip: 1,
		strict: true,
		preservePaths: false,
		filter: (path, entry) => ("type" in entry ? entry.type !== "SymbolicLink" && entry.type !== "Link" : !entry.isSymbolicLink()) && (!uvOnly || path.endsWith("/uv"))
	});
	if (uvOnly) await chmod(join(destination, "uv"), 448);
}
/** Prepare a versioned, profile-owned runtime. Failed setup is retried without a ready marker. */
async function prepareRuntime(directory, command, signal, progress) {
	const asset = uvAsset(process.platform, process.arch);
	const base = join(directory, `runtime-${SEARXNG_REVISION.slice(0, 12)}-${UV_VERSION}-${PYTHON_VERSION}`);
	const source = join(base, "source");
	const python = join(base, "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
	const marker = join(base, "ready.json");
	try {
		const ready = JSON.parse(await readFile(marker, "utf8"));
		if (ready.revision === "f4822b3fc46726bb259d14c6332b702c76b98f82" && ready.python === "3.12.12" && ready.uv === "0.13.0") {
			await readFile(join(source, "searx", "webapp.py"));
			await readFile(python);
			return {
				python,
				source
			};
		}
	} catch {}
	await mkdir(base, {
		recursive: true,
		mode: 448
	});
	const uvArchive = join(base, asset.name);
	progress("uv");
	await verifiedDownload(`https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${asset.name}`, asset.hash, uvArchive, signal);
	await extractRuntimeArchive(uvArchive, join(base, "bootstrap"), true);
	const uv = join(base, "bootstrap", process.platform === "win32" ? "uv.exe" : "uv");
	progress("source");
	const sourceArchive = join(base, "source.tar.gz");
	await verifiedDownload(`https://codeload.github.com/searxng/searxng/tar.gz/${SEARXNG_REVISION}`, SOURCE_SHA256, sourceArchive, signal);
	await rm(source, {
		recursive: true,
		force: true
	});
	await extractRuntimeArchive(sourceArchive, source);
	const env = {
		UV_PYTHON_INSTALL_DIR: join(directory, "python"),
		UV_CACHE_DIR: join(directory, "uv-cache"),
		UV_PYTHON_INSTALL_BIN: "0",
		UV_NO_PROGRESS: "1",
		UV_PYTHON_PREFERENCE: "only-managed",
		UV_PYTHON_DOWNLOADS: "automatic",
		UV_NO_CONFIG: "1"
	};
	progress("python");
	await command([
		uv,
		"venv",
		"--python",
		PYTHON_VERSION,
		"--clear",
		join(base, "venv")
	], base, env, signal);
	progress("dependencies");
	await command([
		uv,
		"pip",
		"install",
		"--python",
		python,
		"-r",
		join(source, "requirements.txt"),
		"waitress==3.0.2"
	], source, env, signal);
	await command([
		python,
		"-c",
		"import flask, curl_cffi, lxml, waitress"
	], source, env, signal);
	await writeFile(`${marker}.tmp`, JSON.stringify({
		revision: SEARXNG_REVISION,
		python: PYTHON_VERSION,
		uv: UV_VERSION
	}));
	await rename(`${marker}.tmp`, marker);
	await rm(uvArchive, { force: true });
	await rm(sourceArchive, { force: true });
	return {
		python,
		source
	};
}
//#endregion
//#region src/managed-runtime.ts
/** Profile-owned SearXNG lifecycle using public DSH subprocess handles. */
const SERVER = `import socket, sys, json, os
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind(('127.0.0.1', int(sys.argv[1])))
sock.listen(128)
from searx.webapp import app
from waitress import serve
print('DSH_SEARXNG_READY ' + json.dumps({'port': sock.getsockname()[1]}), flush=True)
serve(app, sockets=[sock], threads=4)
`;
/** One manager owns one profile lock, subprocess range, and bounded log. */
var ManagedRuntime = class {
	directory;
	subprocess;
	prepare;
	state = {
		phase: "idle",
		endpoint: "",
		message: "",
		logs: ""
	};
	controller;
	operation = Promise.resolve();
	child;
	release;
	disposed = false;
	options;
	attempts = 0;
	constructor(directory, subprocess, prepare = prepareRuntime) {
		this.directory = directory;
		this.subprocess = subprocess;
		this.prepare = prepare;
	}
	/** Current immutable snapshot, including recent child output. */
	status() {
		const output = this.child ? this.output(this.child) : "";
		return {
			...this.state,
			logs: `${this.state.logs}\n${output}`.trim().slice(-12e3)
		};
	}
	/** Serialize configuration changes, cancelling preparation or startup already in progress. */
	start(options) {
		this.options = options;
		this.attempts = 0;
		this.controller?.abort();
		const controller = new AbortController();
		this.controller = controller;
		this.operation = this.operation.catch(() => {}).then(async () => {
			await this.stopChild();
			if (this.disposed || controller.signal.aborted) return;
			try {
				await this.launch(options, controller.signal);
			} catch (error) {
				await this.stopChild();
				if (!controller.signal.aborted) this.state = {
					...this.state,
					phase: "failed",
					endpoint: "",
					message: error instanceof Error ? error.message : String(error)
				};
			}
		});
		return this.operation;
	}
	/** Stop only this manager's process; the cached runtime and preferences remain. */
	stop() {
		this.options = void 0;
		this.controller?.abort();
		this.operation = this.operation.catch(() => {}).then(async () => {
			await this.stopChild();
			this.state = {
				...this.state,
				phase: "stopped",
				endpoint: "",
				message: ""
			};
		});
		return this.operation;
	}
	/** Cancel setup and await complete subprocess teardown before releasing ownership. */
	async dispose() {
		this.disposed = true;
		await this.stop();
	}
	output(child) {
		return [child.collected.stdout?.readFrom(0).text, child.collected.stderr?.readFrom(0).text].filter(Boolean).join("\n").slice(-12e3);
	}
	spawn(argv, cwd, env, signal) {
		return this.subprocess.spawn({
			argv,
			cwd,
			env,
			signal,
			graceMs: 3e3,
			stdio: {
				stdin: "ignore",
				stdout: { maxBytes: 16e3 },
				stderr: { maxBytes: 16e3 }
			}
		});
	}
	async launch(options, signal) {
		this.state = {
			phase: "preparing",
			endpoint: "",
			message: "",
			logs: ""
		};
		await mkdir(this.directory, {
			recursive: true,
			mode: 448
		});
		this.release = await lockfile.lock(this.directory, {
			realpath: false,
			stale: 6e4,
			update: 1e4,
			onCompromised: (error) => {
				this.state = {
					...this.state,
					phase: "failed",
					message: error.message
				};
				this.controller?.abort();
			}
		});
		const setupSignal = AbortSignal.any([signal, AbortSignal.timeout(options.setupTimeoutMs)]);
		const command = async (argv, cwd, env, commandSignal) => {
			const child = this.spawn(argv, cwd, env, commandSignal);
			this.child = child;
			try {
				const result = await child.done;
				this.state.logs = `${this.state.logs}\n${this.output(child)}`.slice(-12e3);
				commandSignal.throwIfAborted();
				if (result.exitCode !== 0) throw new Error(`Runtime setup failed (${result.exitCode}): ${this.output(child)}`);
			} finally {
				child.terminate();
				await child.waitForExit();
				if (this.child === child) this.child = void 0;
			}
		};
		const runtime = await this.prepare(this.directory, command, setupSignal, (message) => {
			this.state.message = message;
		});
		signal.throwIfAborted();
		const secretPath = join(this.directory, "secret");
		let secret;
		try {
			secret = await readFile(secretPath, "utf8");
		} catch {
			secret = randomBytes(32).toString("hex");
			await writeFile(secretPath, secret, { mode: 384 });
		}
		const settings = join(this.directory, "settings.yml");
		await writeFile(settings, `use_default_settings: true\nserver:\n  secret_key: ${JSON.stringify(secret)}\n  bind_address: 127.0.0.1\n  limiter: false\nsearch:\n  formats: [html, json]\n`, { mode: 384 });
		const script = join(this.directory, "serve.py");
		await writeFile(script, SERVER);
		this.state = {
			...this.state,
			phase: "starting",
			message: ""
		};
		const child = this.spawn([
			runtime.python,
			"-u",
			script,
			String(options.port)
		], runtime.source, {
			SEARXNG_SETTINGS_PATH: settings,
			PYTHONPATH: runtime.source,
			PYTHONUNBUFFERED: "1"
		}, signal);
		this.child = child;
		let exited = false;
		let failure = "";
		const onExit = (reason) => {
			exited = true;
			failure = reason;
			if (this.child === child && this.state.phase === "ready" && !signal.aborted && !this.disposed) {
				this.state = {
					...this.state,
					phase: "failed",
					endpoint: "",
					message: failure
				};
				if (this.options && this.attempts++ < this.options.restartLimit) this.restartAfterExit(this.options);
			}
		};
		child.done.then((result) => {
			onExit(`SearXNG exited (${result.exitCode}): ${this.output(child)}`);
		}, (error) => {
			onExit(String(error));
		});
		const startupSignal = AbortSignal.any([signal, AbortSignal.timeout(options.startupTimeoutMs)]);
		while (true) {
			startupSignal.throwIfAborted();
			if (exited) throw new Error(failure);
			const line = child.collected.stdout?.readFrom(0).text.match(/DSH_SEARXNG_READY (\{[^\n]+\})/);
			if (line) {
				const port = JSON.parse(line[1]).port;
				if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid managed SearXNG port");
				const endpoint = `http://127.0.0.1:${port}`;
				try {
					const health = await fetch(`${endpoint}/config`, {
						redirect: "error",
						signal: AbortSignal.any([startupSignal, AbortSignal.timeout(1500)])
					});
					const config = await health.json();
					if (health.ok && typeof config === "object" && config !== null && Array.isArray(Reflect.get(config, "engines"))) {
						this.state = {
							...this.state,
							phase: "ready",
							endpoint,
							message: ""
						};
						return;
					}
				} catch {
					startupSignal.throwIfAborted();
				}
			}
			await setTimeout(250, void 0, { signal: startupSignal });
		}
	}
	restartAfterExit(options) {
		this.operation = this.operation.catch(() => {}).then(async () => {
			await this.stopChild();
			if (this.disposed || this.options !== options) return;
			this.controller = new AbortController();
			try {
				await this.launch(options, this.controller.signal);
			} catch (error) {
				await this.stopChild();
				this.state = {
					...this.state,
					phase: "failed",
					endpoint: "",
					message: String(error)
				};
			}
		});
	}
	async stopChild() {
		const child = this.child;
		this.child = void 0;
		if (child) {
			this.state.logs = `${this.state.logs}\n${this.output(child)}`.slice(-12e3);
			child.terminate();
			await child.waitForExit();
		}
		const release = this.release;
		this.release = void 0;
		await release?.();
	}
};
//#endregion
//#region src/runtime-service.ts
/** Authenticated card controls and profile-scoped managed service selection. */
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** Controls are operator RPCs, never model tools. External services are never stopped. */
let SearxngRuntimeService = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _status_decorators;
	let _restart_decorators;
	let _stop_decorators;
	let _test_decorators;
	return class SearxngRuntimeService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_status_decorators = [Remote];
			_restart_decorators = [Remote];
			_stop_decorators = [Remote];
			_test_decorators = [Remote];
			__esDecorate(this, null, _status_decorators, {
				kind: "method",
				name: "status",
				static: false,
				private: false,
				access: {
					has: (obj) => "status" in obj,
					get: (obj) => obj.status
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _restart_decorators, {
				kind: "method",
				name: "restart",
				static: false,
				private: false,
				access: {
					has: (obj) => "restart" in obj,
					get: (obj) => obj.restart
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _stop_decorators, {
				kind: "method",
				name: "stop",
				static: false,
				private: false,
				access: {
					has: (obj) => "stop" in obj,
					get: (obj) => obj.stop
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _test_decorators, {
				kind: "method",
				name: "test",
				static: false,
				private: false,
				access: {
					has: (obj) => "test" in obj,
					get: (obj) => obj.test
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		options = __runInitializers(this, _instanceExtraInitializers);
		provider;
		manager;
		key = "";
		local = false;
		error = "";
		disposed = false;
		subprocess;
		constructor(ctx, options, provider) {
			super(ctx, "searxngRuntime");
			this.options = options;
			this.provider = provider;
			ctx.effect(() => async () => {
				this.disposed = true;
				await this.manager?.dispose();
			}, "SearXNG owned process");
			ctx.inject(["subprocess"], (ctx) => {
				this.subprocess = ctx.subprocess;
				this.key = "";
				this.sync();
				ctx.effect(() => async () => {
					const manager = this.manager;
					this.manager = void 0;
					this.subprocess = void 0;
					this.key = "";
					await manager?.dispose();
				}, "SearXNG subprocess dependency");
			});
		}
		/** Reconcile only service settings; engine/language writes do not restart the process. */
		sync(force = false) {
			if (this.disposed) return;
			const options = this.options();
			const local = options.mode === "local" || options.mode === "auto" && !options.externalURL.trim();
			const key = JSON.stringify({
				local,
				port: options.port,
				setupTimeoutMs: options.setupTimeoutMs,
				startupTimeoutMs: options.startupTimeoutMs,
				restartLimit: options.restartLimit
			});
			if (!force && key === this.key) return;
			this.key = key;
			this.local = local;
			this.error = "";
			if (!local) {
				this.manager?.stop();
				return;
			}
			if (!this.manager) {
				const profile = this.ctx.get("profileContext");
				if (!profile) {
					this.error = "Local management requires a DSH profile; configure an external instance instead";
					return;
				}
				if (!this.subprocess) return;
				this.manager = new ManagedRuntime(join(profile.dir, "searxng"), this.subprocess);
			}
			this.manager.start(options);
		}
		/** Only a ready owned service may supply a managed endpoint. */
		endpoint() {
			if (!this.local) return this.options().externalURL;
			const status = this.manager?.status();
			return status?.phase === "ready" ? status.endpoint : "";
		}
		/** Return setup, readiness and bounded diagnostic output to the operator card. */
		status() {
			if (!this.local) return {
				phase: "external",
				endpoint: this.options().externalURL,
				message: "",
				logs: ""
			};
			if (this.error) return {
				phase: "failed",
				endpoint: "",
				message: this.error,
				logs: ""
			};
			return this.manager?.status() ?? {
				phase: "idle",
				endpoint: "",
				message: "Waiting for the DSH subprocess service",
				logs: ""
			};
		}
		/** Retry failed setup or restart this plugin's local service, preserving configuration. */
		restart() {
			this.sync(true);
			return this.status();
		}
		/** Stop this plugin's local process; external instances are unaffected. */
		async stop() {
			if (this.local) await this.manager?.stop();
			return this.status();
		}
		/** Test the selected SearXNG endpoint without invoking official fallback. */
		async test(signal) {
			return (await this.provider.search({
				query: "SearXNG",
				maxResults: 3
			}, signal)).sources.length;
		}
	};
})();
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
	mode: z.union([
		"auto",
		"local",
		"external"
	]).volatile(),
	managedPort: z.natural().max(65535).default(0).volatile(),
	setupTimeoutMs: z.natural().min(1e3).max(2147483647).default(6e5).volatile(),
	startupTimeoutMs: z.natural().min(1e3).max(2147483647).default(12e4).volatile(),
	restartLimit: z.natural().max(10).default(2).volatile(),
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
/** Register SearXNG with opt-in fallback and warn about a missing endpoint. */
function apply(ctx, config) {
	let runtime;
	const provider = new SearxngSearchProvider(() => {
		const options = resolveOptions(ctx, {
			baseURL: config.baseURL.get(),
			engines: config.engines.get(),
			language: config.language.get()
		});
		return {
			...options,
			baseURL: runtime?.endpoint() ?? options.baseURL
		};
	});
	runtime = new SearxngRuntimeService(ctx, () => ({
		mode: config.mode.get() ?? "auto",
		externalURL: config.baseURL.get() ?? launchEnvironmentOf(ctx).get(SEARXNG_BASE_URL_ENV)?.value ?? "",
		port: config.managedPort.get(),
		setupTimeoutMs: config.setupTimeoutMs.get(),
		startupTimeoutMs: config.startupTimeoutMs.get(),
		restartLimit: config.restartLimit.get()
	}), provider);
	runtime.sync();
	ctx.on("loader/volatile-update", () => {
		runtime?.sync();
	});
	const routed = new SearxngFallbackProvider(provider, {
		enabled: () => config.allowOfficialFallback.get() === true,
		official: createOfficialFallbackResolver(ctx),
		onAttempt: (reason) => ctx.logger.warn("web-search-searxng: SearXNG search failed (%s); trying the user-enabled official fallback; search fees may apply", reason),
		onDegraded: (record) => ctx.logger.warn("web-search-searxng: SearXNG search failed (%s); served this one request through deepseek-official (%d sources) — extra cost may apply, and the route itself was not changed", record.reason, record.sources)
	});
	ctx.web.registerSearchProvider(routed);
	let warnedMissingEndpoint = false;
	let warnedFallback = false;
	const checkEndpoint = () => {
		const unsupportedFallback = config.allowOfficialFallback.get() === true && !supportsOfficialFallback(ctx.web);
		if (unsupportedFallback && !warnedFallback) ctx.logger.warn("web-search-searxng: official fallback is enabled but this host has no public web.searchWithProvider API; SearXNG remains usable, and failed searches make no official request");
		warnedFallback = unsupportedFallback;
		if (!provider.available() && runtime?.status().phase === "external") {
			if (warnedMissingEndpoint) return;
			warnedMissingEndpoint = true;
			ctx.logger.warn("web-search-searxng: no instance endpoint is configured, so searches routed to SearXNG will fail with the provider unavailable. Set the endpoint on the plugin card or export SEARXNG_BASE_URL, then save the settings.");
			return;
		}
		warnedMissingEndpoint = false;
	};
	checkEndpoint();
	ctx.on("loader/volatile-update", checkEndpoint);
}
//#endregion
export { Config, SEARXNG_PROVIDER_ID, SearxngFallbackProvider, SearxngSearchProvider, apply, createOfficialFallbackResolver, fallbackNotice, inject, mapSearxngResponse, mapSearxngResult, name, supportsOfficialFallback };
