import {
	AlertTriangle,
	Check,
	CopyX,
	Edit3,
	ExternalLink,
	Globe,
	HeartCrack,
	Loader2,
	Play,
	RefreshCw,
	Search,
	ShieldCheck,
	Trash,
	Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../store";
import type { Bookmark } from "../types";

// Helper to check if running inside a real Chrome extension
const isExtension =
	typeof chrome !== "undefined" && chrome.bookmarks !== undefined;

interface ScanResult {
	alive: boolean;
	status: number;
	message: string;
}

const performSingleCheck = async (
	url: string,
	signal: AbortSignal,
	timeoutMs = 8000,
): Promise<ScanResult> => {
	const controller = new AbortController();
	const onAbort = () => controller.abort();
	signal.addEventListener("abort", onAbort);

	const timeoutId = setTimeout(() => {
		controller.abort();
	}, timeoutMs);

	try {
		// First try standard fetch request
		const res = await fetch(url, {
			method: "GET",
			signal: controller.signal,
			cache: "no-store",
		});
		clearTimeout(timeoutId);
		signal.removeEventListener("abort", onAbort);

		if (res.status >= 400) {
			return {
				alive: false,
				status: res.status,
				message: `Status ${res.status}`,
			};
		}
		return { alive: true, status: res.status, message: "OK" };
	} catch (_err) {
		clearTimeout(timeoutId);
		signal.removeEventListener("abort", onAbort);

		if (controller.signal.aborted) {
			if (signal.aborted) {
				throw new Error("Aborted");
			}
			return { alive: false, status: 408, message: "Timeout (8s)" };
		}

		// Fallback to mode: 'no-cors' GET
		const noCorsController = new AbortController();
		const onAbortNoCors = () => noCorsController.abort();
		signal.addEventListener("abort", onAbortNoCors);

		const noCorsTimeoutId = setTimeout(() => {
			noCorsController.abort();
		}, timeoutMs);

		try {
			await fetch(url, {
				method: "GET",
				mode: "no-cors",
				signal: noCorsController.signal,
				cache: "no-store",
			});
			clearTimeout(noCorsTimeoutId);
			signal.removeEventListener("abort", onAbortNoCors);

			return { alive: true, status: 0, message: "Reachable (CORS Opaque)" };
		} catch (_noCorsErr) {
			clearTimeout(noCorsTimeoutId);
			signal.removeEventListener("abort", onAbortNoCors);

			if (signal.aborted) {
				throw new Error("Aborted");
			}

			const isTimeout = noCorsController.signal.aborted;
			return {
				alive: false,
				status: isTimeout ? 408 : 0,
				message: isTimeout ? "Timeout (8s)" : "Unreachable / DNS Error",
			};
		}
	}
};

const checkUrlConnectivity = async (
	url: string,
	signal: AbortSignal,
): Promise<ScanResult> => {
	const lowerUrl = url.trim().toLowerCase();
	if (
		lowerUrl.startsWith("chrome://") ||
		lowerUrl.startsWith("chrome-extension://") ||
		lowerUrl.startsWith("about:") ||
		lowerUrl.startsWith("file://") ||
		lowerUrl.startsWith("javascript:") ||
		lowerUrl.startsWith("view-source:")
	) {
		return { alive: true, status: 200, message: "System URL" };
	}

	const timeoutMs = 8000;

	// 1. First Attempt
	let result = await performSingleCheck(url, signal, timeoutMs);
	if (signal.aborted) {
		throw new Error("Aborted");
	}

	const isOffline = result.status === 0 || result.status === 408;
	if (isOffline) {
		// Wait 1 second before retrying
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(resolve, 1000);
			const onAbort = () => {
				clearTimeout(timeout);
				reject(new Error("Aborted"));
			};
			signal.addEventListener("abort", onAbort);
		});

		if (signal.aborted) {
			throw new Error("Aborted");
		}

		result = await performSingleCheck(url, signal, timeoutMs);
		if (signal.aborted) {
			throw new Error("Aborted");
		}
	}

	// 2. Fallback to domain root if deep URL check fails with DNS error or timeout
	const stillOffline = result.status === 0 || result.status === 408;
	if (stillOffline) {
		let domainRoot = "";
		try {
			const parsed = new URL(url);
			domainRoot = `${parsed.protocol}//${parsed.host}/`;
		} catch {
			// ignore parsing error
		}

		if (domainRoot && domainRoot.toLowerCase() !== url.trim().toLowerCase()) {
			try {
				const rootResult = await performSingleCheck(
					domainRoot,
					signal,
					timeoutMs,
				);
				if (signal.aborted) {
					throw new Error("Aborted");
				}

				const rootIsReachable =
					rootResult.alive ||
					(rootResult.status !== 0 && rootResult.status !== 408);
				if (rootIsReachable) {
					return {
						alive: false,
						status: 999, // Custom status code: Unhealthy HTTP (Host reachable but deep path DNS/Timeout)
						message: "Host Reachable (Page DNS/Timeout)",
					};
				}
			} catch {
				// Keep the original failure result
			}
		}
	}

	return result;
};

