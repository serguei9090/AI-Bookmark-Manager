import {
	AlertCircle,
	RefreshCw,
	Server,
	Settings as SettingsIcon,
	Sliders,
	Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchModels, testConnection } from "../services/aiService";
import { useAppContext } from "../store";
import type { AIProvider, Settings } from "../types";

export function SettingsView() {
	const { settings, setSettings, folders, bookmarks, triggerAutoOrganize } =
		useAppContext();
	const [localSaving, setLocalSaving] = useState(false);
	const [isFetching, setIsFetching] = useState(false);
	const [fetchedModels, setFetchedModels] = useState<string[]>([]);
	const [fetchError, setFetchError] = useState<string | null>(null);
	const [modelMeta, setModelMeta] = useState<
		Record<string, { outputTokenLimit?: number }>
	>({});
	const [isTesting, setIsTesting] = useState(false);
	const [testStatus, setTestStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);
	const [isCustom, setIsCustom] = useState(false);

	// Clear fetched model list when provider changes
	useEffect(() => {
		setFetchedModels([]);
		setFetchError(null);
		setModelMeta({});
		setTestStatus(null);
		setIsCustom(false);
	}, []);

	// Sync isCustom with settings.model and fetchedModels changes
	useEffect(() => {
		if (fetchedModels.length > 0) {
			setIsCustom(!fetchedModels.includes(settings.model));
		}
	}, [fetchedModels, settings.model]);

	const handleSave = () => {
		setLocalSaving(true);
		setTimeout(() => setLocalSaving(false), 600);
	};

	const handleTestDashboardConnection = async () => {
		setIsTesting(true);
		setTestStatus(null);
		try {
			await testConnection(settings);
			setTestStatus({
				type: "success",
				message: "Connection successful!",
			});
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to reach endpoint";
			setTestStatus({
				type: "error",
				message,
			});
		} finally {
			setIsTesting(false);
		}
	};

	const handleFetchModels = async () => {
		setIsFetching(true);
		setFetchError(null);
		try {
			const { models, metaMap } = await fetchModels(settings);
			if (models.length === 0)
				throw new Error("No models returned by endpoint");
			setModelMeta(metaMap);
			setFetchedModels(models);

			// Auto-select first model if current selection not in new list
			if (!models.includes(settings.model)) {
				const nextModel = models[0] || "";
				setSettings((prev: Settings) => ({
					...prev,
					model: nextModel,
				}));
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to fetch models";
			setFetchError(message);
		} finally {
			setIsFetching(false);
		}
	};

	return (
		<div className="max-w-3xl mx-auto space-y-8 pb-16">
			<div>
				<h2 className="text-3xl font-bold dark:text-white tracking-tight flex items-center gap-3">
					<SettingsIcon
						className="text-blue-500 animate-spin-hover"
						size={28}
					/>
					AI Engine & Settings
				</h2>
				<p className="text-gray-500 dark:text-gray-400 mt-1">
					Configure model parameters, context system instructions, endpoints,
					and adaptive preview modes.
				</p>
			</div>

			{/* SECTION 1: AI Provider & Model Configuration */}
			<div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-6">
				<div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
					<Server className="text-blue-500" size={20} />
					<h3 className="font-semibold text-lg dark:text-white">
						API Endpoint Configuration
					</h3>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<label
							htmlFor="ai-provider"
							className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
						>
							AI Provider
						</label>
						<select
							id="ai-provider"
							className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
							value={settings.provider}
							onChange={(e) =>
								setSettings({
									...settings,
									provider: e.target.value as AIProvider,
								})
							}
						>
							<option value="gemini">
								Google Gemini (Recommended Server API)
							</option>
							<option value="openai">OpenAI (GPT Engine)</option>
							<option value="ollama">Ollama (Localhost Engine)</option>
							<option value="lmstudio">LMStudio (Local Inference)</option>
							<option value="custom">Custom JSON API Endpoint</option>
						</select>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
							<span>Model Selection</span>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handleTestDashboardConnection}
									disabled={isTesting}
									className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 dark:text-emerald-450 rounded-lg border border-emerald-250 dark:border-emerald-900/30 transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50 active:scale-95 shadow-sm"
								>
									{isTesting ? "Testing..." : "Test Connection"}
								</button>
								<button
									type="button"
									onClick={handleFetchModels}
									disabled={isFetching}
									className="px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-900/30 transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50 active:scale-95 shadow-sm"
									title="Fetch live model list from the configured endpoint"
								>
									<RefreshCw
										size={12}
										className={isFetching ? "animate-spin" : ""}
									/>
									{isFetching ? "Fetching..." : "Auto-Fetch List"}
								</button>
							</div>
						</label>

						{/* Connection Test Status banner */}
						{testStatus && (
							<div
								className={`mb-2 flex items-start gap-2 text-xs border rounded-lg px-3 py-2 ${
									testStatus.type === "success"
										? "text-emerald-750 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900/30"
										: "text-red-750 dark:text-red-450 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
								}`}
							>
								<AlertCircle size={13} className="mt-0.5 shrink-0" />
								<span>{testStatus.message}</span>
							</div>
						)}

						{/* Error banner */}
						{fetchError && (
							<div className="mb-2 flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
								<AlertCircle size={13} className="mt-0.5 shrink-0" />
								<span>{fetchError}</span>
							</div>
						)}

						<div className="flex gap-2">
							<select
								className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm"
								value={isCustom ? "custom-defined" : settings.model}
								onChange={(e) => {
									const mVal = e.target.value;
									if (mVal === "custom-defined") {
										setIsCustom(true);
										setSettings({ ...settings, model: "" });
									} else {
										setIsCustom(false);
										const limit = modelMeta[mVal]?.outputTokenLimit ?? 0;
										setSettings({ ...settings, model: mVal, maxTokens: limit });
									}
								}}
							>
								{fetchedModels.length === 0 ? (
									<option value={settings.model || ""} disabled>
										{settings.model ||
											"— Click Auto-Fetch List to load models —"}
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
						</div>

						{fetchedModels.length === 0 && !fetchError && (
							<p className="text-[10px] text-gray-400 dark:text-gray-505 mt-1">
								No models loaded yet — click <strong>Auto-Fetch List</strong> to
								pull live models from the endpoint.
							</p>
						)}
						{fetchedModels.length > 0 && (
							<p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
								✓ {fetchedModels.length} model
								{fetchedModels.length !== 1 ? "s" : ""} loaded from endpoint
							</p>
						)}
					</div>
				</div>

				{isCustom && (
					<div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
						<label
							htmlFor="custom-model-id"
							className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-2"
						>
							Custom Defined Model Identifier
						</label>
						<input
							id="custom-model-id"
							type="text"
							placeholder="e.g. llama-3.1-custom-Q4"
							value={settings.model}
							onChange={(e) =>
								setSettings({ ...settings, model: e.target.value })
							}
							className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-mono"
						/>
					</div>
				)}

				{/* Dynamic Provider URL and API Key Inputs */}
				<div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-750">
					<div>
						<label
							htmlFor="endpoint-url"
							className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							{settings.provider === "gemini"
								? "Google Gemini"
								: settings.provider === "openai"
									? "OpenAI"
									: settings.provider === "ollama"
										? "Ollama"
										: settings.provider === "lmstudio"
											? "LMStudio"
											: "Custom"}{" "}
							Endpoint URL
						</label>
						<span className="block text-xs text-gray-500 dark:text-gray-400 mb-2">
							Currently using:{" "}
							<code className="font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/25 px-1 py-0.5 rounded">
								{settings.provider === "gemini"
									? settings.geminiUrl ||
										"https://generativelanguage.googleapis.com"
									: settings.provider === "openai"
										? settings.openaiUrl || "https://api.openai.com/v1"
										: settings.provider === "ollama"
											? settings.ollamaUrl || "http://localhost:11434"
											: settings.provider === "lmstudio"
												? settings.lmstudioUrl || "http://localhost:1234/v1"
												: settings.customUrl || "http://localhost:8080/v1"}
							</code>
						</span>
						<input
							id="endpoint-url"
							type="text"
							placeholder={
								settings.provider === "gemini"
									? "https://generativelanguage.googleapis.com"
									: settings.provider === "openai"
										? "https://api.openai.com/v1"
										: settings.provider === "ollama"
											? "http://localhost:11434"
											: settings.provider === "lmstudio"
												? "http://localhost:1234/v1"
												: "http://localhost:8080/v1"
							}
							value={
								settings.provider === "gemini"
									? settings.geminiUrl || ""
									: settings.provider === "openai"
										? settings.openaiUrl || ""
										: settings.provider === "ollama"
											? settings.ollamaUrl || ""
											: settings.provider === "lmstudio"
												? settings.lmstudioUrl || ""
												: settings.customUrl || ""
							}
							onChange={(e) => {
								const val = e.target.value;
								if (settings.provider === "gemini")
									setSettings({ ...settings, geminiUrl: val });
								else if (settings.provider === "openai")
									setSettings({ ...settings, openaiUrl: val });
								else if (settings.provider === "ollama")
									setSettings({ ...settings, ollamaUrl: val });
								else if (settings.provider === "lmstudio")
									setSettings({ ...settings, lmstudioUrl: val });
								else setSettings({ ...settings, customUrl: val });
							}}
							className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white font-mono text-sm"
						/>
					</div>

					<div>
						<label
							htmlFor="api-key"
							className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
						>
							API Key / Secret Token
						</label>
						<input
							id="api-key"
							type="password"
							placeholder={
								settings.provider === "gemini"
									? "Enter your Gemini API key..."
									: settings.provider === "ollama" ||
											settings.provider === "lmstudio"
										? "Optional for local servers"
										: "Paste your API key/token here..."
							}
							value={
								settings.provider === "gemini"
									? settings.geminiApiKey || ""
									: settings.provider === "openai"
										? settings.openaiApiKey || ""
										: settings.provider === "ollama"
											? settings.ollamaApiKey || ""
											: settings.provider === "lmstudio"
												? settings.lmstudioApiKey || ""
												: settings.customApiKey || ""
							}
							onChange={(e) => {
								const val = e.target.value;
								if (settings.provider === "gemini")
									setSettings({ ...settings, geminiApiKey: val });
								else if (settings.provider === "openai")
									setSettings({ ...settings, openaiApiKey: val });
								else if (settings.provider === "ollama")
									setSettings({ ...settings, ollamaApiKey: val });
								else if (settings.provider === "lmstudio")
									setSettings({ ...settings, lmstudioApiKey: val });
								else setSettings({ ...settings, customApiKey: val });
							}}
							className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white font-mono text-sm"
						/>
					</div>
				</div>

				{/* Unified AI Generation Parameters & Context */}
				<div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-750">
					<div>
						<label
							htmlFor="system-instructions"
							className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							System Instructions (Context Injection Prompt)
						</label>
						<input
							id="system-instructions"
							type="text"
							value={settings.systemPrompt}
							onChange={(e) =>
								setSettings({ ...settings, systemPrompt: e.target.value })
							}
							className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
							placeholder="Default: You are an intelligent bookmark manager assistant."
						/>
						<span className="block text-[11px] text-gray-550 dark:text-gray-400 mt-1">
							If left empty, a default system context prompt will be
							automatically used.
						</span>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
						<div>
							<div className="flex justify-between items-center mb-2">
								<label
									htmlFor="setting-temp"
									className="text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Temperature (Creativity)
								</label>
								<span className="text-xs font-mono font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md">
									{settings.temperature}
								</span>
							</div>
							<input
								id="setting-temp"
								type="range"
								min="0.0"
								max="1.2"
								step="0.05"
								value={settings.temperature}
								onChange={(e) =>
									setSettings({
										...settings,
										temperature: parseFloat(e.target.value),
									})
								}
								className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
							/>
							<div className="flex justify-between text-[10px] text-gray-400 mt-1">
								<span>0.0 (Precise)</span>
								<span>1.2 (Creative)</span>
							</div>
						</div>

						<div>
							<div className="flex justify-between items-center mb-2">
								<label
									htmlFor="setting-max-tokens"
									className="text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Max Output Tokens
								</label>
								<button
									type="button"
									onClick={() => setSettings({ ...settings, maxTokens: 0 })}
									className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold hover:underline"
									title="Set to 0 to let the AI endpoint decide automatically"
								>
									Auto
								</button>
							</div>
							<input
								id="setting-max-tokens"
								type="number"
								min="0"
								step="128"
								value={settings.maxTokens}
								onChange={(e) => {
									const val = parseInt(e.target.value, 10);
									setSettings({
										...settings,
										maxTokens: Number.isNaN(val) ? 0 : Math.max(0, val),
									});
								}}
								placeholder="e.g. 4096, 32768, 128000"
								className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white font-mono text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
							/>
							<span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-1">
								{modelMeta[settings.model]?.outputTokenLimit
									? `Auto-detected from model: ${modelMeta[settings.model].outputTokenLimit.toLocaleString()} tokens (0 = omit limit)`
									: "Default 4096 · enter any value (e.g. 2048, 32768, 128000) · 0 = omit limit"}
							</span>
						</div>

						<div>
							<div className="flex justify-between items-center mb-2">
								<label
									htmlFor="setting-requests-limit"
									className="text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Rate Limit (RPM)
								</label>
								<button
									type="button"
									onClick={() =>
										setSettings({ ...settings, apiRequestsPerMinute: 15 })
									}
									className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold hover:underline"
									title="Set default value of 15 Requests Per Minute"
								>
									Default (15)
								</button>
							</div>
							<input
								id="setting-requests-limit"
								type="number"
								min="0"
								step="1"
								value={settings.apiRequestsPerMinute ?? 15}
								onChange={(e) => {
									const val = parseInt(e.target.value, 10);
									setSettings({
										...settings,
										apiRequestsPerMinute: Number.isNaN(val)
											? 0
											: Math.max(0, val),
									});
								}}
								placeholder="e.g. 15, 60, 0"
								className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white font-mono text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
							/>
							<span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-1">
								Requests Per Minute limit (e.g. for free Gemini API) · 0 =
								unlimited
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* SECTION 2: System & History Configuration */}
			<div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-6">
				<div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
					<Sliders className="text-purple-500" size={20} />
					<h3 className="font-semibold text-lg dark:text-white">
						System & History Configuration
					</h3>
				</div>

				<div>
					<div className="flex justify-between items-center mb-2">
						<label
							htmlFor="setting-history-limit"
							className="text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Database History Log Limit (Max Undo Snapshots)
						</label>
						<span className="text-xs font-mono font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md">
							{settings.maxHistoryEntries !== undefined
								? settings.maxHistoryEntries
								: 10}
						</span>
					</div>
					<input
						id="setting-history-limit"
						type="range"
						min="5"
						max="50"
						step="1"
						value={
							settings.maxHistoryEntries !== undefined
								? settings.maxHistoryEntries
								: 10
						}
						onChange={(e) =>
							setSettings({
								...settings,
								maxHistoryEntries: parseInt(e.target.value, 10),
							})
						}
						className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
					/>
					<div className="flex justify-between text-[10px] text-gray-400 mt-1">
						<span>5 entries</span>
						<span>50 entries (default 10)</span>
					</div>
				</div>
			</div>

			{/* SECTION 3: AI Auto-Organize Configuration */}
			<div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-6">
				<div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
					<div className="flex items-center gap-2">
						<Sparkles className="text-blue-500" size={20} />
						<h3 className="font-semibold text-lg dark:text-white">
							AI Auto-Organize
						</h3>
					</div>
					<button
						type="button"
						onClick={() =>
							setSettings({
								...settings,
								autoOrganizeEnabled: !settings.autoOrganizeEnabled,
							})
						}
						className={`w-12 h-6 rounded-full transition-colors flex items-center ${
							settings.autoOrganizeEnabled ? "bg-blue-600" : "bg-gray-300"
						} px-1`}
					>
						<div
							className={`w-4 h-4 rounded-full bg-white transition-transform ${
								settings.autoOrganizeEnabled ? "translate-x-6" : "translate-x-0"
							}`}
						/>
					</button>
				</div>

				<p className="text-sm text-gray-500 dark:text-gray-400">
					Automatically summarize, tag, and sort new bookmarks using AI. When
					you create a bookmark (via the UI or browser Star) in the monitored
					folder, it will be automatically processed and relocated to its
					relevant category folder.
				</p>

				{settings.autoOrganizeEnabled && (
					<div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-750">
						<div>
							<label
								htmlFor="monitored-folder"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
							>
								Monitored Bookmark Folder
							</label>
							<select
								id="monitored-folder"
								value={settings.monitoredFolderId ?? ""}
								onChange={(e) =>
									setSettings({
										...settings,
										monitoredFolderId: e.target.value,
									})
								}
								className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
							<p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
								Select a folder to monitor. If you choose the default option, a
								folder named <strong>ToSort</strong> will be automatically
								created and monitored.
							</p>
						</div>

						{/* Failed Bookmarks retry block */}
						{(() => {
							const effectiveFolderId = (() => {
								if (settings.monitoredFolderId)
									return settings.monitoredFolderId;
								const toSort = folders.find(
									(f) => f.name.toLowerCase() === "tosort",
								);
								return toSort ? toSort.id : "";
							})();
							const failedBookmarks = bookmarks.filter(
								(b) =>
									b.aiFailed ||
									(effectiveFolderId !== "" &&
										b.folderId === effectiveFolderId &&
										!b.summary),
							);

							if (failedBookmarks.length === 0) return null;

							return (
								<div className="pt-4 border-t border-gray-100 dark:border-gray-750 space-y-3">
									<h4 className="text-sm font-bold text-red-500 flex items-center gap-1.5">
										<AlertCircle size={15} />
										Unorganized / Failed Bookmarks ({failedBookmarks.length})
									</h4>
									<p className="text-xs text-gray-500 dark:text-gray-450">
										The following bookmarks are in the monitored folder but
										failed to be automatically organized by AI. You can retry
										processing them.
									</p>
									<div className="max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-750 rounded-xl divide-y divide-gray-100 dark:divide-gray-750 bg-gray-50/50 dark:bg-gray-900/30">
										{failedBookmarks.map((bm) => (
											<div
												key={bm.id}
												className="flex items-center justify-between gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
											>
												<div className="min-w-0 flex-1">
													<span className="font-semibold text-xs text-gray-805 dark:text-gray-250 block truncate">
														{bm.title}
													</span>
													<span className="text-[10px] text-gray-405 dark:text-gray-500 block truncate">
														{bm.url}
													</span>
												</div>
												<button
													type="button"
													onClick={() =>
														triggerAutoOrganize(
															bm.id,
															bm.title,
															bm.url,
															bm.folderId,
														)
													}
													className="px-3 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-900/30 transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm shrink-0"
												>
													Retry Organizing
												</button>
											</div>
										))}
									</div>
								</div>
							);
						})()}
					</div>
				)}
			</div>

			{/* FOOTER ACTIONS */}
			<div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
				<div>
					<h3 className="font-semibold dark:text-white flex items-center gap-1">
						Appearance Profile
					</h3>
					<p className="text-sm text-gray-500">
						Toggle dark mode override globally
					</p>
				</div>
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() =>
							setSettings({ ...settings, darkMode: !settings.darkMode })
						}
						className={`w-12 h-6 rounded-full transition-colors flex items-center ${settings.darkMode ? "bg-blue-600" : "bg-gray-300"} px-1`}
					>
						<div
							className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.darkMode ? "translate-x-6" : "translate-x-0"}`}
						/>
					</button>

					<button
						type="button"
						onClick={handleSave}
						className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm active:scale-95 flex items-center gap-2"
					>
						{localSaving ? "Settings Applied!" : "Apply Parameters"}
					</button>
				</div>
			</div>
		</div>
	);
}
