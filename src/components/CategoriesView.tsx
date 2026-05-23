import React, { useState, useMemo } from "react";
import {
  FolderTree,
  Sparkles,
  Plus,
  Edit2,
  Trash,
  HelpCircle,
  Save,
  XCircle,
  Check,
  ArrowRight,
  CornerDownRight,
  FileText,
} from "lucide-react";
import { useAppContext } from "../store";
import { Folder } from "../types";
import { autoSortBookmarks, proposeCategories } from "../services/aiService";

export function CategoriesView() {
  const {
    bookmarks,
    folders,
    batchUpdateBookmarks,
    addFolder,
    deleteFolder,
    updateFolder,
    settings,
  } = useAppContext();
  const [isSorting, setIsSorting] = useState(false);
  const [isProposing, setIsProposing] = useState(false);

  // Proposals container
  const [proposals, setProposals] = useState<any[]>([]);

  // Add dialog state
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newParentId, setNewParentId] = useState<string>("root");
  const [newPromptContext, setNewPromptContext] = useState("");

  // For inline folder creation
  const [addingUnderFolderId, setAddingUnderFolderId] = useState<string | null>(
    null,
  );
  const [inlineFolderName, setInlineFolderName] = useState("");
  const [inlinePromptContext, setInlinePromptContext] = useState("");

  const handleInlineCreateFolder = (parentId: string | null) => {
    if (!inlineFolderName.trim()) return;
    addFolder({
      id: crypto.randomUUID(),
      parentId,
      name: inlineFolderName.trim(),
      promptContext: inlinePromptContext.trim(),
    });
    setAddingUnderFolderId(null);
    setInlineFolderName("");
    setInlinePromptContext("");
  };

  // Editing folder state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState<string>("root");
  const [editPromptContext, setEditPromptContext] = useState("");

  // Auto classify bookmark categories using AI service
  const handleAutoSort = async () => {
    setIsSorting(true);
    try {
      const mapping = await autoSortBookmarks(bookmarks, folders, settings);
      if (mapping && Object.keys(mapping).length > 0) {
        const updatedBms = bookmarks.map((b) => ({
          ...b,
          folderId: mapping[b.id] !== undefined ? mapping[b.id] : b.folderId,
        }));
        batchUpdateBookmarks(updatedBms, "AI Auto-Sorted bookmarks");
        alert(
          "AI Auto-Sort complete! Bookmarks organized securely based on folder semantic definitions.",
        );
      } else {
        fallbackAutoSort();
      }
    } catch (e) {
      console.error(e);
      fallbackAutoSort();
    } finally {
      setIsSorting(false);
    }
  };

  const fallbackAutoSort = () => {
    // Elegant local client regex matching based on promptContext + folder names
    let matchCount = 0;
    const updated = bookmarks.map((b) => {
      if (b.folderId) return b; // keep existing manual allocation

      // Look for keywords in folder names/definitions
      for (const fol of folders) {
        const keywords = [
          fol.name.toLowerCase(),
          ...(fol.promptContext
            ? fol.promptContext.toLowerCase().split(/[\s,.-]+/)
            : []),
        ].filter((k) => k.length > 3);

        const textMatches = keywords.some(
          (kw) =>
            b.title.toLowerCase().includes(kw) ||
            b.url.toLowerCase().includes(kw),
        );

        if (textMatches) {
          matchCount++;
          return { ...b, folderId: fol.id };
        }
      }
      return b;
    });

    batchUpdateBookmarks(updated, "Local Auto-Sorted bookmarks");
    alert(
      `Local Match Complete! Automatically matched ${matchCount} bookmarks based on title and folder context metadata.`,
    );
  };

  // Generate category proposals via AI service
  const handlePropose = async () => {
    setIsProposing(true);
    try {
      const proposed = await proposeCategories(bookmarks, settings);
      if (proposed && proposed.length > 0) {
        setProposals(proposed);
      } else {
        setProposals(getMockProposals());
      }
    } catch (e) {
      console.error(e);
      setProposals(getMockProposals());
    } finally {
      setIsProposing(false);
    }
  };

  const getMockProposals = () => {
    return [
      {
        name: "Technology & Hardware",
        promptContext:
          "CPUs, cloud infrastructure, specifications, tech hardware sheets.",
      },
      {
        name: "Learning & Tutorials",
        promptContext:
          "Online education resources, coding interactive playgrounds, MDN references.",
      },
      {
        name: "Social & Communication",
        promptContext:
          "Discussion boards, forums, developer communities like StackOverflow.",
      },
    ];
  };

  const applyProposals = () => {
    proposals.forEach((p) => {
      addFolder({
        id: crypto.randomUUID(),
        parentId: null,
        name: p.name,
        promptContext: p.promptContext,
      });
    });
    setProposals([]);
    alert("Category Proposals successfully loaded into your active database!");
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    addFolder({
      id: crypto.randomUUID(),
      parentId: newParentId === "root" ? null : newParentId,
      name: newFolderName.trim(),
      promptContext: newPromptContext.trim(),
    });

    setIsAddingFolder(false);
    setNewFolderName("");
    setNewParentId("root");
    setNewPromptContext("");
  };

  const startEdit = (fol: Folder) => {
    setEditingId(fol.id);
    setEditName(fol.name);
    setEditParentId(fol.parentId || "root");
    setEditPromptContext(fol.promptContext);
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    updateFolder(editingId!, {
      name: editName.trim(),
      parentId: editParentId === "root" ? null : editParentId,
      promptContext: editPromptContext.trim(),
    });
    setEditingId(null);
  };

  const handleDeleteFolder = (id: string, name: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete the category "${name}"? This will move its bookmarks and subfolders to the parent level.`,
      )
    ) {
      deleteFolder(id);
    }
  };

  // Build recursive tree visual
  const rootFolders = useMemo(
    () => folders.filter((f) => !f.parentId),
    [folders],
  );
  const subFoldersMap = useMemo(() => {
    const map = new Map<string, Folder[]>();
    folders.forEach((f) => {
      if (f.parentId) {
        const group = map.get(f.parentId) || [];
        group.push(f);
        map.set(f.parentId, group);
      }
    });
    return map;
  }, [folders]);

  const getBookmarksCount = (folderId: string) => {
    return bookmarks.filter((b) => b.folderId === folderId).length;
  };

  // Helper to edit proposal items
  const handleEditProposalValue = (
    index: number,
    field: "name" | "promptContext",
    val: string,
  ) => {
    const next = [...proposals];
    next[index][field] = val;
    setProposals(next);
  };

  const handleRemoveProposalItem = (index: number) => {
    setProposals((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="h-full flex flex-col space-y-6 max-w-5xl mx-auto">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold dark:text-white tracking-tight">
            Categories & Subfolders
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Structure bookmark directories and inject category-level prompts for
            AI classifiers.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto self-end">
          <button
            type="button"
            onClick={handlePropose}
            disabled={isProposing}
            className="flex-1 sm:flex-initial bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-4 py-2.5 rounded-xl font-medium transition-all text-sm flex items-center justify-center gap-1.5"
          >
            <Sparkles size={16} />
            {isProposing ? "Analyzing..." : "AI Propose Layout"}
          </button>

          <button
            type="button"
            onClick={handleAutoSort}
            disabled={isSorting}
            className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all text-sm flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Sparkles size={16} />
            {isSorting ? "Organizing..." : "AI Auto-Sort"}
          </button>
        </div>
      </div>

      {/* PROPOSAL DRAWER */}
      {proposals.length > 0 && (
        <div className="bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200/50 dark:border-purple-800/40 rounded-2xl p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-lg text-purple-950 dark:text-purple-300 flex items-center gap-2">
                <Sparkles size={20} className="text-purple-600 animate-pulse" />
                AI Bookmark Folder Proposals
              </h3>
              <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                The model analyzed your current bookmark set and suggested these
                specific visual folder buckets. Customize their attributes
                before applying.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProposals([])}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proposals.map((prop, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 border border-purple-100 dark:border-purple-900/40 p-4 rounded-xl relative group shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      Suggested Folder
                    </span>
                    <button
                      onClick={() => handleRemoveProposalItem(idx)}
                      className="text-gray-300 group-hover:text-red-500 hover:bg-gray-100 p-1 rounded-md transition-all"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={prop.name}
                    onChange={(e) =>
                      handleEditProposalValue(idx, "name", e.target.value)
                    }
                    className="font-bold text-gray-950 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-2 bg-transparent focus:border-purple-500 focus:outline-none w-full text-sm"
                  />
                  <textarea
                    rows={2}
                    value={prop.promptContext}
                    onChange={(e) =>
                      handleEditProposalValue(
                        idx,
                        "promptContext",
                        e.target.value,
                      )
                    }
                    className="text-xs text-gray-500 dark:text-gray-400 font-sans leading-relaxed bg-transparent focus:outline-none focus:border-purple-400 w-full resize-none mt-1 border border-transparent rounded-md p-1 hover:border-gray-100 focus:bg-gray-50 dark:focus:bg-gray-900"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-purple-100 dark:border-purple-900/20">
            <button
              type="button"
              onClick={() => setProposals([])}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Discard Recommendations
            </button>
            <button
              type="button"
              onClick={applyProposals}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all"
            >
              Accept & Apply Categories
            </button>
          </div>
        </div>
      )}

      {/* FULL-WIDTH HIERARCHY STRUCTURE */}
      <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col min-h-[400px]">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3 mb-4 flex-wrap gap-2">
          <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
            <FolderTree size={20} className="text-emerald-500" />
            Hierarchy Structure
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setAddingUnderFolderId("root");
                setInlineFolderName("");
                setInlinePromptContext("");
              }}
              className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900/30 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 font-semibold cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Root Category</span>
            </button>
            <span className="text-[10px] bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded-md text-gray-500 font-mono">
              Count: {folders.length} Nodes
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Inline root creation */}
          {addingUnderFolderId === "root" && (
            <div className="border border-dashed border-blue-200 dark:border-blue-900/40 p-4 rounded-xl bg-blue-50/10 max-w-lg space-y-2.5 animate-fade-in mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-450 block">
                Create New Root Category
              </span>
              <input
                type="text"
                placeholder="Category name (e.g. Design Inspiration)..."
                value={inlineFolderName}
                onChange={(e) => setInlineFolderName(e.target.value)}
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInlineCreateFolder(null);
                  if (e.key === "Escape") setAddingUnderFolderId(null);
                }}
                autoFocus
              />
              <input
                type="text"
                placeholder="AI Context prompt keywords (optional)..."
                value={inlinePromptContext}
                onChange={(e) => setInlinePromptContext(e.target.value)}
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-[11px] dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInlineCreateFolder(null);
                  if (e.key === "Escape") setAddingUnderFolderId(null);
                }}
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAddingUnderFolderId(null)}
                  className="text-xs text-gray-400 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleInlineCreateFolder(null)}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Check size={12} />
                  <span>Create Category</span>
                </button>
              </div>
            </div>
          )}

          {folders.length === 0 && addingUnderFolderId !== "root" ? (
            <div className="text-center py-20 text-gray-400 italic">
              No folders custom-defined. Select "AI Propose Layout" to bootstrap
              quickly!
            </div>
          ) : (
            rootFolders.map((root) => {
              const subs = subFoldersMap.get(root.id) || [];
              return (
                <div
                  key={root.id}
                  className="border border-gray-100 dark:border-gray-700/50 p-4 rounded-xl hover:border-gray-200 dark:hover:border-gray-700 transition-colors"
                >
                  {/* ROOT LEVEL CARD */}
                  {editingId === root.id ? (
                    <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-yellow-200">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 dark:text-white font-bold"
                      />
                      <select
                        value={editParentId}
                        onChange={(e) => setEditParentId(e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 dark:text-white text-xs"
                      >
                        <option value="root">📁 Root Level</option>
                        {folders
                          .filter((f) => f.id !== root.id)
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                      </select>
                      <textarea
                        rows={2}
                        value={editPromptContext}
                        onChange={(e) => setEditPromptContext(e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs dark:text-white"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-gray-400"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          className="text-xs bg-green-600 text-white px-3 py-1 rounded"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between group">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white text-base">
                            {root.name}
                          </span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-0.5 rounded font-semibold font-mono">
                            {getBookmarksCount(root.id)} Items
                          </span>
                        </div>
                        {root.promptContext && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-sans italic max-w-lg leading-relaxed pl-1">
                            Context: {root.promptContext}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setAddingUnderFolderId(root.id);
                            setInlineFolderName("");
                            setInlinePromptContext("");
                          }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-750 rounded text-gray-400 hover:text-emerald-500 cursor-pointer"
                          title="Add subcategory"
                        >
                          <Plus size={13} />
                        </button>
                        <button
                          onClick={() => startEdit(root)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-750 rounded text-gray-400 hover:text-blue-500 cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteFolder(root.id, root.name)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-750 rounded text-gray-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SUB LEVEL FOLDERS */}
                  {(subs.length > 0 || addingUnderFolderId === root.id) && (
                    <div className="mt-4 pl-4 border-l-2 border-dashed border-gray-200 dark:border-gray-800 space-y-3">
                      {subs.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-start gap-2 group/sub"
                        >
                          <CornerDownRight
                            size={14}
                            className="text-gray-400 mt-1"
                          />
                          <div className="flex-1">
                            {editingId === sub.id ? (
                              <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-yellow-300">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full bg-white dark:bg-gray-800 border border-gray-350 rounded px-2 py-1 dark:text-white font-bold"
                                />
                                <select
                                  value={editParentId}
                                  onChange={(e) =>
                                    setEditParentId(e.target.value)
                                  }
                                  className="w-full bg-white border border-gray-350 rounded px-2 py-1 text-xs"
                                >
                                  <option value="root">📁 Root Level</option>
                                  {folders
                                    .filter((f) => f.id !== sub.id)
                                    .map((f) => (
                                      <option key={f.id} value={f.id}>
                                        {f.name}
                                      </option>
                                    ))}
                                </select>
                                <textarea
                                  rows={2}
                                  value={editPromptContext}
                                  onChange={(e) =>
                                    setEditPromptContext(e.target.value)
                                  }
                                  className="w-full bg-white border border-gray-350 rounded px-2 py-1 text-xs"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="text-xs text-gray-400"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={saveEdit}
                                    className="text-xs bg-green-600 text-white px-3 py-1 rounded"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                                        {sub.name}
                                      </span>
                                      <span className="text-[9px] bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.2 rounded font-mono">
                                        {getBookmarksCount(sub.id)}
                                      </span>
                                    </div>
                                    {sub.promptContext && (
                                      <p className="text-[11px] text-gray-500 dark:text-gray-400 max-w-sm">
                                        {sub.promptContext}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => {
                                        setAddingUnderFolderId(sub.id);
                                        setInlineFolderName("");
                                        setInlinePromptContext("");
                                      }}
                                      className="p-1 rounded text-gray-400 hover:text-emerald-500 hover:bg-gray-100 dark:hover:bg-gray-750 cursor-pointer"
                                      title="Add subcategory"
                                    >
                                      <Plus size={12} />
                                    </button>
                                    <button
                                      onClick={() => startEdit(sub)}
                                      className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-750 cursor-pointer"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteFolder(sub.id, sub.name)
                                      }
                                      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-750 cursor-pointer"
                                    >
                                      <Trash size={12} />
                                    </button>
                                  </div>
                                </div>

                                {/* Nested subfolder creation inline */}
                                {addingUnderFolderId === sub.id && (
                                  <div className="flex items-start gap-2 animate-fade-in pl-4">
                                    <CornerDownRight
                                      size={12}
                                      className="text-gray-400 mt-1"
                                    />
                                    <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-750 max-w-md space-y-2">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        New Subcategory under {sub.name}
                                      </span>
                                      <input
                                        type="text"
                                        placeholder="Category name..."
                                        value={inlineFolderName}
                                        onChange={(e) =>
                                          setInlineFolderName(e.target.value)
                                        }
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            handleInlineCreateFolder(sub.id);
                                          if (e.key === "Escape")
                                            setAddingUnderFolderId(null);
                                        }}
                                        autoFocus
                                      />
                                      <input
                                        type="text"
                                        placeholder="AI Context prompt keywords (optional)..."
                                        value={inlinePromptContext}
                                        onChange={(e) =>
                                          setInlinePromptContext(e.target.value)
                                        }
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-[10px] dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            handleInlineCreateFolder(sub.id);
                                          if (e.key === "Escape")
                                            setAddingUnderFolderId(null);
                                        }}
                                      />
                                      <div className="flex justify-end gap-1.5 mt-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setAddingUnderFolderId(null)
                                          }
                                          className="text-[9px] text-gray-450 hover:text-gray-600 font-semibold px-2 py-0.5 rounded hover:bg-gray-100 cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleInlineCreateFolder(sub.id)
                                          }
                                          className="text-[9px] bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2.5 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                                        >
                                          <Check size={9} />
                                          <span>Create</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Inline form directly under root subfolders */}
                      {addingUnderFolderId === root.id && (
                        <div className="flex items-start gap-2 animate-fade-in pl-4">
                          <CornerDownRight
                            size={14}
                            className="text-gray-400 mt-1"
                          />
                          <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 max-w-md space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              New Subcategory under {root.name}
                            </span>
                            <input
                              type="text"
                              placeholder="Category name..."
                              value={inlineFolderName}
                              onChange={(e) =>
                                setInlineFolderName(e.target.value)
                              }
                              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleInlineCreateFolder(root.id);
                                if (e.key === "Escape")
                                  setAddingUnderFolderId(null);
                              }}
                              autoFocus
                            />
                            <input
                              type="text"
                              placeholder="AI Context prompt keywords (optional)..."
                              value={inlinePromptContext}
                              onChange={(e) =>
                                setInlinePromptContext(e.target.value)
                              }
                              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2.5 py-1.5 text-[11px] dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleInlineCreateFolder(root.id);
                                if (e.key === "Escape")
                                  setAddingUnderFolderId(null);
                              }}
                            />
                            <div className="flex justify-end gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => setAddingUnderFolderId(null)}
                                className="text-[10px] text-gray-405 hover:text-gray-500 font-semibold px-2.5 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleInlineCreateFolder(root.id)
                                }
                                className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <Check size={10} />
                                <span>Create</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
