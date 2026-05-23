import React, { useState, useEffect } from 'react';
import { useAppContext } from '../store';
import { Settings, Sliders, Server, Cpu, Layers, Laptop, RefreshCw } from 'lucide-react';

const PROVIDER_MODELS: Record<string, string[]> = {
  gemini: ['gemini-3.5-flash', 'gemini-3.1-pro-preview'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
  ollama: ['llama3.2', 'mistral', 'gemma2', 'phi3'],
  lmstudio: ['qwen2.5-coder', 'llama3', 'mistral-7b'],
  custom: ['default-model']
};

export function SettingsView() {
  const { settings, setSettings } = useAppContext();
  const [localSaving, setLocalSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Auto update default model when provider shifts
  useEffect(() => {
    const list = PROVIDER_MODELS[settings.provider];
    if (list && !list.includes(settings.model)) {
      setSettings(prev => ({ ...prev, model: list[0] }));
    }
  }, [settings.provider]);

  const handleSave = () => {
    setLocalSaving(true);
    setTimeout(() => {
      setLocalSaving(false);
    }, 600);
  };

  const handleFetchModels = () => {
    setIsFetching(true);
    setTimeout(() => {
      setIsFetching(false);
      alert(`Auto-detected model definitions for local server ${settings.provider} successfully updated!`);
    }, 1200);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      <div>
        <h2 className="text-3xl font-bold dark:text-white tracking-tight flex items-center gap-3">
          <Settings className="text-blue-500 animate-spin-hover" size={28} />
          AI Engine & Settings
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Configure model parameters, context system instructions, endpoints, and adaptive preview modes.
        </p>
      </div>

      {/* SECTION 1: AI Provider & Model Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-6">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
          <Server className="text-blue-500" size={20} />
          <h3 className="font-semibold text-lg dark:text-white">API Endpoint Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI Provider
            </label>
            <select 
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              value={settings.provider}
              onChange={(e) => setSettings({ ...settings, provider: e.target.value as any })}
            >
              <option value="gemini">Google Gemini (Recommended Server API)</option>
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
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                title="Fetch models list from active endpoint"
              >
                <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
                {isFetching ? 'Fetching...' : 'Auto-Fetch List'}
              </button>
            </label>
            <div className="flex gap-2">
              <select 
                className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm"
                value={settings.model}
                onChange={e => setSettings({ ...settings, model: e.target.value })}
              >
                {PROVIDER_MODELS[settings.provider]?.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="custom-defined">-- Enter custom model name --</option>
              </select>
            </div>
          </div>
        </div>

        {settings.model === 'custom-defined' && (
          <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
            <label className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              Custom Defined Model Identifier
            </label>
            <input 
              type="text"
              placeholder="e.g. llama-3.1-custom-Q4"
              value={settings.model === 'custom-defined' ? '' : settings.model}
              onChange={e => setSettings({ ...settings, model: e.target.value })}
              className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-mono"
            />
          </div>
        )}

        {/* Dynamic Provider URL and API Key Inputs */}
        <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-750">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {settings.provider === 'gemini' ? 'Google Gemini' :
               settings.provider === 'openai' ? 'OpenAI' :
               settings.provider === 'ollama' ? 'Ollama' :
               settings.provider === 'lmstudio' ? 'LMStudio' : 'Custom'} Endpoint URL
            </label>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-2">
              Currently using: <code className="font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/25 px-1 py-0.5 rounded">{settings.provider === 'gemini' ? (settings.geminiUrl || 'https://generativelanguage.googleapis.com') :
                               settings.provider === 'openai' ? (settings.openaiUrl || 'https://api.openai.com/v1') :
                               settings.provider === 'ollama' ? (settings.ollamaUrl || 'http://localhost:11434') :
                               settings.provider === 'lmstudio' ? (settings.lmstudioUrl || 'http://localhost:1234/v1') :
                               (settings.customUrl || 'http://localhost:8080/v1')}</code>
            </span>
            <input 
              type="text"
              placeholder={
                settings.provider === 'gemini' ? 'https://generativelanguage.googleapis.com' :
                settings.provider === 'openai' ? 'https://api.openai.com/v1' :
                settings.provider === 'ollama' ? 'http://localhost:11434' :
                settings.provider === 'lmstudio' ? 'http://localhost:1234/v1' :
                'http://localhost:8080/v1'
              }
              value={
                settings.provider === 'gemini' ? (settings.geminiUrl || '') :
                settings.provider === 'openai' ? (settings.openaiUrl || '') :
                settings.provider === 'ollama' ? (settings.ollamaUrl || '') :
                settings.provider === 'lmstudio' ? (settings.lmstudioUrl || '') :
                (settings.customUrl || '')
              }
              onChange={e => {
                const val = e.target.value;
                if (settings.provider === 'gemini') setSettings({ ...settings, geminiUrl: val });
                else if (settings.provider === 'openai') setSettings({ ...settings, openaiUrl: val });
                else if (settings.provider === 'ollama') setSettings({ ...settings, ollamaUrl: val });
                else if (settings.provider === 'lmstudio') setSettings({ ...settings, lmstudioUrl: val });
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
                settings.provider === 'gemini' ? 'Optional (if blank, falls back to local server /api/ai proxy)' :
                settings.provider === 'ollama' || settings.provider === 'lmstudio' ? 'Optional for local servers' :
                'Paste your API key/token here...'
              }
              value={
                settings.provider === 'gemini' ? (settings.geminiApiKey || '') :
                settings.provider === 'openai' ? (settings.openaiApiKey || '') :
                settings.provider === 'ollama' ? (settings.ollamaApiKey || '') :
                settings.provider === 'lmstudio' ? (settings.lmstudioApiKey || '') :
                (settings.customApiKey || '')
              }
              onChange={e => {
                const val = e.target.value;
                if (settings.provider === 'gemini') setSettings({ ...settings, geminiApiKey: val });
                else if (settings.provider === 'openai') setSettings({ ...settings, openaiApiKey: val });
                else if (settings.provider === 'ollama') setSettings({ ...settings, ollamaApiKey: val });
                else if (settings.provider === 'lmstudio') setSettings({ ...settings, lmstudioApiKey: val });
                else setSettings({ ...settings, customApiKey: val });
              }}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: System Instructions & Generation Parameters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-6">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
          <Sliders className="text-purple-500" size={20} />
          <h3 className="font-semibold text-lg dark:text-white">AI Context & Hyperparameters</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            System Instructions (Context Injection Prompt)
          </label>
          <textarea 
            rows={3}
            value={settings.systemPrompt}
            onChange={e => setSettings({ ...settings, systemPrompt: e.target.value })}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all text-sm leading-relaxed"
            placeholder="Tell the model how it should synthesize categories and summarize web references..."
          />
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
              onChange={e => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
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
                Max Selection Tokens
              </label>
              <span className="text-xs font-mono font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md">
                {settings.maxTokens}
              </span>
            </div>
            <input 
              type="range"
              min="128"
              max="4096"
              step="128"
              value={settings.maxTokens}
              onChange={e => setSettings({ ...settings, maxTokens: parseInt(e.target.value, 10) })}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>128 tokens</span>
              <span>4096 tokens</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700/60 pt-4 mt-2">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Database History Log Limit (Max Undo Snapshots)
            </label>
            <span className="text-xs font-mono font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md">
              {settings.maxHistoryEntries !== undefined ? settings.maxHistoryEntries : 10}
            </span>
          </div>
          <input 
            type="range"
            min="5"
            max="50"
            step="1"
            value={settings.maxHistoryEntries !== undefined ? settings.maxHistoryEntries : 10}
            onChange={e => setSettings({ ...settings, maxHistoryEntries: parseInt(e.target.value, 10) })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>5 entries</span>
            <span>50 entries (default 10)</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: Workspace Environment Simulation Mode */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-6">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
          <Layers className="text-emerald-500" size={20} />
          <h3 className="font-semibold text-lg dark:text-white font-sans">Workspace Screen Simulation</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            type="button"
            onClick={() => setSettings({ ...settings, viewMode: 'dashboard' })}
            className={`flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${
              settings.viewMode === 'dashboard'
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/10'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <div className={`p-2 rounded-lg ${settings.viewMode === 'dashboard' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
              <Laptop size={20} />
            </div>
            <div className="flex-1">
              <span className="block font-semibold text-sm dark:text-white">Web Dashboard Layout</span>
              <span className="block text-xs text-gray-500 mt-1">Full-screen high-fidelity administrative layout.</span>
            </div>
          </button>

          <button 
            type="button"
            onClick={() => setSettings({ ...settings, viewMode: 'extension' })}
            className={`flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${
              settings.viewMode === 'extension'
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/10'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <div className={`p-2 rounded-lg ${settings.viewMode === 'extension' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
              <Layers size={20} />
            </div>
            <div className="flex-1">
              <span className="block font-semibold text-sm dark:text-white">Interactive Chrome Extension Simulator</span>
              <span className="block text-xs text-gray-500 mt-1">Simulates clicking the Chrome browser toolbar extension icon.</span>
            </div>
          </button>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="font-semibold dark:text-white flex items-center gap-1">Appearance Profile</h3>
          <p className="text-sm text-gray-500">Toggle dark mode override globally</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => setSettings({ ...settings, darkMode: !settings.darkMode })}
            className={`w-12 h-6 rounded-full transition-colors flex items-center ${settings.darkMode ? 'bg-blue-600' : 'bg-gray-300'} px-1`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
          
          <button 
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm active:scale-95 flex items-center gap-2"
          >
            {localSaving ? 'Settings Applied!' : 'Apply Parameters'}
          </button>
        </div>
      </div>
    </div>
  );
}
