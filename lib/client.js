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
			modeLabel: "Service mode",
			modeAuto: "Automatic",
			modeLocal: "Managed local service",
			modeExternal: "Existing instance",
			modeHint: "Automatic uses your existing endpoint/environment setting when present; otherwise it prepares a local service. Local mode requires no Docker or system Python. Save to apply.",
			advanced: "Advanced settings",
			managedPort: "Local port",
			managedPortHint: "0 automatically selects an available port. A specific occupied port reports an error. Saving a change restarts the local service.",
			serviceTitle: "Search service",
			serviceIdle: "Waiting",
			servicePreparing: "Preparing first-use runtime",
			serviceStarting: "Starting",
			serviceReady: "Ready",
			serviceStopped: "Stopped",
			serviceFailed: "Failed",
			serviceExternal: "Using existing instance",
			activeEndpoint: "Active endpoint",
			serviceHint: "Local setup downloads pinned dependencies on first use. The local service follows DSH and stops when the plugin is disabled or DSH exits. Existing instances remain independently managed.",
			serviceRestart: "Start / retry / restart",
			serviceStop: "Stop",
			serviceTest: "Test search",
			serviceTestResult: "Search succeeded; sources returned",
			serviceLogs: "Diagnostic log",
			setupUv: "Downloading setup tool",
			setupSource: "Downloading SearXNG",
			setupPython: "Preparing Python",
			setupDependencies: "Installing dependencies",
			baseUrl: "Instance endpoint",
			baseUrlHint: "Existing-instance mode uses this address, or SEARXNG_BASE_URL when blank. Automatic mode prepares a local service when neither is set.",
			engines: "Engines",
			enginesHint: "Choose multiple engines. These are common candidates, not a live list from your instance; names must exist and be enabled in your SearXNG configuration.",
			enginesDefault: "No restriction: use the instance’s default engines.",
			enginesSelected: "Search only the selected engines.",
			enginesWeb: "Web · websites and general information",
			enginesNews: "News · reporting and current events",
			enginesScience: "Research · papers and preprints",
			enginesKnowledge: "Technology and reference · repositories, Q&A and encyclopedias",
			enginesCustom: "Other engines (custom names)",
			enginesCustomNames: "Custom engine names",
			enginesCustomHint: "Use the exact names from your instance, separated by commas. List selections are preserved.",
			enginesCustomSelected: "Also selected",
			language: "Result language",
			languageHint: "Choose a preferred result language; instance default inherits your deployment configuration. Other languages can use a custom code.",
			languageDefault: "Instance default",
			languageAll: "All languages",
			languageZhCN: "Simplified Chinese (zh-CN)",
			languageZhTW: "Traditional Chinese (zh-TW)",
			languageEn: "English (en)",
			languageJa: "Japanese (ja)",
			languageKo: "Korean (ko)",
			languageFr: "French (fr)",
			languageDe: "German (de)",
			languageEs: "Spanish (es)",
			languageRu: "Russian (ru)",
			languageCustom: "Other language (custom code)",
			languageCustomCode: "Custom language code",
			overridden: "Overridden",
			reset: "Reset to default",
			readOnly: "This deployment stores settings read-only.",
			unavailable: "This plugin is not loaded, so it cannot be configured right now.",
			save: "Save",
			saving: "Saving…",
			saveFailed: "The deployment did not accept these values; they were left for you to correct.",
			invalidValue: "Enter text, or leave blank to use the default.",
			fallbackLabel: "Allow official fallback (may incur search fees)",
			fallbackHint: "Default off. DSH 0.2.1-alpha.2 has no official fallback API: enabling this option cannot start an official search, and failures report that limitation. A host with public searchWithProvider support can reuse its registered official provider after a failure; fees may apply. Cancellation never starts fallback.",
			routeHint: "This bundle selects SearXNG unless a later bundle, profile, home or CLI config overrides it. Disable the entire dsh-web-search-searxng bundle to restore the remaining route. Disabling only its provider row leaves the SearXNG route selected and searches fail. Saved instance settings are retained.",
			resetAll: "Reset all to defaults",
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
			modeLabel: "服务模式",
			modeAuto: "自动选择",
			modeLocal: "本地自动托管",
			modeExternal: "连接已有实例",
			modeHint: "自动选择会沿用已填写的地址或环境变量；没有地址时自动准备本地服务。本地托管无需 Docker 或系统 Python，保存后生效。",
			advanced: "高级设置",
			managedPort: "本地端口",
			managedPortHint: "0 表示自动选择空闲端口。指定的端口被占用时会报错；保存端口修改会自动重启本地服务。",
			serviceTitle: "搜索服务",
			serviceIdle: "等待中",
			servicePreparing: "首次准备运行环境",
			serviceStarting: "正在启动",
			serviceReady: "可用",
			serviceStopped: "已停止",
			serviceFailed: "失败",
			serviceExternal: "使用已有实例",
			activeEndpoint: "当前地址",
			serviceHint: "本地服务首次使用会下载固定版本的依赖，随 DSH 运行，禁用插件或退出 DSH 时停止。已有实例由其部署者独立管理。",
			serviceRestart: "启动 / 重试 / 重启",
			serviceStop: "停止",
			serviceTest: "测试搜索",
			serviceTestResult: "搜索成功，返回来源数",
			serviceLogs: "诊断日志",
			setupUv: "正在下载安装工具",
			setupSource: "正在下载 SearXNG",
			setupPython: "正在准备 Python",
			setupDependencies: "正在安装依赖",
			baseUrl: "实例地址",
			baseUrlHint: "已有实例模式使用此地址，留空则使用 SEARXNG_BASE_URL；自动选择模式下，两者都未设置时自动准备本地服务。",
			engines: "引擎",
			enginesHint: "可多选。这里是常用候选，并非实例的实时清单；引擎名须在你的 SearXNG 配置中存在且已启用。",
			enginesDefault: "未限制引擎：使用实例默认配置。",
			enginesSelected: "仅搜索勾选的引擎。",
			enginesWeb: "通用网页 · 网站与综合资料",
			enginesNews: "新闻资讯 · 报道与近期事件",
			enginesScience: "学术研究 · 论文与预印本",
			enginesKnowledge: "技术与百科 · 代码仓库、问答与百科资料",
			enginesCustom: "其他引擎（自定义名称）",
			enginesCustomNames: "自定义引擎名称",
			enginesCustomHint: "填写实例中的准确名称，多个名称用逗号分隔；列表中勾选的引擎会保留。",
			enginesCustomSelected: "另外已选择",
			language: "结果语言",
			languageHint: "选择偏好的结果语言；「实例默认」沿用部署配置，其他语言可填写自定义代码。",
			languageDefault: "实例默认",
			languageAll: "不限语言",
			languageZhCN: "简体中文（zh-CN）",
			languageZhTW: "繁体中文（zh-TW）",
			languageEn: "英语（en）",
			languageJa: "日语（ja）",
			languageKo: "韩语（ko）",
			languageFr: "法语（fr）",
			languageDe: "德语（de）",
			languageEs: "西班牙语（es）",
			languageRu: "俄语（ru）",
			languageCustom: "其他语言（自定义代码）",
			languageCustomCode: "自定义语言代码",
			overridden: "已覆盖",
			reset: "恢复默认",
			readOnly: "本部署的设置为只读。",
			unavailable: "该插件当前未加载，暂时无法配置。",
			save: "保存",
			saving: "保存中…",
			saveFailed: "本部署没有接受这些值，已保留供你修改。",
			invalidValue: "请填文本；留空表示使用默认值。",
			fallbackLabel: "允许官方备用（可能产生搜索费用）",
			fallbackHint: "默认关闭。DSH 0.2.1-alpha.2 没有官方备用接口：勾选后也不会发起官方搜索，失败时会明确提示此限制。支持公开 searchWithProvider 的宿主可在失败后复用已注册的官方提供方，可能产生费用。取消请求不会启动备用。",
			routeHint: "此 bundle 默认选择 SearXNG，后续 bundle、profile、home 或 CLI 配置可覆盖路由。请禁用整个 dsh-web-search-searxng bundle 来恢复其余配置决定的路由；仅禁用提供方行会留下 SearXNG 路由并导致搜索失败。已保存的实例设置会保留。",
			resetAll: "全部恢复默认",
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
		//#region src/client/SearchChoiceFields.tsx
		/** List controls over the existing staged engine and language string fields. */
		/** Common names from https://docs.searxng.org/user/configured_engines.html; instance configuration determines availability. */
		const ENGINE_GROUPS = [
			{
				label: "enginesWeb",
				engines: [
					["google", "Google"],
					["google cse", "Google CSE"],
					["bing", "Bing"],
					["duckduckgo", "DuckDuckGo"],
					["brave", "Brave"],
					["yahoo", "Yahoo"]
				]
			},
			{
				label: "enginesNews",
				engines: [["google news", "Google News"], ["bing news", "Bing News"]]
			},
			{
				label: "enginesScience",
				engines: [
					["google scholar", "Google Scholar"],
					["arxiv", "arXiv"],
					["semantic scholar", "Semantic Scholar"]
				]
			},
			{
				label: "enginesKnowledge",
				engines: [
					["github", "GitHub"],
					["stackoverflow", "Stack Overflow"],
					["wikipedia", "Wikipedia"]
				]
			}
		];
		const ENGINE_NAMES = new Set(ENGINE_GROUPS.flatMap((group) => group.engines.map(([name]) => name)));
		const LANGUAGES = [
			["", "languageDefault"],
			["all", "languageAll"],
			["zh-CN", "languageZhCN"],
			["zh-TW", "languageZhTW"],
			["en", "languageEn"],
			["ja", "languageJa"],
			["ko", "languageKo"],
			["fr", "languageFr"],
			["de", "languageDe"],
			["es", "languageEs"],
			["ru", "languageRu"]
		];
		const LANGUAGE_CODES = new Set(LANGUAGES.map(([code]) => code));
		const CUSTOM_LANGUAGE = "__custom_language__";
		/** Preserve custom engine names, including names containing spaces, when editing a selection. */
		function engineNames(text) {
			return [...new Set(text.split(",").map((name) => name.trim()).filter(Boolean))];
		}
		function ChoiceField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
				disabled: props.disabled,
				"aria-label": props.t(props.label),
				"aria-describedby": `searxng-${props.label}-hint`,
				style: {
					border: 0,
					padding: 0,
					margin: 0,
					minWidth: 0
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("legend", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 8,
							marginBottom: 8
						},
						children: [props.t(props.label), props.state.overridden && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
							tone: "neutral",
							children: props.t("overridden")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							disabled: props.disabled,
							onClick: props.onReset,
							children: props.t("reset")
						})] })]
					}),
					props.children,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						id: `searxng-${props.label}-hint`,
						style: {
							fontSize: 12,
							opacity: .7
						},
						children: props.t(props.state.invalid ? "invalidValue" : props.hint)
					})
				]
			});
		}
		/** Engine checkboxes grouped by search purpose; custom selections survive every list edit. */
		function EngineChoiceField(props) {
			const [customDraft, setCustomDraft] = (0, react.useState)(null);
			const selected = engineNames(props.state.text);
			const custom = selected.filter((name) => !ENGINE_NAMES.has(name));
			const toggle = (name, checked) => {
				props.onEdit((checked ? [...selected, name] : selected.filter((value) => value !== name)).join(","));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ChoiceField, {
				...props,
				label: "engines",
				hint: "enginesHint",
				onReset: () => {
					setCustomDraft(null);
					props.onReset();
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: {
							marginTop: 0,
							fontSize: 12
						},
						children: props.t(selected.length ? "enginesSelected" : "enginesDefault")
					}),
					ENGINE_GROUPS.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						"aria-label": props.t(group.label),
						style: { marginBottom: 12 },
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: {
								margin: "0 0 6px",
								fontSize: 12,
								opacity: .7
							},
							children: props.t(group.label)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							style: {
								display: "grid",
								gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
								gap: "6px 16px",
								listStyle: "none",
								margin: 0,
								padding: 0
							},
							children: group.engines.map(([name, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: {
									display: "flex",
									alignItems: "center",
									gap: 8
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: selected.includes(name),
									disabled: props.disabled,
									onChange: (event) => toggle(name, event.currentTarget.checked)
								}), label]
							}) }, name))
						})]
					}, group.label)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: props.t("enginesCustom") }),
						custom.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							style: {
								listStyle: "none",
								padding: 0
							},
							children: custom.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: {
									display: "flex",
									alignItems: "center",
									gap: 8
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: true,
									disabled: props.disabled,
									onChange: (event) => toggle(name, event.currentTarget.checked)
								}), name]
							}) }, name))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							htmlFor: "searxng-custom-engines",
							children: props.t("enginesCustomNames")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							id: "searxng-custom-engines",
							value: customDraft?.selection === props.state.text ? customDraft.input : custom.join(","),
							disabled: props.disabled,
							onChange: (event) => {
								const input = event.currentTarget.value;
								const selection = engineNames([...selected.filter((name) => ENGINE_NAMES.has(name)), input].join(",")).join(",");
								setCustomDraft({
									input,
									selection
								});
								props.onEdit(selection);
							},
							"aria-describedby": "searxng-custom-engines-hint"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							id: "searxng-custom-engines-hint",
							style: {
								fontSize: 12,
								opacity: .7
							},
							children: props.t("enginesCustomHint")
						})
					] }),
					custom.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: { fontSize: 12 },
						children: [
							props.t("enginesCustomSelected"),
							": ",
							custom.join(", ")
						]
					})
				]
			});
		}
		/** Language dropdown with a custom-code escape hatch for existing or uncommon languages. */
		function LanguageChoiceField(props) {
			const [customMode, setCustomMode] = (0, react.useState)(false);
			const custom = customMode || !LANGUAGE_CODES.has(props.state.text);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ChoiceField, {
				...props,
				label: "language",
				hint: "languageHint",
				onReset: () => {
					setCustomMode(false);
					props.onReset();
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
					"aria-label": props.t("language"),
					disabled: props.disabled,
					value: custom ? CUSTOM_LANGUAGE : props.state.text,
					"aria-describedby": "searxng-language-hint",
					"aria-invalid": props.state.invalid || void 0,
					style: {
						width: "100%",
						padding: 8,
						borderRadius: 8,
						font: "inherit",
						color: "inherit",
						background: "var(--dsw-alias-bg-base)",
						border: "1px solid var(--dsw-alias-border-l2)"
					},
					onChange: (event) => {
						const value = event.currentTarget.value;
						setCustomMode(value === CUSTOM_LANGUAGE);
						if (value !== CUSTOM_LANGUAGE) props.onEdit(value);
					},
					children: [LANGUAGES.map(([code, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: code,
						children: props.t(label)
					}, code)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: CUSTOM_LANGUAGE,
						children: props.t("languageCustom")
					})]
				}), custom && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
					htmlFor: "searxng-custom-language",
					children: props.t("languageCustomCode")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
					id: "searxng-custom-language",
					value: props.state.text,
					disabled: props.disabled,
					onChange: (event) => props.onEdit(event.currentTarget.value)
				})] })]
			});
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
		const CURRENT_VERSION = "0.3.0";
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
				return compareVersions(tag, "0.3.0") > 0 ? {
					kind: "newer",
					latest: tag.replace(/^v/i, "")
				} : { kind: "latest" };
			} catch {
				return { kind: "unknown" };
			}
		}
		//#endregion
		//#region src/client/ServicePanel.tsx
		/** Live service status and operator actions over the authenticated DSH carrier. */
		const labels = {
			idle: "serviceIdle",
			preparing: "servicePreparing",
			starting: "serviceStarting",
			ready: "serviceReady",
			stopped: "serviceStopped",
			failed: "serviceFailed",
			external: "serviceExternal"
		};
		const stages = {
			uv: "setupUv",
			source: "setupSource",
			python: "setupPython",
			dependencies: "setupDependencies"
		};
		function ServicePanel({ call, t, writable }) {
			const [status, setStatus] = (0, react.useState)({
				phase: "idle",
				endpoint: "",
				message: "",
				logs: ""
			});
			const [error, setError] = (0, react.useState)("");
			const [pollError, setPollError] = (0, react.useState)("");
			const [testing, setTesting] = (0, react.useState)();
			const [busy, setBusy] = (0, react.useState)(false);
			const lifetime = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				if (!call) return;
				const controller = new AbortController();
				lifetime.current = controller;
				setBusy(false);
				let timer;
				const poll = async () => {
					try {
						const next = await call("status", AbortSignal.any([controller.signal, AbortSignal.timeout(1e4)]));
						if (!controller.signal.aborted && typeof next !== "number") {
							setStatus(next);
							setPollError("");
						}
					} catch (e) {
						if (!controller.signal.aborted) setPollError(String(e));
					}
					if (!controller.signal.aborted) timer = setTimeout(() => {
						poll();
					}, 1500);
				};
				poll();
				return () => {
					controller.abort();
					clearTimeout(timer);
				};
			}, [call]);
			const action = async (method) => {
				const controller = lifetime.current;
				if (!call || !controller) return;
				setBusy(true);
				setError("");
				setTesting(void 0);
				try {
					const next = await call(method, AbortSignal.any([controller.signal, AbortSignal.timeout(45e3)]));
					if (controller.signal.aborted) return;
					if (typeof next === "number") setTesting(next);
					else setStatus(next);
				} catch (e) {
					if (!controller.signal.aborted) setError(String(e));
				} finally {
					if (!controller.signal.aborted) setBusy(false);
				}
			};
			const stage = Object.hasOwn(stages, status.message) ? t(stages[status.message]) : status.message;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				"aria-label": t("serviceTitle"),
				style: { marginBottom: 16 },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
							t("serviceTitle"),
							": ",
							t(labels[status.phase])
						] }), stage ? ` · ${stage}` : ""]
					}),
					status.endpoint && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
						t("activeEndpoint"),
						": ",
						status.endpoint
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("serviceHint") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							gap: 8,
							flexWrap: "wrap"
						},
						children: [status.phase !== "external" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							disabled: !call || busy || !writable,
							onClick: () => {
								action("restart");
							},
							children: t("serviceRestart")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							disabled: !call || busy || !writable || status.phase === "stopped",
							onClick: () => {
								action("stop");
							},
							children: t("serviceStop")
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							disabled: !call || busy || !status.endpoint,
							onClick: () => {
								action("test");
							},
							children: t("serviceTest")
						})]
					}),
					testing !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						role: "status",
						children: [
							t("serviceTestResult"),
							": ",
							testing
						]
					}),
					(error || pollError) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						children: error || pollError
					}),
					status.logs && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("serviceLogs") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						style: {
							whiteSpace: "pre-wrap",
							maxHeight: 240,
							overflow: "auto"
						},
						children: status.logs
					})] })
				]
			});
		}
		//#endregion
		//#region src/client/SearxngSearchCard.tsx
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
			const disabled = !state.available || !state.writable || state.saving;
			const fields = [
				state.mode,
				state.managedPort,
				state.baseURL,
				state.engines,
				state.language,
				state.allowOfficialFallback
			];
			const local = state.mode.text === "local" || state.mode.text === "auto" && !state.baseURL.text.trim();
			const anyOverridden = fields.some((field) => field.overridden);
			const resetAll = () => {
				props.resetField("mode");
				props.resetField("managedPort");
				props.resetField("baseURL");
				props.resetField("engines");
				props.resetField("language");
				props.resetField("allowOfficialFallback");
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ServicePanel, {
					call: props.serviceCall,
					t,
					writable: state.available && state.writable
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.SettingsForm, {
					labels: formLabels(t),
					state,
					onSave: props.save,
					onDiscard: props.discard,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							htmlFor: "searxng-mode",
							children: t("modeLabel")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							id: "searxng-mode",
							value: state.mode.text,
							disabled,
							onChange: (e) => props.edit("mode", e.currentTarget.value),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "auto",
									children: t("modeAuto")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "local",
									children: t("modeLocal")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "external",
									children: t("modeExternal")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("modeHint") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 8
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: fallbackAllowed,
								disabled,
								onChange: (event) => props.edit("allowOfficialFallback", String(event.currentTarget.checked)),
								"aria-describedby": "searxng-fallback-hint"
							}), t("fallbackLabel")]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							id: "searxng-fallback-hint",
							children: t("fallbackHint")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("routeHint") }),
						!local && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsValueField, {
							id: "plugin-config-web-search-searxng-endpoint",
							label: t("baseUrl"),
							hint: t("baseUrlHint"),
							overriddenLabel: t("overridden"),
							resetLabel: t("reset"),
							invalidLabel: t("invalidValue"),
							disabled,
							...state.baseURL,
							onEdit: (text) => props.edit("baseURL", text),
							onReset: () => props.resetField("baseURL")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(EngineChoiceField, {
							t,
							state: state.engines,
							disabled,
							onEdit: (text) => props.edit("engines", text),
							onReset: () => props.resetField("engines")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LanguageChoiceField, {
							t,
							state: state.language,
							disabled,
							onEdit: (text) => props.edit("language", text),
							onReset: () => props.resetField("language")
						}),
						local && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("advanced") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsValueField, {
							id: "searxng-managed-port",
							label: t("managedPort"),
							hint: t("managedPortHint"),
							overriddenLabel: t("overridden"),
							resetLabel: t("reset"),
							invalidLabel: t("invalidValue"),
							disabled,
							...state.managedPort,
							onEdit: (text) => props.edit("managedPort", text),
							onReset: () => props.resetField("managedPort")
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							disabled: disabled || !anyOverridden,
							onClick: resetAll,
							children: t("resetAll")
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
				})
			] });
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
					{
						field: "mode",
						format: (value) => typeof value === "string" ? value : "auto",
						parse: (text) => [
							"auto",
							"local",
							"external"
						].includes(text) ? {
							kind: "set",
							value: text
						} : void 0
					},
					{
						field: "managedPort",
						format: (value) => typeof value === "number" ? String(value) : "0",
						parse: (text) => /^\d+$/.test(text) && Number(text) <= 65535 ? {
							kind: "set",
							value: Number(text)
						} : void 0
					},
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
					mode: this.form.field("mode"),
					managedPort: this.form.field("managedPort"),
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
		//#region src/runtime-types.ts
		/** Validate a response received over the authenticated Connection carrier. */
		function parseServiceStatus(value) {
			if (typeof value !== "object" || value === null) throw new Error("Invalid service response");
			const phase = Reflect.get(value, "phase");
			if (![
				"idle",
				"preparing",
				"starting",
				"ready",
				"stopped",
				"failed",
				"external"
			].includes(phase)) throw new Error("Invalid service phase");
			for (const key of [
				"endpoint",
				"message",
				"logs"
			]) if (typeof Reflect.get(value, key) !== "string") throw new Error(`Invalid service ${key}`);
			return value;
		}
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.webSearchSearxng";
		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"locale",
			"configForms",
			"connection"
		];
		/**
		* Mount the SearXNG search settings page while the Host serves its namespace.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			const connection = ctx.get("connection");
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
				inject: () => ({
					...card.inject(),
					async serviceCall(method, signal) {
						const result = await connection.rpc.call("/api", `searxngRuntime/${method}`, { args: {} }, signal);
						if (!result.ok) throw new Error(result.error.message);
						if (method === "test") {
							if (!Number.isInteger(result.value) || typeof result.value !== "number" || result.value < 0) throw new Error("Invalid search test response");
							return result.value;
						}
						return parseServiceStatus(result.value);
					}
				})
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