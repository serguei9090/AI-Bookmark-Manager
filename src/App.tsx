import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { BookmarksView } from "./components/BookmarksView";
import { OrganizeView } from "./components/OrganizeView";
import { CategoriesView } from "./components/CategoriesView";
import { DuplicatesView } from "./components/DuplicatesView";
import { SettingsView } from "./components/SettingsView";
import { HistoryView } from "./components/HistoryView";
import { SimplePopupView } from "./components/SimplePopupView";
import { AppProvider } from "./store";

// Detect if running inside a real Chrome extension popup
const isActualExtensionPopup =
  typeof window !== "undefined" &&
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  chrome.runtime.id &&
  (new URLSearchParams(window.location.search).get("popup") === "true" ||
    window.innerWidth < 500);

function AppLayout() {
  const [activeTab, setActiveTab] = useState("bookmarks");

  useEffect(() => {
    if (isActualExtensionPopup) {
      document.documentElement.style.width = "430px";
      document.documentElement.style.height = "600px";
      document.body.style.width = "430px";
      document.body.style.height = "600px";
      document.body.style.overflow = "hidden";
    }
  }, []);

  if (isActualExtensionPopup) {
    return (
      <div className="w-[430px] h-[600px] bg-white dark:bg-gray-900 flex flex-col overflow-hidden p-4">
        <SimplePopupView />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex flex-col transition-all duration-300">
      {/* CORE WORKSPACE PANEL */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
          {activeTab === "bookmarks" && <BookmarksView />}
          {activeTab === "organize" && <OrganizeView />}
          {activeTab === "categories" && <CategoriesView />}
          {activeTab === "duplicates" && <DuplicatesView />}
          {activeTab === "history" && <HistoryView />}
          {activeTab === "settings" && <SettingsView />}
        </main>
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
