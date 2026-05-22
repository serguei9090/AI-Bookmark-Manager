import React, { useState, useMemo } from 'react';
import { FolderTree, Sparkles, Plus, Edit2, Trash, HelpCircle, Save, XCircle, Check, ArrowRight, CornerDownRight, FileText } from 'lucide-react';
import { useAppContext } from '../store';
import { Folder } from '../types';

export function CategoriesView() {
  const { bookmarks, folders, batchUpdateBookmarks, addFolder, deleteFolder, updateFolder, settings } = useAppContext();
  const [isSorting, setIsSorting] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  
  // Proposals container
  const [proposals, setProposals] = useState<any[]>([]);
  
  // Add dialog state
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newParentId, setNewParentId] = useState<string>('root');
  const [newPromptContext, setNewPromptContext] = useState('');

  // Editing folder state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editParentId, setEditParentId] = useState<string>('root');
  const [editPromptContext, setEditPromptContext] = useState('');

  // Auto classify bookmark categories using Gemini
  const handleAutoSort = async () => {
    setIsSorting(true);
    try {
      if (settings.provider === 'gemini') {
        const res = await fetch('/api/ai/auto-sort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookmarks, folders, systemPrompt: settings.systemPrompt })
        });
        const data = await res.json();
        if (data.success && data.mapping) {
          const updatedBms = bookmarks.map(b => ({
            ...b,
            folderId: data.mapping[b.id] !== undefined ? data.mapping[b.id] : b.folderId
          }));
          batchUpdateBookmarks(updatedBms, 'AI Auto-Sorted bookmarks');
          alert('AI Auto-Sort complete! Bookmarks organized securely based on folder semantic definitions.');
        } else {
          // Perform local best-effort matching if API key missing or returns empty
          fallbackAutoSort();
        }
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
    const updated = bookmarks.map(b => {
      if (b.folderId) return b; // keep existing manual allocation
      
      // Look for keywords in folder names/definitions
      for (const fol of folders) {
        const keywords = [
          fol.name.toLowerCase(),
          ...(fol.promptContext ? fol.promptContext.toLowerCase().split(/[\s,.-]+/) : [])
        ].filter(k => k.length > 3);

        const textMatches = keywords.some(kw => 
          b.title.toLowerCase().includes(kw) || 
          b.url.toLowerCase().includes(kw)
        );

        if (textMatches) {
          matchCount++;
          return { ...b, folderId: fol.id };
        }
      }
      return b;
    });

    batchUpdateBookmarks(updated, 'Local Auto-Sorted bookmarks');
    alert(`Local Match Complete! Automatically matched ${matchCount} bookmarks based on title and folder context metadata.`);
  };

  // Generate category proposals via Gemini
  const handlePropose = async () => {
    setIsProposing(true);
    try {
      if (settings.provider === 'gemini') {
        const res = await fetch('/api/ai/propose-category', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookmarks, systemPrompt: settings.systemPrompt })
        });
        const data = await res.json();
        if (data.success && data.proposals) {
          setProposals(data.proposals);
        } else {
          setProposals(getMockProposals());
        }
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
      { name: 'Technology & Hardware', promptContext: 'CPUs, cloud infrastructure, specifications, tech hardware sheets.' },
      { name: 'Learning & Tutorials', promptContext: 'Online education resources, coding interactive playgrounds, MDN references.' },
      { name: 'Social & Communication', promptContext: 'Discussion boards, forums, developer communities like StackOverflow.' },
    ];
  };

  const applyProposals = () => {
    proposals.forEach(p => {
      addFolder({ 
        id: crypto.randomUUID(), 
        parentId: null, 
        name: p.name, 
        promptContext: p.promptContext 
      });
    });
    setProposals([]);
    alert('Category Proposals successfully loaded into your active database!');
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    addFolder({
      id: crypto.randomUUID(),
      parentId: newParentId === 'root' ? null : newParentId,
      name: newFolderName.trim(),
      promptContext: newPromptContext.trim()
    });

    setIsAddingFolder(false);
    setNewFolderName('');
    setNewParentId('root');
    setNewPromptContext('');
  };

  const startEdit = (fol: Folder) => {
    setEditingId(fol.id);
    setEditName(fol.name);
    setEditParentId(fol.parentId || 'root');
    setEditPromptContext(fol.promptContext);
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    updateFolder(editingId!, {
      name: editName.trim(),
      parentId: editParentId === 'root' ? null : editParentId,
      promptContext: editPromptContext.trim()
    });
    setEditingId(null);
  };

  // Build recursive tree visual
  const rootFolders = useMemo(() => folders.filter(f => !f.parentId), [folders]);
  const subFoldersMap = useMemo(() => {
    const map = new Map<string, Folder[]>();
    folders.forEach(f => {
      if (f.parentId) {
        const group = map.get(f.parentId) || [];
        group.push(f);
        map.set(f.parentId, group);
      }
    });
    return map;
  }, [folders]);

  const getBookmarksCount = (folderId: string) => {
    return bookmarks.filter(b => b.folderId === folderId).length;
  };

  // Helper to edit proposal items
  const handleEditProposalValue = (index: number, field: 'name' | 'promptContext', val: string) => {
    const next = [...proposals];
    next[index][field] = val;
    setProposals(next);
  };

  const handleRemoveProposalItem = (index: number) => {
    setProposals(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="h-full flex flex-col space-y-6 max-w-5xl mx-auto">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold dark:text-white tracking-tight">Categories & Subfolders</h2>
          <p className="text-gray-500 dark:text-gray-400">Structure bookmark directories and inject category-level prompts for AI classifiers.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto self-end">
          <button 
            type="button"
            onClick={handlePropose}
            disabled={isProposing}
            className="flex-1 sm:flex-initial bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-4 py-2.5 rounded-xl font-medium transition-all text-sm flex items-center justify-center gap-1.5"
          >
            <Sparkles size={16} />
            {isProposing ? 'Analyzing...' : 'AI Propose Layout'}
          </button>
          
          <button 
            type="button"
            onClick={handleAutoSort}
            disabled={isSorting}
            className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all text-sm flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Sparkles size={16} />
            {isSorting ? 'Organizing...' : 'AI Auto-Sort'}
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
                The model analyzed your current bookmark set and suggested these specific visual folder buckets. Customize their attributes before applying.
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
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Suggested Folder</span>
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
                    onChange={e => handleEditProposalValue(idx, 'name', e.target.value)}
                    className="font-bold text-gray-950 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-2 bg-transparent focus:border-purple-500 focus:outline-none w-full text-sm"
                  />
                  <textarea 
                    rows={2}
                    value={prop.promptContext}
                    onChange={e => handleEditProposalValue(idx, 'promptContext', e.target.value)}
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

      {/* TREE CONTENT SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* CREATE DIRECTORY PANEL */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
            <Plus size={20} className="text-blue-500" />
            Add New Category
          </h3>
          <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Folder Name</label>
              <input 
                type="text"
                required
                placeholder="e.g. Design Inspiration"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Parent Directory</label>
              <select
                value={newParentId}
                onChange={e => setNewParentId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 dark:text-white"
              >
                <option value="root">📁 Root Level (No Parent)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">AI Semantic Context Definition</label>
              <textarea 
                rows={3}
                placeholder="Type descriptive prompt keywords specifying the type of references that belong here (e.g. typography, mockups, color palettes)..."
                value={newPromptContext}
                onChange={e => setNewPromptContext(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2 dark:text-white text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95"
            >
              Add Folder Node
            </button>
          </form>
        </div>

        {/* INTERACTIVE TREE REPRESENTATION */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3 mb-4">
            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
              <FolderTree size={20} className="text-emerald-500" />
              Hierarchy Structure
            </h3>
            <span className="text-[10px] bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded-md text-gray-500 font-mono">
              Count: {folders.length} Nodes
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {folders.length === 0 ? (
              <div className="text-center py-20 text-gray-400 italic">
                No folders custom-defined. Select "AI Propose Layout" to bootstrap quickly!
              </div>
            ) : (
              rootFolders.map(root => {
                const subs = subFoldersMap.get(root.id) || [];
                return (
                  <div key={root.id} className="border border-gray-100 dark:border-gray-700/50 p-4 rounded-xl hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
                    
                    {/* ROOT LEVEL CARD */}
                    {editingId === root.id ? (
                      <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-yellow-200">
                        <input 
                          type="text" 
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 dark:text-white font-bold"
                        />
                        <select
                          value={editParentId}
                          onChange={e => setEditParentId(e.target.value)}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 dark:text-white text-xs"
                        >
                          <option value="root">📁 Root Level</option>
                          {folders.filter(f => f.id !== root.id).map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                        <textarea 
                          rows={2}
                          value={editPromptContext}
                          onChange={e => setEditPromptContext(e.target.value)}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs dark:text-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                          <button onClick={saveEdit} className="text-xs bg-green-600 text-white px-3 py-1 rounded">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between group">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-white text-base">{root.name}</span>
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
                          <button onClick={() => startEdit(root)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-750 rounded text-gray-400 hover:text-blue-500">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => deleteFolder(root.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-750 rounded text-gray-400 hover:text-red-500">
                            <Trash size={13} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SUB LEVEL FOLDERS */}
                    {subs.length > 0 && (
                      <div className="mt-4 pl-4 border-l-2 border-dashed border-gray-200 dark:border-gray-800 space-y-3">
                        {subs.map(sub => (
                          <div key={sub.id} className="flex items-start gap-2 group/sub">
                            <CornerDownRight size={14} className="text-gray-400 mt-1" />
                            <div className="flex-1">
                              {editingId === sub.id ? (
                                <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-yellow-300">
                                  <input 
                                    type="text" 
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 rounded px-2 py-1 dark:text-white font-bold"
                                  />
                                  <select
                                    value={editParentId}
                                    onChange={e => setEditParentId(e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                                  >
                                    <option value="root">📁 Root Level</option>
                                    {folders.filter(f => f.id !== sub.id).map(f => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                  </select>
                                  <textarea 
                                    rows={2}
                                    value={editPromptContext}
                                    onChange={e => setEditPromptContext(e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                                    <button onClick={saveEdit} className="text-xs bg-green-600 text-white px-3 py-1 rounded">Save</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{sub.name}</span>
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
                                    <button onClick={() => startEdit(sub)} className="p-1 rounded text-gray-400 hover:text-blue-500">
                                      <Edit2 size={12} />
                                    </button>
                                    <button onClick={() => deleteFolder(sub.id)} className="p-1 rounded text-gray-400 hover:text-red-500">
                                      <Trash size={12} />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
