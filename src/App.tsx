import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { BookmarksView } from './components/BookmarksView';
import { CategoriesView } from './components/CategoriesView';
import { DuplicatesView } from './components/DuplicatesView';
import { SettingsView } from './components/SettingsView';
import { AppProvider, useAppContext } from './store';
import { Bookmark, Folder } from './types';
import { Monitor, Layers, ShieldCheck, Cpu, RefreshCw, Sparkles, FolderPlus, Compass, ArrowLeft, ArrowRight, Home, PlusSquare } from 'lucide-react';

const PRESETS: Record<string, { bms: Bookmark[], fols: Folder[] }> = {
  software: {
    fols: [
      { id: 'f_react', parentId: null, name: 'Frontend React', promptContext: 'React libraries, hooks, css-in-js, tailwind framework, vite builds.' },
      { id: 'f_back', parentId: null, name: 'Cloud & Database', promptContext: 'Express endpoints, GCP hosting, persistent database schemas, SQL, firebase.' },
      { id: 'f_sub_css', parentId: 'f_react', name: 'Micro Styling CSS', promptContext: 'Sleek buttons, animations, keyframes, transitions.' }
    ],
    bms: [
      { id: 'b1', title: 'React Documentation - Quick Start Core', url: 'https://react.dev/reference/react', folderId: 'f_react', tags: ['docs', 'react'], summary: 'Primary React components manual.', dateAdded: Date.now() },
      { id: 'b2', title: 'Tailwind CSS Class Reference Layout', url: 'https://tailwindcss.com/docs', folderId: 'f_react', tags: ['styling', 'css'], summary: 'Fluid utility layout styling references.', dateAdded: Date.now() - 100 },
      { id: 'b3', title: 'Express.js - Node Server Framework', url: 'https://expressjs.com', folderId: 'f_back', tags: ['backend', 'node'], summary: '', dateAdded: Date.now() - 200 },
      { id: 'b4', title: 'Vite Bundler Fast HMR Builds', url: 'https://vite.dev', folderId: 'f_react', tags: ['build', 'vite'], summary: 'Modern frontend compilation and bundling asset loader.', dateAdded: Date.now() - 110 },
      { id: 'b5', title: 'Node Server Fast Execution', url: 'https://expressjs.com', folderId: null, tags: ['backend'], summary: 'Duplicate node link to test cleanser.', dateAdded: Date.now() - 300 }
    ]
  },
  culture: {
    fols: [
      { id: 'f_news', parentId: null, name: 'Daily News', promptContext: 'Breaking articles, world politics, international headlines.' },
      { id: 'f_arts', parentId: null, name: 'Fine Arts & Design', promptContext: 'Design inspiration, high-resolution visual art, creative museums.' }
    ],
    bms: [
      { id: 'c1', title: 'The New York Times Online Daily', url: 'https://nytimes.com', folderId: 'f_news', tags: ['news', 'media'], summary: 'Latest breaking world and country columns.', dateAdded: Date.now() },
      { id: 'c2', title: 'Behance Portfolio Design Deck', url: 'https://behance.net', folderId: 'f_arts', tags: ['inspiration', 'arts'], summary: 'High quality interface layout showcases.', dateAdded: Date.now() - 400 },
      { id: 'c3', title: 'CNN International Global Broadcast', url: 'https://cnn.com', folderId: 'f_news', tags: ['news', 'channel'], summary: '', dateAdded: Date.now() - 500 }
    ]
  }
};

