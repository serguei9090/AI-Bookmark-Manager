import React from "react";
import {
  BookmarkIcon,
  FolderTree,
  Settings,
  Copy,
  Bot,
  History,
  ListFilter,
  Sparkles,
} from "lucide-react";
import { useAppContext } from "../store";

type SidebarProps = {
  activeTab: string;
  setActiveTab: (t: string) => void;
};

const tabs = [
  { id: "bookmarks", label: "Bookmarks", icon: BookmarkIcon },
  { id: "organize", label: "Organize", icon: ListFilter },
  { id: "categories", label: "AI Categories", icon: Sparkles },
  { id: "duplicates", label: "Duplicates", icon: Copy },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { settings } = useAppContext();

  return (
    <aside className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col pt-6 h-screen">
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg text-white">
          <Bot size={24} />
        </div>
        <h1 className="font-bold text-lg dark:text-white">AI Bookmarks</h1>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
