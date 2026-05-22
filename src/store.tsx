import React, { createContext, useContext, useEffect, useState } from 'react';
import { Bookmark, Folder, Settings, Proposal, HistoryEntry } from './types';

// Mock Initial Data
const initialBookmarks: Bookmark[] = [
  { id: '1', title: 'GitHub - google/genai', url: 'https://github.com/google/genai', folderId: null, tags: [], summary: '', dateAdded: Date.now() },
  { id: '2', title: 'React Documentation', url: 'https://react.dev', folderId: null, tags: [], summary: '', dateAdded: Date.now() - 1000 },
  { id: '3', title: 'Tailwind CSS', url: 'https://tailwindcss.com', folderId: 'f1', tags: ['css'], summary: 'Styling framework', dateAdded: Date.now() - 2000 },
  { id: '4', title: 'MDN Web Docs', url: 'https://developer.mozilla.org', folderId: null, tags: [], summary: '', dateAdded: Date.now() - 3000 },
  { id: '5', title: 'Stack Overflow', url: 'https://stackoverflow.com', folderId: null, tags: [], summary: '', dateAdded: Date.now() - 4000 },
  { id: '6', title: 'Stack Overflow (Dupe)', url: 'https://stackoverflow.com', folderId: null, tags: [], summary: '', dateAdded: Date.now() - 5000 },
];

const initialFolders: Folder[] = [
  { id: 'f1', name: 'Web Dev', parentId: null, promptContext: 'Resources related to web development, CSS, HTML, JS.' },
];

const initialSettings: Settings = {
  provider: 'gemini',
  model: 'gemini-3.5-flash',
  customUrl: '',
  apiKey: '',
  systemPrompt: 'You are an intelligent bookmark manager assistant.',
  darkMode: true,
  temperature: 0.7,
  maxTokens: 1024,
  viewMode: 'dashboard',
};

type AppContextType = {
  bookmarks: Bookmark[];
  folders: Folder[];
  settings: Settings;
  history: HistoryEntry[];
  setBookmarks: React.Dispatch<React.SetStateAction<Bookmark[]>>;
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  updateBookmark: (id: string, updates: Partial<Bookmark>) => void;
  deleteBookmark: (id: string) => void;
  addBookmark: (bookmark: Bookmark) => void;
  batchUpdateBookmarks: (newBookmarks: Bookmark[], description: string) => void;
  bulkDeleteBookmarks: (ids: string[], description: string) => void;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  addFolder: (folder: Folder) => void;
  deleteFolder: (id: string) => void;
  revertToState: (id: string) => void;
  clearHistory: () => void;
  injectPresetData: (name: string, bms: Bookmark[], fols: Folder[]) => void;
  clearDatabase: () => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    const saved = localStorage.getItem('bm_bookmarks');
    return saved ? JSON.parse(saved) : initialBookmarks;
  });

  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem('bm_folders');
    return saved ? JSON.parse(saved) : initialFolders;
  });

  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('bm_settings');
    return saved ? JSON.parse(saved) : initialSettings;
  });

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('bm_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('bm_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('bm_folders', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('bm_settings', JSON.stringify(settings));
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('bm_history', JSON.stringify(history));
  }, [history]);

  const pushHistory = (description: string, currentBookmarks: Bookmark[], currentFolders: Folder[]) => {
    setHistory(prev => {
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        bookmarks: currentBookmarks,
        folders: currentFolders,
        timestamp: Date.now(),
        description
      };
      return [entry, ...prev].slice(0, 10);
    });
  };

  const updateBookmark = (id: string, updates: Partial<Bookmark>) => {
    const bm = bookmarks.find(b => b.id === id);
    pushHistory(`Updated bookmark: ${bm ? bm.title : id}`, bookmarks, folders);
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBookmark = (id: string) => {
    const bm = bookmarks.find(b => b.id === id);
    pushHistory(`Deleted bookmark: ${bm ? bm.title : id}`, bookmarks, folders);
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const addBookmark = (bookmark: Bookmark) => {
    pushHistory(`Added bookmark: ${bookmark.title}`, bookmarks, folders);
    setBookmarks(prev => [bookmark, ...prev]);
  };

  const batchUpdateBookmarks = (newBookmarks: Bookmark[], description: string) => {
    pushHistory(description, bookmarks, folders);
    setBookmarks(newBookmarks);
  };

  const bulkDeleteBookmarks = (ids: string[], description: string) => {
    pushHistory(description, bookmarks, folders);
    setBookmarks(prev => prev.filter(b => !ids.includes(b.id)));
  };

  const updateFolder = (id: string, updates: Partial<Folder>) => {
    const fol = folders.find(f => f.id === id);
    pushHistory(`Updated folder: ${fol ? fol.name : id}`, bookmarks, folders);
    setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const addFolder = (folder: Folder) => {
    pushHistory(`Added folder: ${folder.name}`, bookmarks, folders);
    setFolders(prev => [...prev, folder]);
  };

  const deleteFolder = (id: string) => {
    const fol = folders.find(f => f.id === id);
    pushHistory(`Deleted folder: ${fol ? fol.name : id}`, bookmarks, folders);
    setFolders(prev => prev.filter(f => f.id !== id));
    setBookmarks(prev => prev.map(b => b.folderId === id ? { ...b, folderId: null } : b));
  };

  const revertToState = (id: string) => {
    const entry = history.find(h => h.id === id);
    if (!entry) return;
    pushHistory(`Reverted to: ${entry.description}`, bookmarks, folders);
    setBookmarks(entry.bookmarks);
    setFolders(entry.folders);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const injectPresetData = (name: string, bms: Bookmark[], fols: Folder[]) => {
    pushHistory(`Injected preset: ${name}`, bookmarks, folders);
    setBookmarks(bms);
    setFolders(fols);
  };

  const clearDatabase = () => {
    pushHistory('Cleared bookmarks and folders database', bookmarks, folders);
    setBookmarks([]);
    setFolders([]);
  };

  return (
    <AppContext.Provider value={{
      bookmarks, folders, settings, history,
      setBookmarks, setFolders, setSettings,
      updateBookmark, deleteBookmark, addBookmark, batchUpdateBookmarks, bulkDeleteBookmarks,
      updateFolder, addFolder, deleteFolder, revertToState, clearHistory, injectPresetData, clearDatabase
    }}>
      {children}
    </AppContext.Provider>
  );
};


export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};
