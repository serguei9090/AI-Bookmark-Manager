import {
	AlertCircle,
	ArrowLeft,
	Check,
	ExternalLink,
	Folder,
	Globe,
	LayoutGrid,
	Moon,
	RefreshCw,
	Search,
	Settings,
	Sun,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { fetchModels, testConnection } from "../services/aiService";
import { useAppContext } from "../store";
import type { AIProvider, Settings as SettingsType } from "../types";

export function SimplePopupView() {
	const { bookmarks, folders, settings, setSettings, triggerAutoOrganize } =
		useAppContext();
	const [searchQuery, setSearchQuery] = useState("");
	const [showSettings, setShowSettings] = useState(false);
	const [localProvider, setLocalProvider] = useState<AIProvider>("gemini");
	const [localUrl, setLocalUrl] = useState("");
	const [localApiKey, setLocalApiKey] = useState("");
	const [localModel, setLocalModel] = useState("");
	const [localAutoOrganize, setLocalAutoOrganize] = useState(false);
	const [localMonitoredFolderId, setLocalMonitoredFolderId] = useState("");
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [isTesting, setIsTesting] = useState(false);
	const [testStatus, setTestStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	// States to support model fetching and dropdown:
	const [isFetching, setIsFetching] = useState(false);
	const [fetchedModels, setFetchedModels] = useState<string[]>([]);
	const [fetchError, setFetchError] = useState<string | null>(null);
	const [_modelMeta, setModelMeta] = useState<
		Record<string, { outputTokenLimit?: number }>
	>({});
	const [isCustom, setIsCustom] = useState(false);

	React.useEffect(() => {
		if (showSettings) {
			setLocalProvider(settings.provider);
			setLocalModel(settings.model || "");
			setLocalAutoOrganize(settings.autoOrganizeEnabled || false);
			setLocalMonitoredFolderId(settings.monitoredFolderId || "");
			setTestStatus(null);
			setFetchError(null);
			setFetchedModels([]);
			setIsCustom(false);

			const provider = settings.provider;
			if (provider === "gemini") {
				setLocalUrl(settings.geminiUrl || "");
				setLocalApiKey(settings.geminiApiKey || "");
			} else if (provider === "openai") {
				setLocalUrl(settings.openaiUrl || "");
				setLocalApiKey(settings.openaiApiKey || "");
			} else if (provider === "ollama") {
				setLocalUrl(settings.ollamaUrl || "");
				setLocalApiKey(settings.ollamaApiKey || "");
			} else if (provider === "lmstudio") {
				setLocalUrl(settings.lmstudioUrl || "");
				setLocalApiKey(settings.lmstudioApiKey || "");
			} else {
				setLocalUrl(settings.customUrl || "");
				setLocalApiKey(settings.customApiKey || "");
			}
		}
	}, [showSettings, settings]);

	// Sync isCustom with localModel and fetchedModels changes
	React.useEffect(() => {
		if (fetchedModels.length > 0) {
			setIsCustom(!fetchedModels.includes(localModel));
		}
	}, [fetchedModels, localModel]);

	const getTempSettings = (): SettingsType => {
		return {
			...settings,
			provider: localProvider,
			geminiUrl: localProvider === "gemini" ? localUrl : settings.geminiUrl,
			geminiApiKey:
				localProvider === "gemini" ? localApiKey : settings.geminiApiKey,
			openaiUrl: localProvider === "openai" ? localUrl : settings.openaiUrl,
			openaiApiKey:
				localProvider === "openai" ? localApiKey : settings.openaiApiKey,
			ollamaUrl: localProvider === "ollama" ? localUrl : settings.ollamaUrl,
			ollamaApiKey:
				localProvider === "ollama" ? localApiKey : settings.ollamaApiKey,
			lmstudioUrl:
				localProvider === "lmstudio" ? localUrl : settings.lmstudioUrl,
			lmstudioApiKey:
				localProvider === "lmstudio" ? localApiKey : settings.lmstudioApiKey,
			customUrl: localProvider === "custom" ? localUrl : settings.customUrl,
			customApiKey:
				localProvider === "custom" ? localApiKey : settings.customApiKey,
		};
	};

	const handleFetchModels = async () => {
		setIsFetching(true);
		setFetchError(null);
		try {
			const tempSettings = getTempSettings();
			const { models, metaMap } = await fetchModels(tempSettings);
			if (models.length === 0)
				throw new Error("No models returned by endpoint");
			setFetchedModels(models);
			setModelMeta(metaMap);
			if (!models.includes(localModel)) {
				const nextModel = models[0] || "";
				setLocalModel(nextModel);
			}
		} catch (err) {
			const errMsg =
				err instanceof Error ? err.message : "Failed to fetch models";
			setFetchError(errMsg);
		} finally {
			setIsFetching(false);
		}
	};

	const defaultUrl = useMemo(() => {
		const provider = settings.provider;
		if (provider === "gemini")
			return "https://generativelanguage.googleapis.com";
		if (provider === "openai") return "https://api.openai.com/v1";
		if (provider === "ollama") return "http://localhost:11434";
		if (provider === "lmstudio") return "http://localhost:1234/v1";
		return "http://localhost:8080/v1";
	}, [settings.provider]);

	const activeUrl = localUrl || defaultUrl;

	// Auto-extract domain to get professional favicon
	const getFaviconUrl = (urlStr: string) => {
		try {
			const url = new URL(urlStr);
			return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
		} catch {
			return "";
		}
	};

	const parseDomainName = (urlStr: string) => {
		try {
			const url = new URL(urlStr);
			return url.hostname.replace("www.", "");
		} catch {
			return "Web Link";
		}
	};

	const failedBookmarks = useMemo(() => {
		const targetFolderId = showSettings
			? localMonitoredFolderId
			: settings.monitoredFolderId || "";
		const effectiveFolderId = (() => {
			if (targetFolderId) return targetFolderId;
			const toSort = folders.find((f) => f.name.toLowerCase() === "tosort");
			return toSort ? toSort.id : "";
		})();
		const enabled = showSettings
			? localAutoOrganize
			: settings.autoOrganizeEnabled || false;
		if (!enabled) return [];
		return bookmarks.filter(
			(b) =>
				b.aiFailed ||
				(effectiveFolderId !== "" &&
					b.folderId === effectiveFolderId &&
					!b.summary),
		);
	}, [
		bookmarks,
		folders,
		settings,
		showSettings,
		localAutoOrganize,
		localMonitoredFolderId,
	]);

	// Filter bookmarks by search query
	const filteredBookmarks = useMemo(() => {
		if (!searchQuery.trim()) {
			// Return 6 most recently added bookmarks
			return [...bookmarks]
				.sort((a, b) => b.dateAdded - a.dateAdded)
				.slice(0, 6);
		}
		return bookmarks.filter(
			(b) =>
				b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				b.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
				b.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
				b.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())),
		);
	}, [bookmarks, searchQuery]);

	const actualFailedCount = useMemo(() => {
		return bookmarks.filter((b) => b.aiFailed).length;
	}, [bookmarks]);

	const handleRetryAllFailed = async () => {
		const toRetry = bookmarks.filter((b) => b.aiFailed);
		for (const bm of toRetry) {
			await triggerAutoOrganize(bm.id, bm.title, bm.url, bm.folderId, true);
		}
	};

	const handleOpenBookmark = (url: string) => {
		window.open(url, "_blank");
	};

	const handleOpenDashboard = () => {
		if (typeof chrome !== "undefined" && chrome.tabs) {
			chrome.tabs.create({ url: "index.html" });
		} else {
			setSettings((prev) => ({ ...prev, viewMode: "dashboard" }));
		}
	};

	const handleTestConnection = async () => {
		setIsTesting(true);
		setTestStatus(null);
		try {
			const tempSettings = getTempSettings();
			await testConnection(tempSettings);
			setTestStatus({
				type: "success",
				message: "Connection successful!",
			});
		} catch (err) {
			const errMsg =
				err instanceof Error ? err.message : "Failed to reach endpoint";
			setTestStatus({
				type: "error",
				message: errMsg,
			});
		} finally {
			setIsTesting(false);
		}
	};

	const handleSaveSettings = (e: React.FormEvent) => {
		e.preventDefault();
		setSettings((prev) => {
			const updated = {
				...prev,
				provider: localProvider,
				model: localModel,
				autoOrganizeEnabled: localAutoOrganize,
				monitoredFolderId: localMonitoredFolderId,
			};
			if (localProvider === "gemini") {
				updated.geminiUrl = localUrl;
				updated.geminiApiKey = localApiKey;
			} else if (localProvider === "openai") {
				updated.openaiUrl = localUrl;
				updated.openaiApiKey = localApiKey;
			} else if (localProvider === "ollama") {
				updated.ollamaUrl = localUrl;
				updated.ollamaApiKey = localApiKey;
			} else if (localProvider === "lmstudio") {
				updated.lmstudioUrl = localUrl;
				updated.lmstudioApiKey = localApiKey;
			} else {
				updated.customUrl = localUrl;
				updated.customApiKey = localApiKey;
			}
			return updated;
		});
		setSaveSuccess(true);
		setTimeout(() => {
			setSaveSuccess(false);
			setShowSettings(false);
		}, 800);
	};

	return (
		<div className="h-full flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
			{/* HEADER SECTION */}
			<div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3 mb-4">
				{showSettings ? (
					<button
						type="button"
						onClick={() => setShowSettings(false)}
						className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
					>
						<ArrowLeft size={14} />
						<span>Back to search</span>
					</button>
				) : (
					<div className="flex items-center gap-2">
						<span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
						<span className="font-bold text-xs text-gray-500 dark:text-gray-450 uppercase tracking-widest">
							{searchQuery ? "Search Results" : "Recently added"}
						</span>
					</div>
				)}

				<div className="flex items-center gap-1.5">
					{/* Dark Mode Toggle */}
					<button
						type="button"
						onClick={() =>
							setSettings((prev) => ({ ...prev, darkMode: !prev.darkMode }))
						}
						className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400 cursor-pointer transition-colors"
						title="Toggle theme"
					>
						{settings.darkMode ? <Sun size={15} /> : <Moon size={15} />}
					</button>

					{/* Settings gear */}
					<button
						type="button"
						onClick={() => setShowSettings(!showSettings)}
						className={`p-1.5 rounded-lg transition-all cursor-pointer ${
							showSettings
								? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
								: "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400"
						}`}
						title="Popup parameters"
					>
						<Settings
							size={15}
							className={showSettings ? "animate-spin-hover" : ""}
						/>
					</button>
				</div>
			</div>

			{/* BODY CONTENT AREA */}
			<div className="flex-1 overflow-y-auto">
				{showSettings ? (
					/* COMPACT SETTINGS VIEW */
					<form
						onSubmit={handleSaveSettings}
						className="space-y-4 pr-1 animate-fade-in"
					>
						<h3 className="font-bold text-sm text-gray-850 dark:text-white mb-2 flex items-center gap-1.5">
							<Settings size={16} className="text-blue-500" />
							Popup Parameters
						</h3>

						<div className="space-y-3">
							<div>
								<label
									htmlFor="popup-provider-select"
									className="block text-[10px] font-bold text-gray-400 dark:text-gray-505 uppercase tracking-wider mb-1"
								>
									AI Provider
								</label>
								<select
									id="popup-provider-select"
									value={localProvider}
									onChange={(e) => {
										const prov = e.target.value as AIProvider;
										setLocalProvider(prov);
										setTestStatus(null);
										setFetchError(null);
										setFetchedModels([]);
										setIsCustom(false);
										// Auto-update default URLs and clear API keys/models appropriately
										if (prov === "gemini") {
											setLocalUrl("https://generativelanguage.googleapis.com");
											setLocalApiKey("");
											setLocalModel("gemini-3.5-flash");
										} else if (prov === "openai") {
											setLocalUrl("https://api.openai.com/v1");
											setLocalApiKey("");
											setLocalModel("gpt-4o-mini");
										} else if (prov === "ollama") {
											setLocalUrl("http://localhost:11434");
											setLocalApiKey("");
											setLocalModel("llama3");
										} else if (prov === "lmstudio") {
											setLocalUrl("http://localhost:1234/v1");
											setLocalApiKey("");
											setLocalModel("");
										} else {
											setLocalUrl("http://localhost:8080/v1");
											setLocalApiKey("");
											setLocalModel("");
										}
									}}
									className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-semibold dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
								>
									<option value="gemini">Google Gemini</option>
									<option value="openai">OpenAI (GPT Engine)</option>
									<option value="ollama">Ollama (Localhost)</option>
									<option value="lmstudio">LMStudio (Local)</option>
									<option value="custom">Custom API Endpoint</option>
								</select>
							</div>

							<div>
								<label
									htmlFor="popup-endpoint-url"
									className="block text-[10px] font-bold text-gray-400 dark:text-gray-505 uppercase tracking-wider mb-1"
								>
									{localProvider === "gemini"
										? "Google Gemini"
										: localProvider === "openai"
											? "OpenAI"
											: localProvider === "ollama"
												? "Ollama"
												: localProvider === "lmstudio"
													? "LMStudio"
													: "Custom"}{" "}
									Endpoint URL
								</label>
								<span
									className="block text-[9px] text-gray-500 dark:text-gray-450 mb-1 truncate"
									title={activeUrl}
								>
									Currently using:{" "}
									<code className="font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/25 px-1 py-0.5 rounded">
										{activeUrl}
									</code>
								</span>
								<input
									id="popup-endpoint-url"
									type="text"
									placeholder={defaultUrl}
									value={localUrl}
									onChange={(e) => {
										setLocalUrl(e.target.value);
										setTestStatus(null);
									}}
									className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-mono dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
								/>
							</div>

							<div>
								<label
									htmlFor="popup-api-key"
									className="block text-[10px] font-bold text-gray-400 dark:text-gray-505 uppercase tracking-wider mb-1"
								>
									API Key / Secret Token
								</label>
								<input
									id="popup-api-key"
									type="password"
									placeholder={
										localProvider === "gemini"
											? "Enter your Gemini API key..."
											: localProvider === "ollama" ||
													localProvider === "lmstudio"
												? "Optional for local servers"
												: "Paste your API key/token here..."
									}
									value={localApiKey}
									onChange={(e) => {
										setLocalApiKey(e.target.value);
										setTestStatus(null);
									}}
									className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-mono dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
								/>
							</div>

							<div>
								<div className="flex justify-between items-center mb-1">
									<label
										htmlFor="popup-model-select"
										className="block text-[10px] font-bold text-gray-400 dark:text-gray-505 uppercase tracking-wider"
									>
										Model Selection
									</label>
									<div className="flex items-center gap-1.5">
										<button
											type="button"
											onClick={handleTestConnection}
											disabled={isTesting}
											className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 dark:text-emerald-450 rounded border border-emerald-150 dark:border-emerald-900/30 transition-all cursor-pointer flex items-center gap-0.5 disabled:opacity-50 active:scale-95 shadow-sm"
										>
											{isTesting ? "Testing..." : "Test Connection"}
										</button>
										<button
											type="button"
											onClick={handleFetchModels}
											disabled={isFetching}
											className="px-1.5 py-0.5 text-[9px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 dark:text-blue-400 rounded border border-blue-150 dark:border-blue-900/30 transition-all cursor-pointer flex items-center gap-0.5 disabled:opacity-50 active:scale-95 shadow-sm"
											title="Fetch live model list"
										>
											<RefreshCw
												size={8}
												className={isFetching ? "animate-spin" : ""}
											/>
											{isFetching ? "Fetching..." : "Auto-Fetch"}
										</button>
									</div>
								</div>

								{/* Connection Test Status banner */}
								{testStatus && (
									<div
										className={`mb-2 flex items-start gap-1.5 text-[10px] border rounded-lg px-2.5 py-1.5 ${
											testStatus.type === "success"
												? "text-emerald-750 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900/30"
												: "text-red-750 dark:text-red-450 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
										}`}
									>
										<span>{testStatus.type === "success" ? "✓" : "✗"}</span>
										<span className="break-all">{testStatus.message}</span>
									</div>
								)}

								{/* Fetch Error banner */}
								{fetchError && (
									<div className="mb-2 flex items-start gap-1.5 text-[10px] text-red-655 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2.5 py-1.5">
										<span>✗</span>
										<span className="break-all">{fetchError}</span>
									</div>
								)}

								<select
									id="popup-model-select"
									value={isCustom ? "custom-defined" : localModel}
									onChange={(e) => {
										const mVal = e.target.value;
										if (mVal === "custom-defined") {
											setIsCustom(true);
											setLocalModel("");
										} else {
											setIsCustom(false);
											setLocalModel(mVal);
										}
									}}
									className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-mono dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
								>
									{fetchedModels.length === 0 ? (
										<option value={localModel || ""} disabled>
											{localModel || "— Click Auto-Fetch to load models —"}
										</option>
									) : (
										fetchedModels.map((m) => (
											<option key={m} value={m}>
												{m}
											</option>
										))
									)}
									<option value="custom-defined">
										— Enter custom model name —
									</option>
								</select>

								{fetchedModels.length === 0 && !fetchError && (
									<p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1">
										No models loaded yet — click <strong>Auto-Fetch</strong> to
										pull live models.
									</p>
								)}
								{fetchedModels.length > 0 && (
									<p className="text-[9px] text-emerald-600 dark:text-emerald-450 mt-1">
										✓ {fetchedModels.length} model
										{fetchedModels.length !== 1 ? "s" : ""} loaded
									</p>
								)}
							</div>

							{isCustom && (
								<div className="bg-blue-50/30 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
									<label
										htmlFor="popup-custom-model"
										className="block text-[10px] font-bold text-blue-900 dark:text-blue-300 mb-1.5"
									>
										Custom Defined Model Identifier
									</label>
									<input
										id="popup-custom-model"
										type="text"
										placeholder="e.g. llama-3.1-custom-Q4"
										value={localModel}
										onChange={(e) => setLocalModel(e.target.value)}
										className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-mono dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
									/>
								</div>
							)}

							{/* AI AUTO-ORGANIZE CONFIG */}
							<div className="pt-2.5 border-t border-gray-200 dark:border-gray-800 space-y-2.5">
								<div className="flex items-center justify-between">
									<label
										htmlFor="popup-auto-organize-toggle"
										className="block text-[10px] font-bold text-gray-400 dark:text-gray-505 uppercase tracking-wider"
									>
										AI Auto-Organize
									</label>
									<button
										type="button"
										id="popup-auto-organize-toggle"
										onClick={() => setLocalAutoOrganize(!localAutoOrganize)}
										className={`w-10 h-5 rounded-full transition-colors flex items-center ${
											localAutoOrganize ? "bg-blue-600" : "bg-gray-300"
										} px-0.5`}
									>
										<div
											className={`w-4 h-4 rounded-full bg-white transition-transform ${
												localAutoOrganize ? "translate-x-5" : "translate-x-0"
											}`}
										/>
									</button>
								</div>
								<p className="text-[9px] text-gray-400 dark:text-gray-500 leading-normal">
									Automatically summarize, tag, and sort new bookmarks.
								</p>

								{localAutoOrganize && (
									<div className="space-y-1 mt-1.5">
										<label
											htmlFor="popup-monitored-folder"
											className="block text-[9px] font-bold text-gray-400 dark:text-gray-505 uppercase tracking-wider"
										>
											Monitored Folder
										</label>
										<select
											id="popup-monitored-folder"
											value={localMonitoredFolderId}
											onChange={(e) =>
												setLocalMonitoredFolderId(e.target.value)
											}
											className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
										>
											<option value="">
												— Auto-create ToSort folder (Default) —
											</option>
											{folders.map((f) => (
												<option key={f.id} value={f.id}>
													{f.name}
												</option>
											))}
										</select>
									</div>
								)}

								{/* Failed retry panel in popup settings */}
								{localAutoOrganize && failedBookmarks.length > 0 && (
									<div className="pt-2 border-t border-gray-200 dark:border-gray-800 space-y-1.5">
										<span className="block text-[9px] font-bold text-red-500 uppercase tracking-wider">
											Failed Bookmarks ({failedBookmarks.length})
										</span>
										<div className="max-h-24 overflow-y-auto space-y-1 pr-1 border border-gray-100 dark:border-gray-800 rounded-xl p-1 bg-gray-50/30 dark:bg-gray-900/10">
											{failedBookmarks.map((bm) => (
												<div
													key={bm.id}
													className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-red-50/40 dark:bg-red-950/10 border border-red-100 dark:border-red-900/20"
												>
													<span className="text-[10px] text-gray-700 dark:text-gray-200 truncate flex-1 font-medium">
														{bm.title}
													</span>
													<button
														type="button"
														onClick={() =>
															triggerAutoOrganize(
																bm.id,
																bm.title,
																bm.url,
																bm.folderId,
																true,
															)
														}
														className="text-[9px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/30 px-1.5 py-0.5 rounded cursor-pointer transition-all active:scale-95 shrink-0"
													>
														Retry
													</button>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						</div>

						<div className="flex flex-col gap-2 pt-2">
							<button
								type="submit"
								className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
							>
								{saveSuccess ? (
									<>
										<Check size={14} />
										<span>Saved!</span>
									</>
								) : (
									<span>Save Parameters</span>
								)}
							</button>

							<button
								type="button"
								onClick={handleOpenDashboard}
								className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-350 font-bold py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
							>
								<LayoutGrid size={14} />
								<span>Open Administrative Dashboard ↗</span>
							</button>
						</div>
					</form>
				) : (
					/* BOOKMARKS SEARCH & LIST VIEW */
					<div className="space-y-2.5 animate-fade-in">
						{/* Failed Bookmarks Warning Banner */}
						{actualFailedCount > 0 && (
							<div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/30 text-xs text-red-800 dark:text-red-300 animate-fade-in">
								<div className="flex items-center gap-2 min-w-0">
									<AlertCircle
										size={16}
										className="text-red-500 shrink-0 animate-pulse"
									/>
									<span className="font-semibold truncate">
										AI Auto-Organize failed ({actualFailedCount})
									</span>
								</div>
								<div className="flex items-center gap-1.5 shrink-0">
									<button
										type="button"
										onClick={handleRetryAllFailed}
										className="text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
									>
										Retry All
									</button>
									<button
										type="button"
										onClick={() => setShowSettings(true)}
										className="text-[10px] font-bold bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-350 px-2 py-1 rounded-lg transition-colors cursor-pointer"
									>
										View
									</button>
								</div>
							</div>
						)}

						{/* SEARCH INPUT */}
						<div className="relative mb-3.5">
							<Search
								className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
								size={14}
							/>
							<input
								type="text"
								placeholder="Search bookmarks by title, URL or tag..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-800 outline-none text-gray-850 dark:text-white transition-all"
							/>
						</div>

						{/* LIST */}
						<div className="space-y-1.5">
							{filteredBookmarks.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 dark:text-gray-650">
									<Globe
										className="text-gray-300 dark:text-gray-700 mb-2"
										size={30}
									/>
									<span className="text-xs font-semibold">
										No bookmarks found
									</span>
									<span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
										Try searching for a different keyword
									</span>
								</div>
							) : (
								filteredBookmarks.map((bm) => (
									<div
										key={bm.id}
										className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-blue-50/50 dark:hover:bg-blue-900/10 border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30 transition-all group bg-transparent"
									>
										{/* Main clickable area: opens link */}
										<button
											type="button"
											onClick={() => handleOpenBookmark(bm.url)}
											className="flex-1 text-left flex items-center gap-3 min-w-0 cursor-pointer border-0 bg-transparent p-0 outline-none"
										>
											{/* Favicon */}
											<div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 p-1.5 border border-gray-200 dark:border-gray-800 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
												{getFaviconUrl(bm.url) ? (
													<img
														src={getFaviconUrl(bm.url)}
														alt=""
														onError={(e) => {
															(e.target as HTMLImageElement).style.display =
																"none";
														}}
														className="w-5 h-5 object-contain"
														referrerPolicy="no-referrer"
													/>
												) : (
													<Globe size={14} className="text-gray-400" />
												)}
											</div>

											{/* Bookmark details */}
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-1.5">
													<span className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate block">
														{bm.title}
													</span>
													<ExternalLink
														size={10}
														className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
													/>
												</div>
												<span className="text-[10px] text-gray-500 dark:text-gray-450 truncate block mt-0.5">
													{parseDomainName(bm.url)}
												</span>
											</div>
										</button>

										{/* Sibling controls */}
										<div className="flex items-center gap-2 shrink-0">
											{(() => {
												const effectiveFolderId =
													settings.monitoredFolderId ||
													folders.find((f) => f.name.toLowerCase() === "tosort")
														?.id ||
													"";
												const isFailedOrUnorganized =
													bm.aiFailed ||
													(settings.autoOrganizeEnabled &&
														effectiveFolderId !== "" &&
														bm.folderId === effectiveFolderId &&
														!bm.summary);
												if (!isFailedOrUnorganized) return null;
												return (
													<div className="flex items-center gap-1.5 shrink-0 ml-1.5">
														<AlertCircle
															size={12}
															className="text-red-500 shrink-0"
															title="AI Auto-Organize Failed"
														/>
														<button
															type="button"
															className="text-[9px] font-bold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/30 px-1.5 py-0.5 rounded cursor-pointer transition-all active:scale-95 shrink-0 flex items-center gap-0.5"
															title="Click to retry AI auto-organization"
															onClick={(e) => {
																e.preventDefault();
																e.stopPropagation();
																triggerAutoOrganize(
																	bm.id,
																	bm.title,
																	bm.url,
																	bm.folderId,
																	true,
																);
															}}
														>
															<RefreshCw
																size={8}
																className="animate-spin-hover"
															/>
															<span>Retry</span>
														</button>
													</div>
												);
											})()}

											{/* Optional folder indication */}
											{bm.folderId && (
												<span className="text-[9px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0">
													<Folder size={8} />
													{folders.find((f) => f.id === bm.folderId)?.name}
												</span>
											)}
										</div>
									</div>
								))
							)}
						</div>
					</div>
				)}
			</div>

			{/* FOOTER AREA */}
			{!showSettings && (
				<div className="border-t border-gray-200 dark:border-gray-800 pt-3 mt-4 flex items-center justify-center flex-shrink-0">
					<button
						type="button"
						onClick={handleOpenDashboard}
						className="flex items-center justify-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer"
					>
						<LayoutGrid size={12} />
						<span>Open Full Manager Dashboard</span>
					</button>
				</div>
			)}
		</div>
	);
}
