window.__ModuleLoader__.load({
	id: "dsh-web-search-searxng",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/locales.ts
		/** English copy. */
		const en = {
			title: "SearXNG search",
			description: "Set up the self-hosted SearXNG search provider.",
			baseUrl: "Instance endpoint",
			baseUrlHint: "Leave blank to use the SEARXNG_BASE_URL environment variable.",
			engines: "Engines",
			enginesHint: "Comma-separated engine names; leave blank for the instance default.",
			language: "Result language",
			languageHint: "For example zh-CN; leave blank for the instance default.",
			overridden: "Overridden",
			reset: "Reset to default",
			readOnly: "This deployment stores settings read-only.",
			unavailable: "This plugin is not loaded, so it cannot be configured right now.",
			save: "Save",
			saving: "Saving…",
			saveFailed: "The deployment did not accept these values; they were left for you to correct.",
			invalidValue: "Enter text, or leave blank to use the default."
		};
		/** Simplified Chinese copy. */
		const zh = {
			title: "SearXNG 搜索",
			description: "设置自托管的 SearXNG 搜索提供方。",
			baseUrl: "实例地址",
			baseUrlHint: "留空则使用 SEARXNG_BASE_URL 环境变量。",
			engines: "引擎",
			enginesHint: "逗号分隔的引擎名；留空则使用实例默认配置。",
			language: "结果语言",
			languageHint: "例如 zh-CN；留空则使用实例默认。",
			overridden: "已覆盖",
			reset: "恢复默认",
			readOnly: "本部署的设置为只读。",
			unavailable: "该插件当前未加载，暂时无法配置。",
			save: "保存",
			saving: "保存中…",
			saveFailed: "本部署没有接受这些值，已保留供你修改。",
			invalidValue: "请填文本；留空表示使用默认值。"
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
		* @param props - the view asked for, locale copy, the form snapshot, and its actions.
		* @returns the one-liner, or the form.
		*/
		function SearxngSearchCard(props) {
			const { t } = props;
			const state = props.useSearxngSearchCard((snapshot) => snapshot);
			if (props.view === "summary") return t("description");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsForm, {
				labels: formLabels(t),
				state,
				onSave: props.save,
				onDiscard: props.discard,
				children: FIELDS.map(({ field, id, labelKey, hintKey }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsValueField, {
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
			});
		}
		//#endregion
		//#region src/client/searxng-search-card-controller.ts
		/**
		* Namespace of the SearXNG search provider. Spelled here rather than
		* imported: a client package must not depend on a Host package.
		*/
		const SEARXNG_SEARCH_NS = "web-search-searxng";
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
					(0, _deepseek_ai_dsh_client_ui_primitives.settingsTextField)("language")
				]);
				this.store = this.form.bind(() => this.projection());
			}
			projection() {
				return {
					...this.form.shell(),
					baseURL: this.form.field("baseURL"),
					engines: this.form.field("engines"),
					language: this.form.field("language")
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