export function ToolsView() {
	const {
		bookmarks,
		folders,
		deleteBookmark,
		bulkDeleteBookmarks,
		updateBookmark,
	} = useAppContext();

	const [activeSubTab, setActiveSubTab] = useState<"duplicates" | "health">(
		"duplicates",
	);

	// ==========================================
	// 1. DUPLICATE FINDER STATE & LOGIC
	// ==========================================
	const duplicateGroups = useMemo(() => {
		const map = new Map<string, Bookmark[]>();
		bookmarks.forEach((b) => {
			const norm = b.url.trim().toLowerCase().replace(/\/$/, "");
			const g = map.get(norm) || [];
			g.push(b);
			map.set(norm, g);
		});

		return Array.from(map.entries())
			.filter(([_, items]) => items.length > 1)
			.map(([url, items]) => ({
				url,
				items: items.sort((a, b) => a.dateAdded - b.dateAdded),
			}));
	}, [bookmarks]);

	const totalDuplicateCount = useMemo(
		() => duplicateGroups.reduce((sum, g) => sum + g.items.length - 1, 0),
		[duplicateGroups],
	);

	const handleDeleteDuplicate = (id: string) => {
		if (
			confirm(
				"Are you sure you want to remove this duplicate bookmark reference?",
			)
		) {
			deleteBookmark(id);
		}
	};

	const handleBulkDeDuplicate = () => {
		const toRemoveIds: string[] = [];
		duplicateGroups.forEach((group) => {
			group.items.slice(1).forEach((item) => {
				toRemoveIds.push(item.id);
			});
		});

		if (toRemoveIds.length === 0) return;

		if (
			confirm(
				`This will remove ${toRemoveIds.length} duplicate copies across ${duplicateGroups.length} URL groups.\n\nThe OLDEST (original) bookmark for each URL is kept. All newer copies are deleted.\n\nProceed?`,
			)
		) {
			bulkDeleteBookmarks(
				toRemoveIds,
				`Removed ${toRemoveIds.length} duplicate bookmarks`,
			);
			alert(
				`Done! Removed ${toRemoveIds.length} redundant copies. Originals preserved.`,
			);
		}
	};

	// ==========================================
	// 2. LINK HEALTH CHECKER STATE & LOGIC
	// ==========================================
	const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
	const [scanState, setScanState] = useState<"idle" | "scanning" | "complete">(
		"idle",
	);
	const [scannedCount, setScannedCount] = useState(0);
	const [totalToScan, setTotalToScan] = useState(0);
	const [scanResults, setScanResults] = useState<
		Record<string, { alive: boolean; status: number; message: string }>
	>({});
	const [healthFilterTab, setHealthFilterTab] = useState<
		"dead" | "unhealthy" | "ignored"
	>("dead");
	const [healthSearch, setHealthSearch] = useState("");

	// Inline editing of broken link title/URL
	const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(
		null,
	);
	const [editTitle, setEditTitle] = useState("");
	const [editUrl, setEditUrl] = useState("");
	const [recheckingIds, setRecheckingIds] = useState<Record<string, boolean>>(
		{},
	);

	const abortControllerRef = useRef<AbortController | null>(null);

	// Clean up abort controller on unmount
	useEffect(() => {
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, []);

	// Recursive helper to get all child folders
	const getFolderDescendants = useCallback(
		(folderId: string): string[] => {
			const children = folders.filter((f) => f.parentId === folderId);
			return [folderId, ...children.flatMap((c) => getFolderDescendants(c.id))];
		},
		[folders],
	);

	const getFolderBookmarkCount = useCallback(
		(fid: string): number => {
			const descendantIds = getFolderDescendants(fid);
			return bookmarks.filter(
				(b) => b.folderId !== null && descendantIds.includes(b.folderId),
			).length;
		},
		[bookmarks, getFolderDescendants],
	);

	// Filter bookmarks to scan based on folder selection
	const bookmarksToScan = useMemo(() => {
		if (selectedFolderId === "all") {
			return bookmarks;
		}
		const folderIds = getFolderDescendants(selectedFolderId);
		return bookmarks.filter(
			(b) => b.folderId !== null && folderIds.includes(b.folderId),
		);
	}, [bookmarks, selectedFolderId, getFolderDescendants]);

	const checkUrl = useCallback(async (url: string, signal: AbortSignal) => {
		return checkUrlConnectivity(url, signal);
	}, []);

	const handleRecheckLink = async (bm: Bookmark) => {
		setRecheckingIds((prev) => ({ ...prev, [bm.id]: true }));
		try {
			const res = await checkUrl(bm.url, new AbortController().signal);
			setScanResults((prev) => ({ ...prev, [bm.id]: res }));
		} catch (_err) {
			setScanResults((prev) => ({
				...prev,
				[bm.id]: { alive: false, status: 0, message: "Failed Check" },
			}));
		} finally {
			setRecheckingIds((prev) => ({ ...prev, [bm.id]: false }));
		}
	};

	const startLinkScan = async () => {
		// Only scan bookmarks that aren't already flagged as ignored dead
		const targets = bookmarksToScan;
		if (targets.length === 0) {
			alert("No bookmarks in the selected scope to scan.");
			return;
		}

		setScanState("scanning");
		setScannedCount(0);
		setTotalToScan(targets.length);
		setScanResults({});

		const controller = new AbortController();
		abortControllerRef.current = controller;

		let index = 0;
		const concurrencyLimit = 5;

		const worker = async () => {
			while (index < targets.length && !controller.signal.aborted) {
				const currentIndex = index++;
				if (currentIndex >= targets.length) break;

				const bm = targets[currentIndex];
				try {
					const result = await checkUrl(bm.url, controller.signal);
					if (controller.signal.aborted) break;

					setScanResults((prev) => ({ ...prev, [bm.id]: result }));
					setScannedCount((prev) => prev + 1);
				} catch (_err) {
					if (controller.signal.aborted) break;
					const result = { alive: false, status: 0, message: "Failed Check" };
					setScanResults((prev) => ({ ...prev, [bm.id]: result }));
					setScannedCount((prev) => prev + 1);
				}
			}
		};

		const workers = Array.from(
			{ length: Math.min(concurrencyLimit, targets.length) },
			worker,
		);
		await Promise.all(workers);

		if (!controller.signal.aborted) {
			setScanState("complete");
		}
	};

	const cancelLinkScan = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			setScanState("idle");
		}
	};

	// Categorize scanner findings
	const scanSummary = useMemo(() => {
		let alive = 0;
		let dead = 0;
		let unhealthy = 0;
		let ignored = 0;

		for (const bm of bookmarksToScan) {
			if (bm.ignoredDead) {
				ignored++;
				continue;
			}
			const res = scanResults[bm.id];
			if (res) {
				if (res.alive) {
					alive++;
				} else {
					const isOffline = res.status === 0 || res.status === 408;
					if (isOffline) {
						dead++;
					} else {
						unhealthy++;
					}
				}
			}
		}

		return { alive, dead, unhealthy, ignored };
	}, [bookmarksToScan, scanResults]);

	// Filtered list of dead bookmarks to display based on the selected healthFilterTab
	const filteredHealthList = useMemo(() => {
		return bookmarksToScan
			.filter((bm) => {
				const result = scanResults[bm.id];

				const matchesSearch =
					bm.title.toLowerCase().includes(healthSearch.toLowerCase()) ||
					bm.url.toLowerCase().includes(healthSearch.toLowerCase());
				if (!matchesSearch) return false;

				if (healthFilterTab === "ignored") {
					return !!bm.ignoredDead;
				}

				if (bm.ignoredDead) return false;

				if (!result || result.alive) return false;

				const isOffline = result.status === 0 || result.status === 408;
				if (healthFilterTab === "dead") {
					return isOffline;
				}
				// unhealthy
				return !isOffline;
			})
			.map((bm) => ({
				...bm,
				result: scanResults[bm.id],
			}));
	}, [bookmarksToScan, scanResults, healthFilterTab, healthSearch]);

	const handleIgnoreLink = (id: string, currentIgnore: boolean) => {
		updateBookmark(id, { ignoredDead: !currentIgnore });
	};

	const handleStartEdit = (bm: Bookmark) => {
		setEditingBookmarkId(bm.id);
		setEditTitle(bm.title);
		setEditUrl(bm.url);
	};

	const handleSaveEdit = (id: string) => {
		if (!editTitle.trim() || !editUrl.trim()) return;
		updateBookmark(id, { title: editTitle.trim(), url: editUrl.trim() });
		setEditingBookmarkId(null);
	};

	const handleDeleteDeadBookmark = (id: string) => {
		if (confirm("Are you sure you want to delete this broken bookmark?")) {
			deleteBookmark(id);
		}
	};

	const handleBulkDeleteDead = () => {
		if (healthFilterTab === "ignored") return;

		const targetIds = filteredHealthList.map((bm) => bm.id);
		if (targetIds.length === 0) return;

		const label =
			healthFilterTab === "dead" ? "totally dead / offline" : "unhealthy";
		if (
			confirm(
				`Are you sure you want to delete all ${targetIds.length} verified ${label} bookmarks in the current list?\n\nThis action cannot be undone.`,
			)
		) {
			bulkDeleteBookmarks(
				targetIds,
				`Bulk deleted ${targetIds.length} ${label} bookmarks`,
			);
			alert(`Successfully deleted ${targetIds.length} bookmarks!`);
		}
	};

	// Helper to find folder name path
	const getFolderPathName = (folderId: string | null): string => {
		if (!folderId) return "Root";
		const f = folders.find((fol) => fol.id === folderId);
		if (!f) return "Root";
		if (f.parentId) {
			return `${getFolderPathName(f.parentId)} / ${f.name}`;
		}
		return f.name;
	};

	return (
		<div className="max-w-5xl mx-auto pt-2 h-full flex flex-col space-y-6">
			{/* PAGE HEADER */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6 text-gray-800 dark:text-gray-200">
				<div>
					<h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
						<Wrench className="text-blue-500" size={32} />
						Workspace Maintenance Tools
					</h2>
					<p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
						Perform sanity audits, remove duplicates, and sweep dead bookmark
						references.
					</p>
				</div>
			</div>

			{/* SUB-TABS NAVIGATION */}
			<div className="flex border-b border-gray-250 dark:border-gray-800 shrink-0">
				<button
					type="button"
					onClick={() => setActiveSubTab("duplicates")}
					className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
						activeSubTab === "duplicates"
							? "border-blue-500 text-blue-600 dark:text-blue-400"
							: "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
					}`}
				>
					<CopyX size={16} />
					Duplicate Finder
					{totalDuplicateCount > 0 && (
						<span className="bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
							{totalDuplicateCount}
						</span>
					)}
				</button>
				<button
					type="button"
					onClick={() => setActiveSubTab("health")}
					className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
						activeSubTab === "health"
							? "border-blue-500 text-blue-600 dark:text-blue-400"
							: "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
					}`}
				>
					<HeartCrack size={16} />
					Link Health Checker
				</button>
			</div>

			{/* VIEW SWITCHER */}
			<div className="flex-1 flex flex-col overflow-hidden min-h-[400px]">
				{/* ----------------- DUPLICATES VIEW ----------------- */}
				{activeSubTab === "duplicates" && (
					<div className="flex-1 flex flex-col space-y-6 overflow-hidden">
						{/* HEADER & ACTION BAR */}
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
							<div>
								<h3 className="text-xl font-bold dark:text-white">
									Redundant Bookmark Scanner
								</h3>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									De-duplicates instances of identical URLs stored across
									folders.
								</p>
							</div>
							{duplicateGroups.length > 0 && (
								<button
									type="button"
									onClick={handleBulkDeDuplicate}
									className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
								>
									<ShieldCheck size={14} />
									Bulk Auto-Deduplicate
								</button>
							)}
						</div>

						{/* WARNING INFO */}
						{duplicateGroups.length > 0 && (
							<div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-250 dark:border-amber-900/30 rounded-2xl p-4 flex gap-3 text-amber-800 dark:text-amber-300 shrink-0">
								<AlertTriangle
									className="flex-shrink-0 mt-0.5 text-amber-600"
									size={18}
								/>
								<div className="text-xs space-y-1">
									<span className="font-bold block">
										{totalDuplicateCount} redundant copies found across{" "}
										{duplicateGroups.length} groups.
									</span>
									<span>
										Bulk De-duplication keeps the{" "}
										<strong>oldest (original)</strong> bookmark for each URL
										group and deletes all newer redundant references.
									</span>
								</div>
							</div>
						)}

						{/* LIST OF DUPLICATES */}
						<div className="flex-1 overflow-y-auto space-y-6 pb-12 pr-1">
							{duplicateGroups.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-20 bg-gray-50/30 dark:bg-gray-900/10 rounded-2xl border border-dashed border-gray-250 dark:border-gray-800">
									<ShieldCheck className="text-emerald-500 mb-3" size={48} />
									<h4 className="font-bold text-gray-800 dark:text-gray-100 text-base">
										Perfect Database Integrity!
									</h4>
									<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
										No duplicate URL references detected in your collection.
									</p>
								</div>
							) : (
								duplicateGroups.map((group) => (
									<div
										key={group.url}
										className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
									>
										<div className="bg-gray-50 dark:bg-gray-900 px-5 py-3 border-b border-gray-200 dark:border-gray-800">
											<span className="font-semibold text-[10px] text-gray-450 dark:text-gray-500 uppercase tracking-wider block">
												Duplicate URL Group
											</span>
											<span className="font-mono text-xs text-blue-650 dark:text-blue-400 break-all mt-1 block font-semibold">
												{group.url}
											</span>
										</div>

										<div className="divide-y divide-gray-100 dark:divide-gray-800">
											{group.items.map((item, idx) => {
												const isOriginal = idx === 0;
												return (
													<div
														key={item.id}
														className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50/40 dark:hover:bg-gray-800/10 transition-all gap-4"
													>
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2 flex-wrap mb-1">
																{isOriginal ? (
																	<span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-450 text-[9px] px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider flex items-center gap-1 border border-emerald-100 dark:border-emerald-900/30">
																		<Check size={10} /> Retain Original
																	</span>
																) : (
																	<span className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-[9px] px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider border border-red-100 dark:border-red-900/30">
																		Redundant Link
																	</span>
																)}
																<h4 className="font-bold text-gray-900 dark:text-white truncate text-xs">
																	{item.title}
																</h4>
															</div>

															{item.summary && (
																<p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 italic">
																	"{item.summary}"
																</p>
															)}
															<p className="text-[10px] text-gray-400 mt-1 font-mono">
																Imported path:{" "}
																{getFolderPathName(item.folderId)} • Added:{" "}
																{new Date(item.dateAdded).toLocaleString()}
															</p>
														</div>

														<button
															type="button"
															onClick={() => handleDeleteDuplicate(item.id)}
															className="self-end sm:self-center flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-900/50 rounded-xl transition-all cursor-pointer"
														>
															<Trash size={12} />
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
				)}

				{/* ----------------- HEALTH CHECKER VIEW ----------------- */}
				{activeSubTab === "health" && (
					<div className="flex-1 flex flex-col space-y-6 overflow-hidden">
						{/* HEALTH CHECK PANEL CONTROL BAR */}
						<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0 bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
							<div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
								{/* Scope Selection */}
								<div>
									<label
										htmlFor="folder-scope"
										className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2"
									>
										Scan Scope Folder
									</label>
									<select
										id="folder-scope"
										value={selectedFolderId}
										onChange={(e) => setSelectedFolderId(e.target.value)}
										disabled={scanState === "scanning"}
										className="w-full bg-gray-50 dark:bg-gray-850 border border-gray-250 dark:border-gray-700 rounded-xl px-3 py-2 dark:text-white text-xs outline-none focus:ring-1 focus:ring-blue-500"
									>
										<option value="all">
											📁 All Bookmarks ({bookmarks.length})
										</option>
										{folders.map((f) => (
											<option key={f.id} value={f.id}>
												📁 {f.name} ({getFolderBookmarkCount(f.id)})
											</option>
										))}
									</select>
								</div>
								{/* Info labels */}
								<div className="flex items-center gap-4 pt-4 sm:pt-0">
									{scanState !== "idle" && (
										<div className="w-full space-y-1">
											<div className="flex justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
												<span>Progress</span>
												<span>
													{scannedCount} / {totalToScan} checked (
													{Math.round(
														(scannedCount / (totalToScan || 1)) * 100,
													)}
													%)
												</span>
											</div>
											<div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
												<div
													style={{
														width: `${(scannedCount / (totalToScan || 1)) * 100}%`,
													}}
													className="bg-blue-600 h-full rounded-full transition-all duration-300"
												/>
											</div>
										</div>
									)}
								</div>
							</div>

							{/* Audit Button */}
							<div className="flex gap-2">
								{scanState === "scanning" ? (
									<button
										type="button"
										onClick={cancelLinkScan}
										className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
									>
										<Loader2 size={13} className="animate-spin" />
										Stop Audit
									</button>
								) : (
									<button
										type="button"
										onClick={startLinkScan}
										className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
									>
										<Play size={13} />
										Start Health Audit
									</button>
								)}
							</div>
						</div>

						{/* SUMMARY STATS BAR */}
						{scanState !== "idle" && (
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
								<div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-xl text-center shadow-sm">
									<span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 block">
										Alive Links
									</span>
									<span className="text-2xl font-black text-emerald-700 dark:text-emerald-350">
										{scanSummary.alive}
									</span>
								</div>
								<div className="bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-4 rounded-xl text-center shadow-sm">
									<span className="text-[10px] uppercase font-bold tracking-wider text-red-600 dark:text-red-400 block">
										Offline / Dead
									</span>
									<span className="text-2xl font-black text-red-700 dark:text-red-350">
										{scanSummary.dead}
									</span>
								</div>
								<div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-4 rounded-xl text-center shadow-sm">
									<span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-450 block">
										Unhealthy (HTTP Error)
									</span>
									<span className="text-2xl font-black text-amber-700 dark:text-amber-350">
										{scanSummary.unhealthy}
									</span>
								</div>
								<div className="bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 p-4 rounded-xl text-center shadow-sm">
									<span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 block">
										Ignored Links
									</span>
									<span className="text-2xl font-black text-gray-650 dark:text-gray-300">
										{scanSummary.ignored}
									</span>
								</div>
							</div>
						)}

						{/* CORS DISCLAIMER FOR WEB ENVIRONMENT */}
						{!isExtension && (
							<div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/40 rounded-xl p-3.5 flex gap-2.5 text-blue-800 dark:text-blue-300 text-[11px] leading-relaxed shrink-0">
								<Globe
									size={18}
									className="text-blue-500 shrink-0 mt-0.5 animate-pulse"
								/>
								<div>
									<span className="font-bold block mb-0.5">
										Sandbox Mode: CORS Policy Active
									</span>
									Some servers restrict direct requests from browser domains.
									When checked from this local development environment, we
									utilize a fail-safe connection check (
									<code>mode: 'no-cors'</code>) to verify if the server
									responds. Running as a Chrome Extension bypasses these
									restrictions entirely.
								</div>
							</div>
						)}

						{/* MAIN SCAN RESULTS OR BLANK SLATE */}
						<div className="flex-1 flex flex-col overflow-hidden min-h-[300px]">
							{scanState === "idle" ? (
								<div className="flex-1 flex flex-col items-center justify-center py-20 bg-gray-50/30 dark:bg-gray-900/10 rounded-2xl border border-dashed border-gray-250 dark:border-gray-800">
									<HeartCrack className="text-blue-500 mb-3" size={48} />
									<h4 className="font-bold text-gray-800 dark:text-gray-100 text-base">
										Audit Bookmark Link Statuses
									</h4>
									<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm text-center leading-relaxed">
										Select a folder scope above and launch a health audit. We'll
										check HTTP status codes and unreachable links.
									</p>
								</div>
							) : (
								<div className="flex-1 flex flex-col overflow-hidden space-y-4">
									{/* SCAN RESULTS SUB-TABS */}
									<div className="flex flex-wrap gap-2 border-b border-gray-250 dark:border-gray-800 pb-2 shrink-0">
										<button
											type="button"
											onClick={() => setHealthFilterTab("dead")}
											className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all border ${
												healthFilterTab === "dead"
													? "bg-red-50 text-red-750 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-900/40 shadow-sm font-bold"
													: "bg-white dark:bg-gray-900 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-255 border-gray-200 dark:border-gray-800"
											}`}
										>
											Offline / Dead ({scanSummary.dead})
										</button>
										<button
											type="button"
											onClick={() => setHealthFilterTab("unhealthy")}
											className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all border ${
												healthFilterTab === "unhealthy"
													? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-250 dark:border-amber-900/40 shadow-sm font-bold"
													: "bg-white dark:bg-gray-900 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-255 border-gray-200 dark:border-gray-800"
											}`}
										>
											Unhealthy HTTP ({scanSummary.unhealthy})
										</button>
										<button
											type="button"
											onClick={() => setHealthFilterTab("ignored")}
											className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all border ${
												healthFilterTab === "ignored"
													? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700 shadow-sm font-bold"
													: "bg-white dark:bg-gray-900 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-255 border-gray-200 dark:border-gray-800"
											}`}
										>
											Ignored / Safe ({scanSummary.ignored})
										</button>
									</div>

									{/* SEARCH & BULK ACTIONS FOR SCAN */}
									<div className="flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
										<div className="relative flex-1 w-full">
											<Search
												className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
												size={14}
											/>
											<input
												type="text"
												placeholder="Search scan findings..."
												value={healthSearch}
												onChange={(e) => setHealthSearch(e.target.value)}
												className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white text-xs outline-none focus:ring-1 focus:ring-blue-500"
											/>
										</div>

										<div className="flex items-center gap-2 shrink-0">
											{healthFilterTab !== "ignored" &&
												filteredHealthList.length > 0 && (
													<button
														type="button"
														onClick={handleBulkDeleteDead}
														className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.8 rounded-xl font-semibold transition-all shadow flex items-center gap-1.5 cursor-pointer"
													>
														<Trash size={13} />
														Bulk Delete{" "}
														{healthFilterTab === "dead" ? "Dead" : "Unhealthy"}{" "}
														({filteredHealthList.length})
													</button>
												)}
										</div>
									</div>

									{/* RESULTS SCROLL AREA */}
									<div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-12">
										{filteredHealthList.length === 0 ? (
											<div className="flex flex-col items-center justify-center py-16 bg-gray-50/20 dark:bg-gray-900/5 rounded-2xl border border-dashed border-gray-250 dark:border-gray-850">
												<ShieldCheck
													className="text-emerald-500 mb-2"
													size={40}
												/>
												<h5 className="font-bold text-gray-800 dark:text-gray-100 text-sm">
													{healthFilterTab === "dead"
														? "No Offline / Dead Links"
														: healthFilterTab === "unhealthy"
															? "No Unhealthy Links Detected"
															: "No Ignored Links"}
												</h5>
												<p className="text-xs text-gray-500 mt-0.5">
													{healthFilterTab === "dead"
														? "All checked sites responded successfully."
														: healthFilterTab === "unhealthy"
															? "No status code errors (4xx or 5xx) found."
															: "You haven't marked any broken links as ignored."}
												</p>
											</div>
										) : (
											filteredHealthList.map((bm) => {
												const isEditing = editingBookmarkId === bm.id;
												const isRechecking = !!recheckingIds[bm.id];
												const isOffline =
													bm.result?.status === 0 || bm.result?.status === 408;
												const isIgnored = bm.ignoredDead;

												let cardStyles =
													"border-red-100 dark:border-red-950/40";
												let badgeStyles =
													"bg-red-50 text-red-750 dark:bg-red-950/50 dark:text-red-400 border-red-150 dark:border-red-900/30";

												if (isIgnored) {
													cardStyles =
														"border-gray-200 dark:border-gray-800 opacity-75";
													badgeStyles =
														"bg-gray-50 text-gray-655 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700";
												} else if (!isOffline) {
													cardStyles =
														"border-amber-100 dark:border-amber-950/40";
													badgeStyles =
														"bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-150 dark:border-amber-900/30";
												}

												return (
													<div
														key={bm.id}
														className={`bg-white dark:bg-gray-900 border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${cardStyles}`}
													>
														{isEditing ? (
															<div className="flex-1 space-y-2.5">
																<input
																	type="text"
																	value={editTitle}
																	onChange={(e) => setEditTitle(e.target.value)}
																	placeholder="Bookmark title..."
																	className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs dark:text-white"
																/>
																<input
																	type="text"
																	value={editUrl}
																	onChange={(e) => setEditUrl(e.target.value)}
																	placeholder="Bookmark URL..."
																	className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs dark:text-white font-mono"
																/>
																<div className="flex justify-end gap-2 text-xs">
																	<button
																		type="button"
																		onClick={() => setEditingBookmarkId(null)}
																		className="text-gray-400 font-semibold px-2 py-1"
																	>
																		Cancel
																	</button>
																	<button
																		type="button"
																		onClick={() => handleSaveEdit(bm.id)}
																		className="bg-emerald-600 text-white font-bold px-3 py-1 rounded-lg hover:bg-emerald-700"
																	>
																		Save
																	</button>
																</div>
															</div>
														) : (
															<div className="flex-1 min-w-0">
																<div className="flex items-center gap-2 flex-wrap mb-1">
																	<span
																		className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${badgeStyles}`}
																	>
																		{bm.result?.message ?? "Broken Link"}
																	</span>
																	<h4 className="font-bold text-gray-950 dark:text-white truncate text-xs">
																		{bm.title}
																	</h4>
																</div>
																<a
																	href={bm.url}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="font-mono text-[10.5px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline break-all block"
																>
																	{bm.url}
																</a>
																<p className="text-[10px] text-gray-400 mt-1">
																	Folder: {getFolderPathName(bm.folderId)}
																</p>
															</div>
														)}

														{!isEditing && (
															<div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
																{/* Open Link Manually */}
																<a
																	href={bm.url}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="p-1.8 bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-500 text-gray-500 dark:text-gray-400 cursor-pointer flex items-center justify-center"
																	title="Open Link Manually"
																>
																	<ExternalLink size={12} />
																</a>

																{/* Recheck link manually */}
																<button
																	type="button"
																	onClick={() => handleRecheckLink(bm)}
																	disabled={isRechecking}
																	className="p-1.8 bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-500 text-gray-500 dark:text-gray-400 cursor-pointer flex items-center justify-center disabled:opacity-50"
																	title="Recheck Link Status"
																>
																	<RefreshCw
																		size={12}
																		className={
																			isRechecking
																				? "animate-spin text-blue-500"
																				: ""
																		}
																	/>
																</button>

																{/* Ignore button */}
																<button
																	type="button"
																	onClick={() =>
																		handleIgnoreLink(bm.id, !!bm.ignoredDead)
																	}
																	className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all ${
																		bm.ignoredDead
																			? "bg-gray-150 border-gray-300 text-gray-700 hover:bg-gray-200"
																			: "bg-white dark:bg-gray-800 border-gray-250 dark:border-gray-700 hover:bg-gray-50 text-gray-650 dark:text-gray-300"
																	}`}
																>
																	<Check size={11} />
																	{bm.ignoredDead ? "Unignore" : "Ignore"}
																</button>

																{/* Edit button */}
																<button
																	type="button"
																	onClick={() => handleStartEdit(bm)}
																	className="p-1.8 bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-500 text-gray-500 dark:text-gray-400 cursor-pointer"
																	title="Edit Link"
																>
																	<Edit3 size={12} />
																</button>

																{/* Delete button */}
																<button
																	type="button"
																	onClick={() =>
																		handleDeleteDeadBookmark(bm.id)
																	}
																	className="p-1.8 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900/30 cursor-pointer"
																	title="Delete Bookmark"
																>
																	<Trash size={12} />
																</button>
															</div>
														)}
													</div>
												);
											})
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
