window.__ModuleLoader__.load({
	id: "dsh-web-search-searxng",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/locales.ts
		/** English copy. */
		const en = {
			title: "SearXNG search",
			description: "Set up the self-hosted SearXNG search provider.",
			baseUrl: "Instance endpoint",
			baseUrlHint: "Leave blank to use the SEARXNG_BASE_URL environment variable; with neither set, search reports itself unavailable.",
			engines: "Engines",
			enginesHint: "Comma-separated engine names, e.g. bing,duckduckgo; leave blank to search every engine the instance enables in its settings.yml.",
			language: "Result language",
			languageHint: "For example zh-CN; leave blank for no language restriction (the instance default, usually \"all\").",
			overridden: "Overridden",
			reset: "Reset to default",
			readOnly: "This deployment stores settings read-only.",
			unavailable: "This plugin is not loaded, so it cannot be configured right now.",
			save: "Save",
			saving: "Saving…",
			saveFailed: "The deployment did not accept these values; they were left for you to correct.",
			invalidValue: "Enter text, or leave blank to use the default.",
			fallbackLabel: "Allow official fallback (may incur search fees)",
			fallbackHint: "Default off: SearXNG failures report a search error. Enable and save to try official DeepSeek search after a failed SearXNG request. Each fallback includes a cost notice; the next request still starts with SearXNG.",
			currentVersion: "Installed version",
			checkUpdate: "Check for updates",
			checkingUpdate: "Checking…",
			updateAvailable: "New version available:",
			updateReleases: "Release notes",
			updateHowTo: "To update: run dsh plugin --profile <name> update dsh-web-search-searxng (or uninstall and reinstall from the Plugins page), then restart.",
			updateLatest: "You are on the latest version.",
			updateFailed: "Could not reach the GitHub releases page right now; please try again later."
		};
		/** Simplified Chinese copy. */
		const zh = {
			title: "SearXNG 搜索",
			description: "设置自托管的 SearXNG 搜索提供方。",
			baseUrl: "实例地址",
			baseUrlHint: "留空则使用 SEARXNG_BASE_URL 环境变量；两者都未设置时搜索不可用。",
			engines: "引擎",
			enginesHint: "逗号分隔的引擎名，如 bing,duckduckgo；留空则搜索实例 settings.yml 中启用的全部引擎。",
			language: "结果语言",
			languageHint: "例如 zh-CN；留空则不限语言（使用实例默认，通常为 all）。",
			overridden: "已覆盖",
			reset: "恢复默认",
			readOnly: "本部署的设置为只读。",
			unavailable: "该插件当前未加载，暂时无法配置。",
			save: "保存",
			saving: "保存中…",
			saveFailed: "本部署没有接受这些值，已保留供你修改。",
			invalidValue: "请填文本；留空表示使用默认值。",
			fallbackLabel: "允许官方备用（可能产生搜索费用）",
			fallbackHint: "默认关闭：SearXNG 失败时明确报告搜索失败。勾选并保存后，失败的单次请求可改用 DeepSeek 官方搜索，并提示可能产生费用；下一次请求仍优先 SearXNG。",
			currentVersion: "当前版本",
			checkUpdate: "检查更新",
			checkingUpdate: "正在检查…",
			updateAvailable: "发现新版本：",
			updateReleases: "发布说明",
			updateHowTo: "更新方式：运行 dsh plugin --profile <名称> update dsh-web-search-searxng（或在插件页卸载后重装），然后重启。",
			updateLatest: "已是最新版本。",
			updateFailed: "暂时无法访问 GitHub 发布页，请稍后再试。"
		};
		/**
		* The form frame's copy, read from this page's dictionary.
		* @param t - the page's locale reader.
		* @returns the labels the shared settings form renders.
		*/
		function formLabels(t) {
			return {
				unavailable: t("unavailable"),
				readOnly: t("readOnly"),
				saveFailed: t("saveFailed"),
				save: t("save"),
				saving: t("saving")
			};
		}
		//#endregion
		//#region src/client/update-check.ts
		/**
		* Latest-release lookup behind the settings card's "check for updates" button.
		* The lookup fires only on an explicit click — the card renders and idles
		* without any network traffic, matching the provider's privacy posture.
		* @module dsh-web-search-searxng/client/update-check
		*/
		/**
		* This package's own version. Bump with package.json (the provider's
		* USER_AGENT follows the same rule).
		*/
		const CURRENT_VERSION = "0.2.0";
		/** GitHub repository hosting the plugin's releases. */
		const REPO = "Chaos-Paradox/dsh-web-search-searxng";
		/** Releases page the card links to for notes and manual updates. */
		const RELEASES_URL = `https://github.com/${REPO}/releases`;
		/** The latest release's lookup endpoint; api.github.com allows cross-origin reads. */
		const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
		/**
		* Compare two dotted numeric versions, ignoring a leading v.
		* @param a - one version, e.g. `v0.2.0` or `0.2.0`.
		* @param b - the other version.
		* @returns positive when `a` is newer, negative when older, zero when equal.
		*/
		function compareVersions(a, b) {
			const pa = a.replace(/^v/i, "").split(".");
			const pb = b.replace(/^v/i, "").split(".");
			for (let index = 0; index < Math.max(pa.length, pb.length); index += 1) {
				const na = Number.parseInt(pa[index] ?? "0", 10) || 0;
				const nb = Number.parseInt(pb[index] ?? "0", 10) || 0;
				if (na !== nb) return na - nb;
			}
			return 0;
		}
		/**
		* Ask GitHub for the latest release and compare it with the installed version.
		* Every failure — offline, rate-limited, no releases, a malformed body — folds
		* into `unknown` rather than throwing: the card only ever renders a hint.
		* @param fetchImpl - the fetch to use, injectable for tests.
		* @returns the comparison outcome.
		*/
		async function checkLatestRelease(fetchImpl = fetch) {
			try {
				const response = await fetchImpl(LATEST_RELEASE_URL, { headers: { accept: "application/vnd.github+json" } });
				if (!response.ok) return { kind: "unknown" };
				const body = await response.json();
				const tag = typeof body.tag_name === "string" ? body.tag_name : "";
				if (tag.length === 0) return { kind: "unknown" };
				return compareVersions(tag, "0.2.0") > 0 ? {
					kind: "newer",
					latest: tag.replace(/^v/i, "")
				} : { kind: "latest" };
			} catch {
				return { kind: "unknown" };
			}
		}
		//#endregion
		//#region src/client/SearxngSearchCard.tsx
		/** One row per section field, in page order. */
		const FIELDS = [
			{
				field: "baseURL",
				id: "plugin-config-web-search-searxng-endpoint",
				labelKey: "baseUrl",
				hintKey: "baseUrlHint"
			},
			{
				field: "engines",
				id: "plugin-config-web-search-searxng-engines",
				labelKey: "engines",
				hintKey: "enginesHint"
			},
			{
				field: "language",
				id: "plugin-config-web-search-searxng-language",
				labelKey: "language",
				hintKey: "languageHint"
			}
		];
		/**
		* Render the SearXNG search provider's one-liner or its settings form, as the Plugins page asks.
		* The fallback checkbox is staged with the other fields and takes effect on save.
		* Update checks run only on click.
		* @param props - the view asked for, locale copy, the form snapshot, and its actions.
		* @returns the one-liner, or the form.
		*/
		function SearxngSearchCard(props) {
			const { t } = props;
			const state = props.useSearxngSearchCard((snapshot) => snapshot);
			const [update, setUpdate] = (0, react.useState)({ checking: false });
			if (props.view === "summary") return t("description");
			const fallbackAllowed = state.allowOfficialFallback.text === "true";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.SettingsForm, {
				labels: formLabels(t),
				state,
				onSave: props.save,
				onDiscard: props.discard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 8
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: fallbackAllowed,
							disabled: !state.available || !state.writable || state.saving,
							onChange: (event) => props.edit("allowOfficialFallback", String(event.currentTarget.checked)),
							"aria-describedby": "searxng-fallback-hint"
						}), t("fallbackLabel")]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						id: "searxng-fallback-hint",
						children: t("fallbackHint")
					}),
					FIELDS.map(({ field, id, labelKey, hintKey }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsValueField, {
						id,
						label: t(labelKey),
						hint: t(hintKey),
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						invalidLabel: t("invalidValue"),
						disabled: !state.writable,
						...state[field],
						onEdit: (text) => {
							props.edit(field, text);
						},
						onReset: () => {
							props.resetField(field);
						}
					}, id))
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8,
					flexWrap: "wrap",
					marginTop: 12
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
						t("currentVersion"),
						": v",
						CURRENT_VERSION
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						size: "sm",
						disabled: update.checking,
						onClick: () => {
							setUpdate({ checking: true });
							checkLatestRelease().then((result) => setUpdate({
								checking: false,
								result
							}));
						},
						children: update.checking ? t("checkingUpdate") : t("checkUpdate")
					}),
					update.result?.kind === "newer" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
						t("updateAvailable"),
						" v",
						update.result.latest,
						" · ",
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							href: RELEASES_URL,
							target: "_blank",
							rel: "noreferrer",
							children: t("updateReleases")
						}),
						" · ",
						t("updateHowTo")
					] }),
					update.result?.kind === "latest" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("updateLatest") }),
					update.result?.kind === "unknown" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("updateFailed") })
				]
			})] });
		}
		//#endregion
		//#region src/client/searxng-search-card-controller.ts
		/**
		* Namespace of the SearXNG search provider. Spelled here rather than
		* imported: a client package must not depend on a Host package.
		*/
		const SEARXNG_SEARCH_NS = "web-search-searxng";
		/**
		* The official-fallback switch, staged as hidden text but stored as a
		* boolean. Both positions write an explicit value so an inherited `true`
		* cannot prevent the user from disabling paid fallback.
		* @param field - field name inside the namespace section.
		* @returns the field's conversion spec.
		*/
		function settingsSwitchField(field) {
			return {
				field,
				format: (value) => value === true ? "true" : "false",
				parse: (text) => ({
					kind: "set",
					value: text === "true"
				})
			};
		}
		/** Bridges the `web-search-searxng` scope onto the page. */
		var SearxngSearchCardController = class {
			form;
			store;
			/**
			* @param scope - the bound settings scope for the `web-search-searxng` namespace.
			*/
			constructor(scope) {
				this.form = new _deepseek_ai_dsh_client_ui_primitives.SettingsFormModel(scope, [
					(0, _deepseek_ai_dsh_client_ui_primitives.settingsTextField)("baseURL"),
					(0, _deepseek_ai_dsh_client_ui_primitives.settingsTextField)("engines"),
					(0, _deepseek_ai_dsh_client_ui_primitives.settingsTextField)("language"),
					settingsSwitchField("allowOfficialFallback")
				]);
				this.store = this.form.bind(() => this.projection());
			}
			projection() {
				return {
					...this.form.shell(),
					baseURL: this.form.field("baseURL"),
					engines: this.form.field("engines"),
					language: this.form.field("language"),
					allowOfficialFallback: this.form.field("allowOfficialFallback")
				};
			}
			/**
			* Build the face the page's slot registration injects.
			* @returns the page's snapshot and its form actions.
			*/
			inject() {
				return {
					hooks: { searxngSearchCard: this.store },
					...this.form.actions()
				};
			}
			/** Release configuration subscriptions. */
			dispose() {
				this.form.dispose();
			}
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.webSearchSearxng";
		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"locale",
			"configForms"
		];
		/**
		* Mount the SearXNG search settings page while the Host serves its namespace.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-settings-web-search-searxng: dictionaries");
			const card = new SearxngSearchCardController(ctx.configForms.get(SEARXNG_SEARCH_NS));
			ctx.effect(() => () => {
				card.dispose();
			}, "ui-settings-web-search-searxng: form subscription");
			ctx.effect(() => ctx.configForms.whileServed([SEARXNG_SEARCH_NS], () => ctx.slots.inject("plugins.item", () => ctx.slots.register({
				name: "plugins.item",
				id: "web-search-searxng",
				order: 41,
				label: () => t("title"),
				locale: NS,
				inject: () => card.inject()
			}, SearxngSearchCard))), "ui-settings-web-search-searxng: page");
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map