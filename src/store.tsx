import React, { createContext, useContext, useEffect, useState } from 'react';
import { Bookmark, Folder, Settings, Proposal } from './types';

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
  setBookmarks: React.Dispatch<React.SetStateAction<Bookmark[]>>;
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  updateBookmark: (id: string, updates: Partial<Bookmark>) => void;
  deleteBookmark: (id: string) => void;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  addFolder: (folder: Folder) => void;
  deleteFolder: (id: string) => void;
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

  const updateBookmark = (id: string, updates: Partial<Bookmark>) => {
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const updateFolder = (id: string, updates: Partial<Folder>) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const addFolder = (folder: Folder) => {
    setFolders(prev => [...prev, folder]);
  };

  const deleteFolder = (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    // Orphan bookmarks
    setBookmarks(prev => prev.map(b => b.folderId === id ? { ...b, folderId: null } : b));
  };

  return (
    <AppContext.Provider value={{
      bookmarks, folders, settings,
      setBookmarks, setFolders, setSettings,
      updateBookmark, deleteBookmark, updateFolder, addFolder, deleteFolder
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
