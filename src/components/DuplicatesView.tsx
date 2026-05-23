import React, { useMemo } from 'react';
import { CopyX, Trash, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../store';

export function DuplicatesView() {
  const { bookmarks, deleteBookmark, bulkDeleteBookmarks } = useAppContext();

  // Find exact duplicate URLs
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    bookmarks.forEach(b => {
      // Normalize url to make matching exact and precise
      const norm = b.url.trim().toLowerCase().replace(/\/$/, "");
      const g = map.get(norm) || [];
      g.push(b);
      map.set(norm, g);
    });
    
    return Array.from(map.entries())
      .filter(([_, items]) => items.length > 1)
      .map(([url, items]) => ({
        url,
        // Sort items so the oldest is kept (recommended original)
        items: items.sort((a, b) => a.dateAdded - b.dateAdded)
      }));
  }, [bookmarks]);

  // Total number of redundant copies (all duplicates minus one original per group)
  const totalDuplicateCount = useMemo(
    () => duplicateGroups.reduce((sum, g) => sum + g.items.length - 1, 0),
    [duplicateGroups],
  );
  const totalGroupCount = duplicateGroups.length;

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to remove this duplicate bookmark reference?")) {
      deleteBookmark(id);
    }
  };

  const handleBulkDeDuplicate = () => {
    const toRemoveIds: string[] = [];
    duplicateGroups.forEach(group => {
      // Keep the 1st index (oldest = original), remove the rest
      group.items.slice(1).forEach(item => {
        toRemoveIds.push(item.id);
      });
    });

    if (toRemoveIds.length === 0) return;

    if (confirm(
      `This will remove ${toRemoveIds.length} duplicate ${toRemoveIds.length === 1 ? 'copy' : 'copies'} across ${totalGroupCount} URL ${totalGroupCount === 1 ? 'group' : 'groups'}.\n\nThe OLDEST (original) bookmark for each URL is kept. All newer copies are deleted.\n\nProceed?`
    )) {
      bulkDeleteBookmarks(toRemoveIds, `Removed ${toRemoveIds.length} duplicate bookmarks`);
      alert(`Done! Removed ${toRemoveIds.length} redundant ${toRemoveIds.length === 1 ? 'copy' : 'copies'}. Originals preserved.`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pt-2 h-full flex flex-col space-y-6">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-250 dark:border-gray-800 pb-6 text-gray-800 dark:text-gray-200">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30">
            <CopyX size={30} />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Duplicate Finder</h2>
            <p className="text-gray-500 text-sm mt-1">Scans exact URLs to identify repetitive listings safely.</p>
            {totalGroupCount > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs font-bold px-3 py-1 rounded-full border border-red-200 dark:border-red-900/40">
                  <CopyX size={12} />
                  {totalDuplicateCount} duplicate {totalDuplicateCount === 1 ? 'copy' : 'copies'} found
                </span>
                <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500 text-xs font-mono">
                  across {totalGroupCount} URL {totalGroupCount === 1 ? 'group' : 'groups'}
                </span>
              </div>
            )}
          </div>
        </div>

        {duplicateGroups.length > 0 && (
          <button 
            type="button"
            onClick={handleBulkDeDuplicate}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
          >
            <ShieldCheck size={16} />
            Bulk Auto-Deduplicate
          </button>
        )}
      </div>

      {/* ANALYSIS BANNER */}
      {duplicateGroups.length > 0 && (
      <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="flex-shrink-0 mt-0.5 text-amber-600" size={18} />
          <div className="text-xs space-y-1">
            <span className="font-bold block">
              {totalDuplicateCount} redundant {totalDuplicateCount === 1 ? 'copy' : 'copies'} detected across {totalGroupCount} URL {totalGroupCount === 1 ? 'group' : 'groups'}
            </span>
            <span>Identical URLs stored multiple times bloat your index. <strong>Bulk Auto-Deduplicate keeps the oldest (original)</strong> and removes all newer copies.</span>
          </div>
        </div>
      )}

      {/* DUPLICATE GROUPS DECK */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-12">
        {duplicateGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
            <ShieldCheck className="text-emerald-500 mb-3" size={48} />
            <h4 className="font-bold text-gray-800 dark:text-gray-100 text-base">Perfect Database Integrity!</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No duplicates or redunancies detected. Your bookmark collection is highly optimized.</p>
          </div>
        ) : (
          duplicateGroups.map(group => (
            <div key={group.url} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="bg-gray-50 dark:bg-gray-900 px-5 py-3 border-b border-gray-200 dark:border-gray-800">
                <span className="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Redundant Path Group</span>
                <span className="font-mono text-xs text-blue-600 dark:text-blue-400 break-all mt-1 block font-semibold">{group.url}</span>
              </div>
              
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {group.items.map((item, idx) => {
                  const isOriginal = idx === 0;
                  return (
                    <div key={item.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50/40 dark:hover:bg-gray-800/20 transition-all gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          {isOriginal ? (
                            <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider flex items-center gap-1 border border-emerald-100">
                              <Check size={11} /> Retain Original
                            </span>
                          ) : (
                            <span className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-[10px] px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider border border-red-100">
                              Redundant Link
                            </span>
                          )}
                          <h4 className="font-bold text-gray-900 dark:text-white truncate text-sm">{item.title}</h4>
                        </div>
                        
                        {item.summary && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 italic">
                            "{item.summary}"
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1.5 font-mono">
                          Imported added: {new Date(item.dateAdded).toLocaleString()}
                        </p>
                      </div>

                      <button 
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="self-end sm:self-center flex items-center gap-1.5 px-3 py-1.8 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-900/50 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash size={13} />
                        Delete Reference
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