function AppLayout() {
  const { bookmarks, settings, setSettings, setBookmarks, setFolders } = useAppContext();
  const [activeTab, setActiveTab] = useState('bookmarks');
  const [chromePopupOpen, setChromePopupOpen] = useState(true);

  // Quick Preset Injector
  const injectPreset = (key: string) => {
    const data = PRESETS[key];
    if (data) {
      setBookmarks(data.bms);
      setFolders(data.fols);
      alert(`Injected ${data.bms.length} bookmarks and ${data.fols.length} folder structures! Go to Categories or Bookmarks view to test semantic analysis.`);
    }
  };

  const clearAllBookmarks = () => {
    if (confirm("Are you sure you want to clear your current selection database?")) {
      setBookmarks([]);
      setFolders([]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex flex-col transition-all duration-300">
      
      {/* SIMULATOR CONTROLS TOP BAR */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 shadow-sm">
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-md">
            <Cpu size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-950 dark:text-white text-base">Chrome Extension Dev Sandbox</span>
              <span className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Active</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Test simulated Chrome extension dropdown popups & folders instantly.</p>
          </div>
        </div>

        {/* CONTROLS AREA */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* PRESETS */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 font-medium items-center gap-2">
            <span className="px-2 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Dataset Prefab:</span>
            <button 
              type="button"
              onClick={() => injectPreset('software')}
              className="bg-white dark:bg-gray-750 px-3 py-1.5 rounded-lg hover:shadow-sm font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
            >
              💻 Dev Resources
            </button>
            <button 
              type="button"
              onClick={() => injectPreset('culture')}
              className="bg-white dark:bg-gray-750 px-3 py-1.5 rounded-lg hover:shadow-sm font-semibold hover:text-purple-600 dark:hover:text-purple-400 transition-all cursor-pointer"
            >
              🎨 Creative News
            </button>
            <button 
              type="button"
              onClick={clearAllBookmarks}
              className="text-red-500 hover:text-red-600 font-bold px-2 py-1 transition-all"
            >
              Reset
            </button>
          </div>

          {/* VIEW MODE SELECTOR */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button 
              type="button"
              onClick={() => setSettings(prev => ({ ...prev, viewMode: 'dashboard' }))}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                settings.viewMode === 'dashboard'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              <Monitor size={14} />
              Full Dashboard
            </button>
            <button 
              type="button"
              onClick={() => setSettings(prev => ({ ...prev, viewMode: 'extension' }))}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                settings.viewMode === 'extension'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              <Layers size={14} />
              Chrome Plugin Popup
            </button>
          </div>
        </div>

      </header>

      {/* CORE WORKSPACE PANEL */}
      <div className="flex-1 flex overflow-hidden">
        
        {settings.viewMode === 'dashboard' ? (
          /* =======================================
             1. FULL-SCREEN WEB DASHBOARD VIEW
             ======================================= */
          <div className="flex-1 flex overflow-hidden">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
              {activeTab === 'bookmarks' && <BookmarksView />}
              {activeTab === 'categories' && <CategoriesView />}
              {activeTab === 'duplicates' && <DuplicatesView />}
              {activeTab === 'settings' && <SettingsView />}
            </main>
          </div>
        ) : (
          /* =======================================
             2. HIGH-FIDELITY CHROME WINDOW SIMULATION VIEW
             ======================================= */
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-gray-200 to-gray-300 dark:from-gray-900 dark:to-gray-950 overflow-y-auto min-h-[700px]">
            
            {/* GOOGLE CHROME BROWSER WRAPPER */}
            <div className="w-full max-w-4xl bg-[#f2f3f5] dark:bg-gray-800/90 rounded-2xl shadow-2xl overflow-hidden border border-gray-300/60 dark:border-gray-800 flex flex-col transition-all duration-300">
              
              {/* CHROME WINDOW HEADER / TABS */}
              <div className="bg-[#dee1e6] dark:bg-gray-800 px-4 pt-3 flex items-center justify-between border-b border-gray-300 dark:border-gray-700">
                <div className="flex items-center gap-1">
                  
                  {/* WINDOW ACTIONS DOTS */}
                  <div className="flex gap-1.5 mr-4">
                    <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-green-400 inline-block" />
                  </div>

                  {/* ACTIVE TAB */}
                  <div className="bg-white dark:bg-gray-900 px-4 py-2 rounded-t-xl text-[11px] font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 border-r border-t border-l border-gray-300/40 dark:border-gray-700 shadow-sm">
                    <Compass size={12} className="text-blue-500 animate-spin-hover" />
                    <span>My Dashboard Landing Page</span>
                  </div>

                  {/* RESTING TAB */}
                  <div className="px-4 py-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400 hidden sm:flex items-center gap-1 hover:bg-gray-200/50 rounded-t-xl transition-colors">
                    <span>Google.com Search</span>
                  </div>
                </div>

                <span className="text-xs font-semibold text-gray-400 font-mono pr-2">chrome_browser.exe</span>
              </div>

              {/* CHROME WINDOW NAVIGATION TOOLBAR */}
              <div className="bg-white dark:bg-gray-900 px-4 py-2 flex items-center gap-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex gap-2.5 text-gray-400 dark:text-gray-500">
                  <ArrowLeft size={16} className="cursor-not-allowed" />
                  <ArrowRight size={16} className="cursor-not-allowed" />
                  <RefreshCw size={15} />
                  <Home size={15} className="text-gray-500" />
                </div>

                {/* ADDRESS BAR */}
                <div className="flex-1 bg-[#efeff1] dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 px-3.5 text-xs text-gray-600 dark:text-gray-400 flex items-center justify-between font-mono">
                  <span>chrome-extension://ai-bookmark-manager/popup.html</span>
                  <span className="text-[10px] text-gray-400 bg-gray-200 dark:bg-gray-800 px-1.5 rounded uppercase font-bold tracking-wider scale-95">Security Verified</span>
                </div>

                {/* EXTENSION BAR LISTING */}
                <div className="flex items-center gap-2 relative">
                  <button 
                    onClick={() => setChromePopupOpen(!chromePopupOpen)}
                    type="button"
                    className={`p-2 rounded-xl transition-all cursor-pointer relative ${
                      chromePopupOpen 
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 scale-105 shadow-sm' 
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    title="Toggle AI Bookmark Manager Extension Dropdown"
                  >
                    <Cpu size={20} className="animate-spin-hover" />
                    {/* Badge */}
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[9px] font-bold flex items-center justify-center border border-white">
                      {bookmarks.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* BROWSER VIEW CANVAS */}
              <div className="h-[600px] overflow-hidden bg-gray-50 dark:bg-gray-950 flex relative">
                
                {/* DEFAULT WEBPAGE DISPLAYED IN BROWSER ROOT */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400/80 bg-slate-50 dark:bg-slate-900/40 relative">
                  <Compass size={60} className="text-gray-300 dark:text-gray-700 mb-4" />
                  <h3 className="font-bold text-lg text-gray-700 dark:text-gray-200">Modern Browser Client Core Workspace</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-450 max-w-sm mt-1.5 leading-relaxed">
                    This simulated space mimics your standard internet browser viewing field. Click the highlighted blue extension icon in the toolbar above to deploy the extension dropdown popover.
                  </p>

                  <div className="mt-6 flex flex-col gap-2 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest block mb-2">Simulation Sandbox Info</span>
                    <button 
                      onClick={() => setChromePopupOpen(true)}
                      className="bg-blue-600 text-white hover:bg-blue-700 text-xs px-4 py-2 rounded-lg font-bold transition-all"
                    >
                      Trigger Plugin Popup Popup
                    </button>
                  </div>
                </div>

                {/* CHROME EXTENSION DROPDOWN PANEL POPUP LAYOUT */}
                {chromePopupOpen && (
                  <div className="absolute top-2 right-2 w-[430px] h-[550px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 shadow-2xl rounded-2xl flex flex-col overflow-hidden z-20 animate-scale-up">
                    
                    {/* EXTENSION INTERNAL HEADER CONTROLS */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3.5 flex items-center justify-between flex-shrink-0 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Cpu size={18} />
                        <span className="font-bold text-sm tracking-tight">AI Bookmarks Manager Client</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setSettings(prev => ({ ...prev, viewMode: 'dashboard' }));
                          }}
                          className="bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-all"
                          title="Expand popup page to full administrative layout"
                        >
                          Maximize to Dashboard Layout ↗
                        </button>
                        <button onClick={() => setChromePopupOpen(false)} className="hover:bg-white/15 p-1 rounded">
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* EXTENSION SUBMENU TABS */}
                    <div className="flex bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 font-semibold text-center flex-shrink-0">
                      <button 
                        onClick={() => setActiveTab('bookmarks')}
                        className={`flex-1 py-2 border-b-2 transition-colors ${activeTab === 'bookmarks' ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900' : 'border-transparent hover:text-gray-800 dark:hover:text-gray-100'}`}
                      >
                        Links
                      </button>
                      <button 
                        onClick={() => setActiveTab('categories')}
                        className={`flex-1 py-2 border-b-2 transition-colors ${activeTab === 'categories' ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900' : 'border-transparent hover:text-gray-800 dark:hover:text-gray-100'}`}
                      >
                        Folders Tree
                      </button>
                      <button 
                        onClick={() => setActiveTab('duplicates')}
                        className={`flex-1 py-2 border-b-2 transition-colors ${activeTab === 'duplicates' ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900' : 'border-transparent hover:text-gray-800 dark:hover:text-gray-100'}`}
                      >
                        Duplicates
                      </button>
                      <button 
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 py-2 border-b-2 transition-colors ${activeTab === 'settings' ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900' : 'border-transparent hover:text-gray-800 dark:hover:text-gray-100'}`}
                      >
                        Params
                      </button>
                    </div>

                    {/* EXTENSION CONTENT FRAME */}
                    <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-900">
                      {activeTab === 'bookmarks' && <BookmarksView />}
                      {activeTab === 'categories' && <CategoriesView />}
                      {activeTab === 'duplicates' && <DuplicatesView />}
                      {activeTab === 'settings' && <SettingsView />}
                    </div>
                  </div>
                )}

              </div>
            </div>
            
          </div>
        )
        }

      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}
