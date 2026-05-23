import React from "react";
import { Trash2, Clock, History, RotateCcw, Database } from "lucide-react";
import { useAppContext } from "../store";

export function HistoryView() {
  const { history, revertToState, clearHistory } = useAppContext();

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "Just now";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRevert = (id: string, description: string) => {
    if (
      confirm(
        `Are you sure you want to revert your database to the state: "${description}"?`,
      )
    ) {
      revertToState(id);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pt-2 h-full flex flex-col space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6 text-gray-800 dark:text-gray-200">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <History size={30} className="animate-spin-hover" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Database Change Logs
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Rollback and review the last 10 changes to your bookmark vault.
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  "Are you sure you want to clear your change log history?",
                )
              ) {
                clearHistory();
              }
            }}
            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/50 font-semibold text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trash2 size={15} />
            Clear Logs
          </button>
        )}
      </div>

      {/* TIMELINE LIST */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-12">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
            <Database
              className="text-gray-300 dark:text-gray-700 mb-3"
              size={48}
            />
            <h4 className="font-bold text-gray-800 dark:text-gray-100 text-base">
              No change logs recorded
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs text-center leading-relaxed">
              Modifications to your bookmarks or folders will appear here as
              snapshots. You can revert back anytime.
            </p>
          </div>
        ) : (
          <div className="relative border-l-2 border-gray-200 dark:border-gray-800 ml-4 pl-6 space-y-6">
            {history.map((entry, index) => {
              const isCurrent = index === 0;
              return (
                <div key={entry.id} className="relative group">
                  {/* Timeline point */}
                  <span
                    className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-white dark:bg-gray-900 ${
                      isCurrent
                        ? "border-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/40"
                        : "border-gray-300 dark:border-gray-700 group-hover:border-blue-500"
                    }`}
                  />

                  {/* Card Container */}
                  <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 group-hover:border-blue-300 dark:group-hover:border-blue-900/40 hover:shadow-md transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isCurrent && (
                          <span className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider border border-blue-100 dark:border-blue-900/30">
                            Current State
                          </span>
                        )}
                        <span className="text-gray-950 dark:text-white font-semibold text-sm sm:text-base leading-relaxed">
                          {entry.description}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatTime(entry.timestamp)}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[10px] bg-gray-50 dark:bg-gray-850 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-800">
                          {entry.bookmarks.length} links
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[10px] bg-gray-50 dark:bg-gray-850 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-800">
                          {entry.folders.length} folders
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRevert(entry.id, entry.description)}
                      className={`flex items-center gap-1.5 px-4 py-2 border text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                        isCurrent
                          ? "border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed"
                          : "border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 shadow-sm active:scale-95"
                      }`}
                      disabled={isCurrent}
                      title={
                        isCurrent
                          ? "This is your current state"
                          : "Restore database to this snapshot"
                      }
                    >
                      <RotateCcw
                        size={13}
                        className={
                          isCurrent
                            ? ""
                            : "group-hover:rotate-45 transition-transform"
                        }
                      />
                      Revert State
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
