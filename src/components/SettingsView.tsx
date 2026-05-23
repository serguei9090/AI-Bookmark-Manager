import React, { useState, useEffect } from "react";
import { useAppContext } from "../store";
import {
  Settings,
  Sliders,
  Server,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

/** Resolve the active base URL for a given provider from settings */
const resolveBaseUrl = (settings: any): string => {
  switch (settings.provider) {
    case "gemini":
      return (
        settings.geminiUrl || "https://generativelanguage.googleapis.com"
      ).replace(/\/$/, "");
    case "openai":
      return (settings.openaiUrl || "https://api.openai.com").replace(
        /\/$/,
        "",
      );
    case "ollama":
      return (settings.ollamaUrl || "http://localhost:11434").replace(
        /\/$/,
        "",
      );
    case "lmstudio":
      return (settings.lmstudioUrl || "http://localhost:1234").replace(
        /\/$/,
        "",
      );
    default:
      return (settings.customUrl || "http://localhost:8080").replace(/\/$/, "");
  }
};

const resolveApiKey = (settings: any): string => {
  switch (settings.provider) {
    case "gemini":
      return settings.geminiApiKey || "";
    case "openai":
      return settings.openaiApiKey || "";
    case "ollama":
      return settings.ollamaApiKey || "";
    case "lmstudio":
      return settings.lmstudioApiKey || "";
    default:
      return settings.customApiKey || "";
  }
};

export function SettingsView() {
  const { settings, setSettings } = useAppContext();
  const [localSaving, setLocalSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Clear fetched model list when provider changes
  useEffect(() => {
    setFetchedModels([]);
    setFetchError(null);
  }, [settings.provider]);

  const handleSave = () => {
    setLocalSaving(true);
    setTimeout(() => setLocalSaving(false), 600);
  };

  const handleFetchModels = async () => {
    setIsFetching(true);
    setFetchError(null);
    const base = resolveBaseUrl(settings);
    const apiKey = resolveApiKey(settings);

    try {
      let models: string[] = [];

      if (settings.provider === "gemini") {
        // Gemini: GET /v1beta/models?key=...
        const isFullUrl = base.includes("/v1");
        const listUrl = isFullUrl
          ? `${base}/models?key=${apiKey}`
          : `${base}/v1beta/models?key=${apiKey}`;
        const res = await fetch(listUrl);
        if (!res.ok) throw new Error(`Gemini API returned ${res.status}`);
        const data = await res.json();
        models = (data.models || [])
          // Only include models that support generateContent
          .filter((m: any) =>
            (m.supportedGenerationMethods || []).includes("generateContent"),
          )
          .map((m: any) => (m.name || "").replace(/^models\//, ""))
          .filter(Boolean);
      } else if (settings.provider === "openai") {
        // OpenAI: GET /v1/models  with Bearer auth
        const res = await fetch(`${base}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) throw new Error(`OpenAI API returned ${res.status}`);
        const data = await res.json();
        models = (data.data || [])
          .map((m: any) => m.id)
          .filter(Boolean)
          .sort();
      } else if (settings.provider === "ollama") {
        // Ollama: GET /api/tags  (no auth)
        const res = await fetch(`${base}/api/tags`);
        if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
        const data = await res.json();
        models = (data.models || [])
          .map((m: any) => m.name)
          .filter(Boolean)
          .sort();
      } else {
        // LMStudio / Custom: OpenAI-compatible GET /v1/models
        const url = base.includes("/v1")
          ? `${base}/models`
          : `${base}/v1/models`;
        const headers: Record<string, string> = {};
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Endpoint returned ${res.status}`);
        const data = await res.json();
        models = (data.data || [])
          .map((m: any) => m.id)
          .filter(Boolean)
          .sort();
      }

      if (models.length === 0)
        throw new Error("No models returned by endpoint");
      setFetchedModels(models);
      // Auto-select first model if current selection not in new list
      if (!models.includes(settings.model)) {
        setSettings((prev: any) => ({ ...prev, model: models[0] }));
      }
    } catch (err: any) {
      setFetchError(err.message || "Failed to fetch models");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      <div>
        <h2 className="text-3xl font-bold dark:text-white tracking-tight flex items-center gap-3">
          <Settings className="text-blue-500 animate-spin-hover" size={28} />
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI Provider
            </label>
            <select
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              value={settings.provider}
              onChange={(e) =>
                setSettings({ ...settings, provider: e.target.value as any })
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
              <button
                onClick={handleFetchModels}
                disabled={isFetching}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 disabled:opacity-50"
                title="Fetch live model list from the configured endpoint"
              >
                <RefreshCw
                  size={12}
                  className={isFetching ? "animate-spin" : ""}
                />
                {isFetching ? "Fetching..." : "Auto-Fetch List"}
              </button>
            </label>

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
                value={settings.model}
                onChange={(e) =>
                  setSettings({ ...settings, model: e.target.value })
                }
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
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
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

        {settings.model === "custom-defined" && (
          <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
            <label className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              Custom Defined Model Identifier
            </label>
            <input
              type="text"
              placeholder="e.g. llama-3.1-custom-Q4"
              value={settings.model === "custom-defined" ? "" : settings.model}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key / Secret Token
            </label>
            <input
              type="password"
              placeholder={
                settings.provider === "gemini"
                  ? "Optional (if blank, falls back to local server /api/ai proxy)"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              System Instructions (Context Injection Prompt)
            </label>
            <input
              type="text"
              value={settings.systemPrompt}
              onChange={(e) =>
                setSettings({ ...settings, systemPrompt: e.target.value })
              }
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Default: You are an intelligent bookmark manager assistant."
            />
            <span className="block text-[11px] text-gray-505 dark:text-gray-400 mt-1">
              If left empty, a default system context prompt will be
              automatically used.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Temperature (Creativity)
                </label>
                <span className="text-xs font-mono font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md">
                  {settings.temperature}
                </span>
              </div>
              <input
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
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Max Output Tokens
                </label>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, maxTokens: 4096 })}
                  className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold hover:underline"
                  title="Set to 0 to let the AI endpoint decide automatically"
                >
                  Auto
                </button>
              </div>
              <input
                type="number"
                min="0"
                step="128"
                value={settings.maxTokens}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setSettings({
                    ...settings,
                    maxTokens: isNaN(val) ? 0 : Math.max(0, val),
                  });
                }}
                placeholder="e.g. 4096, 32768, 128000"
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white font-mono text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              />
              <span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                Default 4096 · enter any value (e.g. 2048, 32768, 128000) · 0 =
                omit limit
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Database History Log Limit (Max Undo Snapshots)
            </label>
            <span className="text-xs font-mono font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md">
              {settings.maxHistoryEntries !== undefined
                ? settings.maxHistoryEntries
                : 10}
            </span>
          </div>
          <input
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
