import React, { useState, useMemo, useCallback } from "react";
import {
  Folder,
  FolderPlus,
  FolderMinus,
  Edit3,
  Trash2,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Sparkles,
  Move,
  Check,
  X,
  Plus,
  HelpCircle,
  ExternalLink,
  Globe,
} from "lucide-react";
import { useAppContext } from "../store";
import { Bookmark, Folder as FolderType } from "../types";
import { autoSortBookmarks } from "../services/aiService";

export function OrganizeView() {
  const {
    bookmarks,
    folders,
    aiFolders,
    updateBookmark,
    batchUpdateBookmarks,
    addFolder,
    updateFolder,
    deleteFolder,
    bulkDeleteFolders,
    deleteBookmark,
    settings,
  } = useAppContext();

  // Selected folder for filtering main view (null = root/uncategorized, 'all' = all bookmarks)
  const [selectedFolderFilter, setSelectedFolderFilter] =
    useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<
    "date" | "title" | "folder" | "domain"
  >("date");
  const [filterLock, setFilterLock] = useState<"all" | "locked" | "unlocked">(
    "all",
  );

  // Selection list for bulk actions
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(
    new Set(),
  );

  // Folder CRUD states
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const [addingChildToParentId, setAddingChildToParentId] = useState<
    string | null
  >(null);
  const [newFolderName, setNewFolderName] = useState("");

  // Expanded state for folder tree nodes
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({
    "1": true, // Expand bookmarks bar by default if it exists
  });

  // AI Organize state
  const [isSorting, setIsSorting] = useState(false);
  const [sortStatus, setSortStatus] = useState("");
  const [includeManual, setIncludeManual] = useState(false);

  // Bulk actions dropdown and search
  const [showBulkMoveMenu, setShowBulkMoveMenu] = useState(false);
  const [bulkMoveSearch, setBulkMoveSearch] = useState("");

  // Reorganize confirmation modal state
  const [reorganizeConfirm, setReorganizeConfirm] = useState<{
    mode: "smart" | "force" | "selected";
    targetCount: number;
  } | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Reset pagination on filter change
  React.useEffect(() => {
    if (selectedFolderFilter || search || sortField || filterLock || itemsPerPage) {
      setCurrentPage(1);
    }
  }, [selectedFolderFilter, search, sortField, filterLock, itemsPerPage]);

  // Clear bulk selection when changing folder filter
  React.useEffect(() => {
    if (selectedFolderFilter !== undefined) {
      setSelectedBookmarkIds(new Set());
    }
  }, [selectedFolderFilter]);

  // Toggle expanded folder
  const toggleExpand = (id: string) => {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getFolderBookmarkCount = useCallback((folderId: string): number => {
    const getDescendantFolderIds = (fid: string): string[] => {
      const children = folders.filter((f) => f.parentId === fid);
      return [fid, ...children.flatMap((c) => getDescendantFolderIds(c.id))];
    };
    const allFolderIds = getDescendantFolderIds(folderId);
    return bookmarks.filter(
      (b) => b.folderId !== null && allFolderIds.includes(b.folderId),
    ).length;
  }, [folders, bookmarks]);

  // Find folders that recursively contain 0 bookmarks
  const emptyFolders = useMemo(() => {
    return folders.filter((f) => getFolderBookmarkCount(f.id) === 0);
  }, [folders, getFolderBookmarkCount]);

  // Helper to map blueprint folder IDs to real Chrome folder IDs by matching names
  const getRealFolderId = (aiFolderId: string | null): string | null => {
    if (!aiFolderId) return null;
    const aiFolder = aiFolders.find((f) => f.id === aiFolderId);
    if (!aiFolder) return null;
    const realFolder = folders.find(
      (rf) =>
        rf.id === aiFolder.id ||
        rf.name.toLowerCase() === aiFolder.name.toLowerCase(),
    );
    return realFolder ? realFolder.id : null;
  };

  // Get favicon URL
  const getFaviconUrl = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
    } catch {
      return "";
    }
  };

  // Parse Domain
  const parseDomainName = useCallback((urlStr: string) => {
    try {
      const url = new URL(urlStr);
      return url.hostname.replace("www.", "");
    } catch {
      return "Web Link";
    }
  }, []);

  // Get real folder list tree nodes
  const rootRealFolders = useMemo(() => {
    return folders.filter((f) => !f.parentId);
  }, [folders]);

  const subRealFoldersMap = useMemo(() => {
    const map = new Map<string, FolderType[]>();
    folders.forEach((f) => {
      if (f.parentId) {
        const group = map.get(f.parentId) || [];
        group.push(f);
        map.set(f.parentId, group);
      }
    });
    return map;
  }, [folders]);

  // Filtering bookmarks
  const displayedBookmarks = useMemo(() => {
    let filtered = bookmarks.filter((b) => {
      // 1. Search filter
      const matchesSearch =
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        b.url.toLowerCase().includes(search.toLowerCase()) ||
        b.summary.toLowerCase().includes(search.toLowerCase()) ||
        b.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;

      // 2. Folder filter
      if (selectedFolderFilter !== "all") {
        if (selectedFolderFilter === "uncategorized") {
          if (b.folderId !== null) return false;
        } else {
          if (b.folderId !== selectedFolderFilter) return false;
        }
      }

      // 3. Lock filter
      if (filterLock === "locked" && !b.manuallyAssigned) return false;
      if (filterLock === "unlocked" && b.manuallyAssigned) return false;

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortField === "date") {
        return b.dateAdded - a.dateAdded; // newest first
      } else if (sortField === "title") {
        return a.title.localeCompare(b.title);
      } else if (sortField === "folder") {
        const fA = folders.find((f) => f.id === a.folderId)?.name || "";
        const fB = folders.find((f) => f.id === b.folderId)?.name || "";
        return fA.localeCompare(fB);
      } else {
        return parseDomainName(a.url).localeCompare(parseDomainName(b.url));
      }
    });

    return filtered;
  }, [bookmarks, search, selectedFolderFilter, filterLock, sortField, folders, parseDomainName]);

  // Pagination Calculations
  const totalItems = displayedBookmarks.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const paginatedBookmarks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return displayedBookmarks.slice(startIndex, startIndex + itemsPerPage);
  }, [displayedBookmarks, currentPage, itemsPerPage]);

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedBookmarkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedBookmarkIds.size === displayedBookmarks.length) {
      setSelectedBookmarkIds(new Set());
    } else {
      setSelectedBookmarkIds(new Set(displayedBookmarks.map((b) => b.id)));
    }
  };

  // Bulk Lock/Unlock
  const bulkLock = (lock: boolean) => {
    const updated = bookmarks.map((b) => {
      if (selectedBookmarkIds.has(b.id)) {
        return { ...b, manuallyAssigned: lock };
      }
      return b;
    });
    batchUpdateBookmarks(
      updated,
      lock
        ? "Bulk Locked bookmarks from AI sort"
        : "Bulk Unlocked bookmarks for AI sort",
    );
    setSelectedBookmarkIds(new Set());
  };

  // Bulk Move
  const bulkMoveToFolder = (destFolderId: string | null) => {
    const updated = bookmarks.map((b) => {
      if (selectedBookmarkIds.has(b.id)) {
        return {
          ...b,
          folderId: destFolderId,
          manuallyAssigned: true, // Manual move sets lock to true
        };
      }
      return b;
    });
    batchUpdateBookmarks(
      updated,
      `Bulk moved bookmarks to folder: ${destFolderId || "Root"}`,
    );
    setSelectedBookmarkIds(new Set());
    setShowBulkMoveMenu(false);
  };

  // Real Folder CRUD handlers
  const handleCreateFolder = (parentId: string | null) => {
    if (!newFolderName.trim()) return;
    addFolder({
      id: crypto.randomUUID(),
      parentId,
      name: newFolderName.trim(),
      promptContext: "",
    });
    setNewFolderName("");
    setAddingChildToParentId(null);
  };

  const handleRenameFolder = (id: string) => {
    if (!renamingName.trim()) return;
    updateFolder(id, { name: renamingName.trim() });
    setRenamingFolderId(null);
    setRenamingName("");
  };

  const handleDeleteFolderConfirm = (id: string, name: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete folder "${name}"? Subfolders and bookmarks will be moved up.`,
      )
    ) {
      deleteFolder(id);
      if (selectedFolderFilter === id) {
        setSelectedFolderFilter("all");
      }
    }
  };

  const handlePruneEmptyFolders = () => {
    const count = emptyFolders.length;
    if (count === 0) return;

    if (
      window.confirm(
        `Are you sure you want to delete all ${count} empty folder${
          count === 1 ? "" : "s"
        }?\nThis will remove folders and subfolders containing zero bookmarks.`,
      )
    ) {
      const ids = emptyFolders.map((f) => f.id);
      bulkDeleteFolders(ids, `Pruned ${count} empty folders`);
    }
  };

  // AI Reorganize handler
  const executeAIReorganize = async (mode: "smart" | "force" | "selected") => {
    setIsSorting(true);
    setSortStatus("Analyzing bookmarks...");
    try {
      const targets = bookmarks.filter((b) => {
        if (mode === "selected") {
          return selectedBookmarkIds.has(b.id);
        } else if (mode === "force") {
          return includeManual || !b.manuallyAssigned;
        } else {
          // smart
          return !b.manuallyAssigned && !b.folderId;
        }
      });

      if (targets.length === 0) {
        alert("No bookmarks eligible for sorting.");
        setIsSorting(false);
        setSortStatus("");
        return;
      }

      setSortStatus(`Sorting ${targets.length} bookmarks...`);
      const mapping = await autoSortBookmarks(targets, aiFolders, settings);

      let reorganizedCount = 0;
      let skippedCount = bookmarks.length - targets.length;

      if (mapping && Object.keys(mapping).length > 0) {
        // Collect all unique target AI folder IDs that are NOT null
        const uniqueAiFolderIds = Array.from(
          new Set(Object.values(mapping)),
        ).filter(Boolean) as string[];

        // We will build a mapping cache of aiFolderId -> realFolderId
        const aiToRealFolderMap: Record<string, string | null> = {};

        // Recursive resolver that handles parent creation first
        const resolveOrCreateRealFolder = async (
          aiId: string | null,
        ): Promise<string | null> => {
          if (!aiId) return null;
          if (aiToRealFolderMap[aiId] !== undefined) {
            return aiToRealFolderMap[aiId];
          }

          const aiFolder = aiFolders.find((f) => f.id === aiId);
          if (!aiFolder) {
            aiToRealFolderMap[aiId] = null;
            return null;
          }

          // Check if a real folder already exists with the same ID or name (case-insensitive)
          const existingRealFolder = folders.find(
            (rf) =>
              rf.id === aiFolder.id ||
              rf.name.toLowerCase() === aiFolder.name.toLowerCase(),
          );

          if (existingRealFolder) {
            aiToRealFolderMap[aiId] = existingRealFolder.id;
            return existingRealFolder.id;
          }

          // If not existing, create it recursively
          // First resolve the parent ID in reality
          const realParentId = await resolveOrCreateRealFolder(
            aiFolder.parentId,
          );

          // Create the folder via the store (which now returns a Promise<string> of the new ID)
          setSortStatus(`Creating folder "${aiFolder.name}"...`);
          const newRealFolderId = await addFolder({
            parentId: realParentId,
            name: aiFolder.name,
            promptContext: aiFolder.promptContext || "",
          });

          aiToRealFolderMap[aiId] = newRealFolderId;
          return newRealFolderId;
        };

        // Resolve all unique target folders
        setSortStatus("Creating missing folders...");
        for (const aiId of uniqueAiFolderIds) {
          await resolveOrCreateRealFolder(aiId);
        }

        // Now map the bookmarks with the resolved real folder IDs
        const updated = bookmarks.map((b) => {
          if (mapping[b.id] !== undefined) {
            const targetAiId = mapping[b.id];
            const realId = targetAiId
              ? aiToRealFolderMap[targetAiId] || null
              : null;
            reorganizedCount++;
            return {
              ...b,
              folderId: realId,
              manuallyAssigned: false, // AI sorted are not locked
            };
          }
          return b;
        });

        const logMsg =
          mode === "selected"
            ? "AI Organized Selected bookmarks"
            : mode === "force"
              ? "AI Force Sortingd bookmarks"
              : "AI Smart Sortingd bookmarks";

        batchUpdateBookmarks(updated, logMsg);
        alert(
          `AI Reorganization completed!\n- ${reorganizedCount} bookmarks sorted\n- ${skippedCount} bookmarks skipped`,
        );
        setSelectedBookmarkIds(new Set());
      } else {
        alert("AI sorting returned no mapping.");
      }
    } catch (e: any) {
      console.error(e);
      alert(`AI Reorganization failed: ${e.message || e}`);
    } finally {
      setIsSorting(false);
      setSortStatus("");
      setReorganizeConfirm(null);
    }
  };

  const handleSmartClick = () => {
    const targets = bookmarks.filter((b) => !b.manuallyAssigned && !b.folderId);
    if (targets.length === 0) {
      alert(
        "No bookmarks eligible for Smart Sorting (all bookmarks are already categorized or locked).",
      );
      return;
    }
    setReorganizeConfirm({ mode: "smart", targetCount: targets.length });
  };

  const handleForceClick = () => {
    const targets = bookmarks.filter(
      (b) => includeManual || !b.manuallyAssigned,
    );
    if (targets.length === 0) {
      alert(
        "No bookmarks eligible for Force Sorting (all bookmarks are locked).",
      );
      return;
    }
    setReorganizeConfirm({ mode: "force", targetCount: targets.length });
  };

  const handleSelectedClick = () => {
    if (selectedBookmarkIds.size === 0) {
      alert("Please select some bookmarks first.");
      return;
    }
    setReorganizeConfirm({
      mode: "selected",
      targetCount: selectedBookmarkIds.size,
    });
  };

  // Recursive Chrome folder tree renderer
  const renderFolderTreeNode = (node: FolderType, depth = 0) => {
    const hasChildren =
      subRealFoldersMap.has(node.id) &&
      subRealFoldersMap.get(node.id)!.length > 0;
    const isExpanded = !!expandedFolders[node.id];
    const isSelected = selectedFolderFilter === node.id;
    const isFolderEmpty = getFolderBookmarkCount(node.id) === 0;

    return (
      <div key={node.id} className="select-none">
        <div
          style={{ paddingLeft: `${depth * 14}px` }}
          className={`group flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-all ${
            isSelected
              ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold"
              : isFolderEmpty
                ? "bg-amber-500/5 dark:bg-amber-500/5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-850"
                : "hover:bg-gray-100 dark:hover:bg-gray-850 text-gray-700 dark:text-gray-300"
          }`}
          onClick={() => setSelectedFolderFilter(node.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSelectedFolderFilter(node.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Toggle Expand Arrow */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }
              }}
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-400 hover:text-gray-600 transition-colors border-0 bg-transparent cursor-pointer"
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )
              ) : (
                <span className="w-3.5 h-3.5 block" />
              )}
            </button>

            {/* Folder Icon */}
            <Folder
              size={15}
              className={
                isSelected
                  ? "text-blue-500 shrink-0"
                  : isFolderEmpty
                    ? "text-amber-500/80 dark:text-amber-500/60 shrink-0"
                    : "text-gray-400 shrink-0"
              }
            />

            {/* Rename input / folder title */}
            {renamingFolderId === node.id ? (
              <input
                type="text"
                ref={(el) => el && el.focus()}
                value={renamingName}
                onChange={(e) => setRenamingName(e.target.value)}
                onBlur={() => handleRenameFolder(node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameFolder(node.id);
                  if (e.key === "Escape") setRenamingFolderId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-gray-900 dark:text-white font-normal"
              />
            ) : (
              <span className="truncate text-xs flex items-center gap-1">
                <span className="truncate">{node.name}</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal shrink-0">
                  ({getFolderBookmarkCount(node.id)})
                </span>
                {isFolderEmpty && (
                  <span className="text-[9px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-450 px-1.5 py-0.2 rounded font-medium shrink-0 scale-90 origin-left border border-amber-100 dark:border-amber-900/30">
                    empty
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Action buttons on hover */}
          {renamingFolderId !== node.id && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity pl-2">
              {/* Add child folder */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingChildToParentId(node.id);
                  setNewFolderName("");
                }}
                className="p-0.5 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                title="Create subfolder"
              >
                <FolderPlus size={12} />
              </button>
              {/* Rename */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingFolderId(node.id);
                  setRenamingName(node.name);
                }}
                className="p-0.5 hover:text-amber-600 dark:hover:text-amber-400 rounded transition-colors"
                title="Rename folder"
              >
                <Edit3 size={12} />
              </button>
              {/* Delete */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolderConfirm(node.id, node.name);
                }}
                className="p-0.5 hover:text-red-500 rounded transition-colors"
                title="Delete folder"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Render child tree form */}
        {addingChildToParentId === node.id && (
          <div
            style={{ paddingLeft: `${(depth + 1) * 14 + 14}px` }}
            className="py-1 pr-2"
          >
            <div className="flex items-center gap-1">
              <input
                type="text"
                ref={(el) => el && el.focus()}
                placeholder="New subfolder..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder(node.id);
                  if (e.key === "Escape") setAddingChildToParentId(null);
                }}
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => handleCreateFolder(node.id)}
                className="p-0.5 bg-blue-600 text-white rounded"
              >
                <Check size={11} />
              </button>
              <button
                type="button"
                onClick={() => setAddingChildToParentId(null)}
                className="p-0.5 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded"
              >
                <X size={11} />
              </button>
            </div>
          </div>
        )}

        {/* Sub-nodes recursion */}
        {hasChildren && isExpanded && (
          <div className="mt-0.5">
            {subRealFoldersMap
              .get(node.id)!
              .map((child) => renderFolderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex gap-6 overflow-hidden max-w-7xl mx-auto">
      {/* LEFT SIDEBAR: Live Chrome Folder Tree */}
      <aside className="w-80 flex-shrink-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-850 rounded-2xl p-4 flex flex-col h-[calc(100vh-80px)] shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4 shrink-0">
          <h3 className="font-bold text-sm dark:text-white flex items-center gap-1.5">
            <Folder size={16} className="text-blue-500" />
            Live Chrome Folder Tree
          </h3>
          <button
            type="button"
            onClick={() => {
              setAddingChildToParentId("root");
              setNewFolderName("");
            }}
            className="text-[11px] bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold px-2 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            title="Create root folder"
          >
            <Plus size={11} />
            <span>Root Folder</span>
          </button>
        </div>

        {/* Root Creation Input Form */}
        {addingChildToParentId === "root" && (
          <div className="p-2 border border-blue-200 dark:border-blue-900/40 rounded-xl bg-blue-50/10 mb-3 animate-fade-in shrink-0">
            <div className="flex items-center gap-1">
              <input
                type="text"
                ref={(el) => el && el.focus()}
                placeholder="New root folder..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder(null);
                  if (e.key === "Escape") setAddingChildToParentId(null);
                }}
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => handleCreateFolder(null)}
                className="p-1 bg-blue-600 text-white rounded-lg hover:bg-blue-750 transition-colors"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                onClick={() => setAddingChildToParentId(null)}
                className="p-1 bg-gray-200 dark:bg-gray-750 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Tree Container */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 font-sans">
          {/* All Folder Selector */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setSelectedFolderFilter("all")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedFolderFilter("all");
              }
            }}
            className={`flex items-center gap-2 py-1.5 px-3 rounded-lg cursor-pointer text-xs transition-colors ${
              selectedFolderFilter === "all"
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold"
                : "hover:bg-gray-100 dark:hover:bg-gray-850 text-gray-700 dark:text-gray-300"
            }`}
          >
            <SlidersHorizontal size={14} className="shrink-0 text-gray-400" />
            <span>📁 All Folders ({bookmarks.length})</span>
          </div>

          {/* Uncategorized Folder Selector */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setSelectedFolderFilter("uncategorized")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedFolderFilter("uncategorized");
              }
            }}
            className={`flex items-center gap-2 py-1.5 px-3 rounded-lg cursor-pointer text-xs transition-colors ${
              selectedFolderFilter === "uncategorized"
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold"
                : "hover:bg-gray-100 dark:hover:bg-gray-850 text-gray-700 dark:text-gray-300"
            }`}
          >
            <HelpCircle size={14} className="shrink-0 text-gray-400" />
            <span>
              📂 Uncategorized (
              {bookmarks.filter((b) => b.folderId === null).length})
            </span>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800 my-2" />

          {/* Render real Chrome folders */}
          {rootRealFolders.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic text-center py-8">
              No Chrome folders detected.
            </p>
          ) : (
            rootRealFolders.map((root) => renderFolderTreeNode(root))
          )}
        </div>

        {/* Prune Empty Folders Card */}
        {emptyFolders.length > 0 && (
          <div className="mt-4 p-3 bg-amber-550/5 dark:bg-amber-950/10 border border-amber-250 dark:border-amber-900/30 rounded-xl flex flex-col gap-2 shrink-0 animate-fade-in">
            <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
              <span className="font-semibold flex items-center gap-1.5">
                <FolderMinus size={14} className="text-amber-500" />
                {emptyFolders.length} empty {emptyFolders.length === 1 ? "folder" : "folders"}
              </span>
            </div>
            <button
              type="button"
              onClick={handlePruneEmptyFolders}
              className="w-full text-center text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold py-1.5 px-3 rounded-lg transition-all shadow-sm cursor-pointer active:scale-98"
            >
              Prune Empty Folders
            </button>
          </div>
        )}
      </aside>

      {/* MAIN WORKSPACE: Bookmarks Dense List Rows */}
      <main className="flex-1 flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-850 rounded-2xl p-5 h-[calc(100vh-80px)] overflow-hidden shadow-sm">
        {/* HEADER CONTROLS */}
        <div className="flex flex-col gap-4 border-b border-gray-100 dark:border-gray-800 pb-4 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                Reorganize Workspace
                {selectedFolderFilter !== "all" && (
                  <span className="text-xs font-normal text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">
                    Filter:{" "}
                    {selectedFolderFilter === "uncategorized"
                      ? "Uncategorized"
                      : folders.find((f) => f.id === selectedFolderFilter)
                          ?.name || "Selected Folder"}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Review folder mappings, manually lock entries, and apply AI
                smart sorting.
              </p>
            </div>

            {/* AI Sorting Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 select-none mr-1.5">
                <input
                  type="checkbox"
                  checked={includeManual}
                  onChange={(e) => setIncludeManual(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Include manually locked</span>
              </label>

              <button
                type="button"
                onClick={handleSmartClick}
                disabled={isSorting}
                className="bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                title="AI organizes unsorted/unlocked bookmarks only"
              >
                <Sparkles size={13} />
                Smart Sorting
              </button>

              <button
                type="button"
                onClick={handleForceClick}
                disabled={isSorting}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1"
                title="AI organizes all bookmarks, respecting locked toggle"
              >
                <Sparkles size={13} />
                Force Sorting
              </button>
            </div>
          </div>

          {/* AI Sorting Status Bar */}
          {isSorting && (
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-xl p-3 text-xs text-purple-700 dark:text-purple-400 animate-pulse flex items-center gap-2">
              <Sparkles size={14} className="animate-spin text-purple-500" />
              <span>{sortStatus}</span>
            </div>
          )}

          {/* SEARCH, SORT, AND BULK SELECTION CONTROLS */}
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={15}
              />
              <input
                type="text"
                placeholder="Search visible bookmarks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Lock State Filter */}
            <select
              value={filterLock}
              onChange={(e) => setFilterLock(e.target.value as any)}
              className="w-full sm:w-36 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5 dark:text-white text-xs outline-none"
            >
              <option value="all">🔒 All Lock States</option>
              <option value="locked">🔒 Locked Only</option>
              <option value="unlocked">🔓 Unlocked Only</option>
            </select>

            {/* Sort order Dropdown */}
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="w-full sm:w-36 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5 dark:text-white text-xs outline-none"
            >
              <option value="date">📅 Sort: Date Added</option>
              <option value="title">🔤 Sort: Title</option>
              <option value="folder">📁 Sort: Folder</option>
              <option value="domain">🌐 Sort: Domain</option>
            </select>
          </div>
        </div>

        {/* BULK OPERATIONS BAR (only shows if items are selected) */}
        {selectedBookmarkIds.size > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl p-3 shrink-0 my-3 flex items-center justify-between gap-4 flex-wrap text-xs animate-fade-in">
            <span className="font-semibold text-blue-700 dark:text-blue-400">
              Selected {selectedBookmarkIds.size} of {displayedBookmarks.length}{" "}
              items
            </span>
            <div className="flex items-center gap-2 flex-wrap relative">
              <button
                type="button"
                onClick={() => bulkLock(true)}
                className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-750 dark:text-white px-2.5 py-1.5 border border-gray-250 dark:border-gray-750 rounded-lg flex items-center gap-1 font-medium cursor-pointer"
              >
                <Lock size={12} />
                Lock Selected
              </button>
              <button
                type="button"
                onClick={() => bulkLock(false)}
                className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-750 dark:text-white px-2.5 py-1.5 border border-gray-250 dark:border-gray-750 rounded-lg flex items-center gap-1 font-medium cursor-pointer"
              >
                <Unlock size={12} />
                Unlock Selected
              </button>

              <button
                type="button"
                onClick={handleSelectedClick}
                className="bg-purple-100 hover:bg-purple-200 text-purple-750 dark:bg-purple-900/30 dark:text-purple-300 px-2.5 py-1.5 border border-purple-200/50 dark:border-purple-800/40 rounded-lg flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Sparkles
                  size={12}
                  className="text-purple-650 dark:text-purple-400"
                />
                AI Organize Selected
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkMoveMenu(!showBulkMoveMenu);
                    setBulkMoveSearch("");
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Move size={12} />
                  Move Selected to...
                </button>
                {showBulkMoveMenu && (
                  <>
                    <div
                      role="button"
                      tabIndex={-1}
                      aria-hidden="true"
                      className="fixed inset-0 z-40 bg-transparent"
                      onClick={() => setShowBulkMoveMenu(false)}
                      onKeyDown={() => setShowBulkMoveMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl p-3 z-50 max-h-96 overflow-hidden flex flex-col font-sans animate-scale-up">
                      <div className="relative shrink-0 mb-2">
                        <Search
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                          size={14}
                        />
                        <input
                          type="text"
                          placeholder="Search folders..."
                          value={bulkMoveSearch}
                          onChange={(e) => setBulkMoveSearch(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-2 bg-gray-50 dark:bg-gray-850 border border-gray-300 dark:border-gray-700 rounded-lg text-xs dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin">
                        <button
                          type="button"
                          onClick={() => {
                            bulkMoveToFolder(null);
                            setShowBulkMoveMenu(false);
                          }}
                          className="w-full text-left px-2.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-750 dark:text-gray-300 text-xs flex items-center justify-between gap-1.5 rounded-lg transition-colors group/item cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Globe
                              size={14}
                              className="text-gray-400 group-hover/item:text-blue-500 shrink-0"
                            />
                            <span className="truncate font-medium">
                              Root / Uncategorized
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 group-hover/item:text-gray-600 font-mono shrink-0">
                            (
                            {
                              bookmarks.filter((b) => b.folderId === null)
                                .length
                            }
                            )
                          </span>
                        </button>
                        {folders
                          .filter((f) =>
                            f.name
                              .toLowerCase()
                              .includes(bulkMoveSearch.toLowerCase()),
                          )
                          .map((f) => (
                            <button
                              type="button"
                              key={f.id}
                              onClick={() => {
                                bulkMoveToFolder(f.id);
                                setShowBulkMoveMenu(false);
                              }}
                              className="w-full text-left px-2.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-850 text-gray-700 dark:text-gray-300 text-xs flex items-center justify-between gap-1.5 rounded-lg transition-colors group/item cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Folder
                                  size={14}
                                  className="text-gray-400 group-hover/item:text-blue-500 shrink-0"
                                />
                                <span className="truncate font-medium">
                                  {f.name}
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-400 group-hover/item:text-gray-600 font-mono shrink-0">
                                ({getFolderBookmarkCount(f.id)})
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE ROWS GRID CONTAINER */}
        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          <table className="w-full table-fixed border-collapse text-left text-xs font-sans">
            <thead className="bg-gray-50 dark:bg-gray-850 text-gray-500 uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="p-3 w-[45px] text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="p-1 text-gray-400 hover:text-gray-650"
                  >
                    {selectedBookmarkIds.size === displayedBookmarks.length &&
                    displayedBookmarks.length > 0 ? (
                      <CheckSquare size={15} className="text-blue-500" />
                    ) : (
                      <Square size={15} />
                    )}
                  </button>
                </th>
                <th className="p-3 w-[60px] text-center">Favicon</th>
                <th className="p-3">Title & Website Reference</th>
                <th className="p-3 w-[220px]">Folder Assignment</th>
                <th className="p-3 w-[110px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isInitialLoading ? (
                ["sk-1", "sk-2", "sk-3", "sk-4", "sk-5", "sk-6", "sk-7", "sk-8"].map((key) => (
                  <tr
                    key={key}
                    className="animate-pulse border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="p-3 text-center">
                      <div className="w-4 h-4 bg-gray-250 dark:bg-gray-750 rounded mx-auto" />
                    </td>
                    <td className="p-3">
                      <div className="w-6 h-6 bg-gray-250 dark:bg-gray-750 rounded-lg mx-auto" />
                    </td>
                    <td className="p-3">
                      <div className="space-y-2">
                        <div className="h-3.5 bg-gray-250 dark:bg-gray-750 rounded-md w-3/4" />
                        <div className="h-2.5 bg-gray-200 dark:bg-gray-800 rounded-md w-1/2" />
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="h-7 bg-gray-250 dark:bg-gray-750 rounded-lg w-full" />
                    </td>
                    <td className="p-3 text-center">
                      <div className="w-6 h-6 bg-gray-250 dark:bg-gray-750 rounded-md mx-auto" />
                    </td>
                  </tr>
                ))
              ) : displayedBookmarks.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-gray-405 italic"
                  >
                    No bookmarks found match selection criteria.
                  </td>
                </tr>
              ) : (
                paginatedBookmarks.map((bm) => {
                  const isChecked = selectedBookmarkIds.has(bm.id);
                  return (
                    <tr
                      key={bm.id}
                      className={`hover:bg-gray-50/70 dark:hover:bg-gray-850/40 transition-colors group ${
                        isChecked ? "bg-blue-50/20 dark:bg-blue-900/10" : ""
                      }`}
                    >
                      {/* Bulk selection checkbox */}
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleSelect(bm.id)}
                          className="p-1 text-gray-400 hover:text-gray-650 shrink-0 cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare size={14} className="text-blue-500" />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>
                      </td>

                      {/* Favicon */}
                      <td className="p-3">
                        <div className="w-6 h-6 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-850 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                          {getFaviconUrl(bm.url) ? (
                            <img
                              src={getFaviconUrl(bm.url)}
                              alt=""
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                              className="w-4 h-4 object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Globe size={12} className="text-gray-400" />
                          )}
                        </div>
                      </td>

                      {/* Bookmark Title */}
                      <td className="p-3">
                        <div className="flex flex-col min-w-0 pr-4 whitespace-normal break-words">
                          <a
                            href={bm.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5 flex-wrap whitespace-normal break-words"
                          >
                            <span>{bm.title}</span>
                            <ExternalLink
                              size={11}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 shrink-0"
                            />
                          </a>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-mono break-all select-all whitespace-normal">
                            {bm.url}
                          </span>
                        </div>
                      </td>

                      {/* Folder selection dropdown */}
                      <td className="p-3">
                        <select
                          value={bm.folderId || "none"}
                          onChange={(e) => {
                            const val = e.target.value;
                            const folderId = val === "none" ? null : val;
                            updateBookmark(bm.id, {
                              folderId,
                              manuallyAssigned: true, // Manual changes trigger lock
                            });
                          }}
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs dark:text-white outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                        >
                          <option value="none">🌐 Root / Uncategorized</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              📁 {f.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Actions (Lock & Delete) */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateBookmark(bm.id, {
                                manuallyAssigned: !bm.manuallyAssigned,
                              })
                            }
                            className={`p-1.5 rounded-lg border cursor-pointer inline-flex items-center justify-center transition-all ${
                              bm.manuallyAssigned
                                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400"
                                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600"
                            }`}
                            title={
                              bm.manuallyAssigned
                                ? "Locked (AI auto-sort will skip this bookmark)"
                                : "Unlocked (AI auto-sort will organize this bookmark)"
                            }
                          >
                            {bm.manuallyAssigned ? (
                              <Lock size={12} />
                            ) : (
                              <Unlock size={12} />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to delete bookmark "${bm.title}"?`,
                                )
                              ) {
                                deleteBookmark(bm.id);
                              }
                            }}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-red-650 hover:border-red-200 dark:hover:border-red-950 hover:bg-red-50/50 dark:hover:bg-red-950/30 transition-all cursor-pointer inline-flex items-center justify-center"
                            title="Delete bookmark"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4 mt-4 shrink-0 text-xs text-gray-500 dark:text-gray-400 gap-4">
            <div>
              Showing{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {Math.min(totalItems, currentPage * itemsPerPage)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {totalItems}
              </span>{" "}
              bookmarks
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium cursor-pointer"
              >
                Previous
              </button>

              {/* Render Page Numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage;
                if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                if (pageNum < 1 || pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center font-medium transition-colors cursor-pointer ${
                      currentPage === pageNum
                        ? "bg-blue-600 text-white border-blue-600 font-semibold"
                        : "border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium cursor-pointer"
              >
                Next
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span>Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-lg px-2.5 py-1.5 outline-none text-xs dark:text-white"
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
                <option value={200}>200 per page</option>
              </select>
            </div>
          </div>
        )}
      </main>

      {/* REORGANIZE CONFIRMATION MODAL */}
      {reorganizeConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
              <Sparkles className="text-purple-500 animate-pulse" size={22} />
              Confirm AI Reorganization
            </h3>

            <div className="text-sm text-gray-650 dark:text-gray-300 leading-relaxed">
              {reorganizeConfirm.mode === "selected" && (
                <p>
                  You are about to organize{" "}
                  <strong>{reorganizeConfirm.targetCount}</strong> selected
                  bookmarks. This will process only the checked items and place
                  them into folders using AI.
                </p>
              )}
              {reorganizeConfirm.mode === "force" && (
                <p>
                  You are about to run a **Force Sorting** on{" "}
                  <strong>{reorganizeConfirm.targetCount}</strong> bookmarks.
                  This will analyze and redistribute bookmarks even if they are
                  already in folders. Locked bookmarks will be{" "}
                  {includeManual
                    ? "included (reorganized)"
                    : "skipped (safeguarded)"}
                  .
                </p>
              )}
              {reorganizeConfirm.mode === "smart" && (
                <p>
                  You are about to run a **Smart Sorting** on{" "}
                  <strong>{reorganizeConfirm.targetCount}</strong> bookmarks.
                  This will analyze and organize only bookmarks that are
                  currently uncategorized and unlocked.
                </p>
              )}
            </div>

            {isSorting ? (
              <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-xl p-3.5 text-xs text-purple-700 dark:text-purple-300 animate-pulse flex items-center gap-2">
                <Sparkles
                  size={14}
                  className="animate-spin text-purple-500 shrink-0"
                />
                <span className="font-medium">
                  {sortStatus || "AI is organizing your bookmarks..."}
                </span>
              </div>
            ) : (
              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/30 text-xs text-blue-800 dark:text-blue-300">
                Note: This action uses your configured AI endpoint to evaluate
                bookmark semantic structure and automatically map them to
                blueprint categories.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReorganizeConfirm(null)}
                disabled={isSorting}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-750 dark:text-gray-400 dark:hover:text-gray-200 font-medium cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeAIReorganize(reorganizeConfirm.mode)}
                disabled={isSorting}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 disabled:opacity-75 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSorting ? (
                  <Sparkles
                    size={14}
                    className="animate-spin text-purple-200"
                  />
                ) : (
                  <Sparkles size={14} />
                )}
                {isSorting ? "AI Sorting..." : "Start AI Sorting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
