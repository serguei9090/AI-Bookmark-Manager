import {
	AlertCircle,
	ExternalLink,
	Folder as FolderIcon,
	Globe,
	Lock,
	PlusSquare,
	Search,
	Sparkles,
	StopCircle,
	Trash,
	Unlock,
} from "lucide-react";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { summarizeBookmark } from "../services/aiService";
import { useAppContext } from "../store";
import type { Bookmark } from "../types";

export function BookmarksView() {
	const {
		bookmarks,
		folders,
		updateBookmark,
		deleteBookmark,
		addBookmark,
		settings,
		triggerAutoOrganize,
	} = useAppContext();
	const [search, setSearch] = useState("");
	const [selectedFolderFilter, setSelectedFolderFilter] =
		useState<string>("all");
	const [summarizingId, setSummarizingId] = useState<string | null>(null);

	// Bulk Summarize state
	const [isBulkSummarizing, setIsBulkSummarizing] = useState(false);
	const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
	const [showBulkConfirm, setShowBulkConfirm] = useState<{
		mode: "unsummarized" | "all";
	} | null>(null);
	const bulkAbortRef = useRef(false);

	// Tag editing state
	const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
	const [tagInputValue, setTagInputValue] = useState("");

	// Manual Add state
	const [isAdding, setIsAdding] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [newUrl, setNewUrl] = useState("");
	const [newFolderId, setNewFolderId] = useState<string>("none");
	const [newTagsString, setNewTagsString] = useState("");

	// Auto-extract domain to get professional favicon
	const getFaviconUrl = (urlStr: string) => {
		try {
			const url = new URL(urlStr);
			return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
		} catch {
			return "";
		}
	};

	const parseDomainName = (urlStr: string) => {
		try {
			const url = new URL(urlStr);
			return url.hostname.replace("www.", "");
		} catch {
			return "Web Link";
		}
	};

	// Bookmark Metrics
	const metrics = useMemo(() => {
		const total = bookmarks.length;
		const noFolder = bookmarks.filter((b) => b.folderId === null).length;
		const locked = bookmarks.filter((b) => b.manuallyAssigned).length;
		const summarized = bookmarks.filter((b) => b.summary !== "").length;
		return { total, noFolder, locked, summarized };
	}, [bookmarks]);

	// Handle manual addition
	const handleAddNew = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newUrl) return;

		let validatedUrl = newUrl.trim();
		if (!/^https?:\/\//i.test(validatedUrl)) {
			validatedUrl = `https://${validatedUrl}`;
		}

		const tags = newTagsString
			? newTagsString
					.split(",")
					.map((t) => t.trim().toLowerCase())
					.filter((t) => t.length > 0)
			: [];

		const newBookmark: Bookmark = {
			id: crypto.randomUUID(),
			title: newTitle.trim() || parseDomainName(validatedUrl),
			url: validatedUrl,
			folderId: newFolderId === "none" ? null : newFolderId,
			tags,
			summary: "",
			dateAdded: Date.now(),
			manuallyAssigned: false,
		};

		addBookmark(newBookmark);
		setIsAdding(false);
		setNewTitle("");
		setNewUrl("");
		setNewFolderId("none");
		setNewTagsString("");
	};

	// Run AI summaries using the central AI service
	const handleAISummarize = async (bookmark: Bookmark) => {
		setSummarizingId(bookmark.id);
		try {
			const data = await summarizeBookmark(bookmark, settings);
			const newTags =
				Array.isArray(data.tags) && data.tags.length > 0
					? Array.from(new Set(data.tags))
					: ["ai-generated"];

			updateBookmark(bookmark.id, {
				summary: data.summary || "Summary generated successfully.",
				tags: newTags,
			});
		} catch (e) {
			console.error(e);
			const errMsg = e instanceof Error ? e.message : "connection failed";
			updateBookmark(bookmark.id, {
				summary: `Failsafe Summary for ${bookmark.title}: Expert documentation and reference resource for programmers. (Error: ${errMsg})`,
				tags: ["failsafe", "ai"],
			});
		} finally {
			setSummarizingId(null);
		}
	};

	// Bulk Summarize logic
	const handleBulkSummarize = async (mode: "unsummarized" | "all") => {
		setIsBulkSummarizing(true);
		bulkAbortRef.current = false;

		// Filter bookmarks based on mode
		const targetBookmarks = bookmarks.filter((b) => {
			if (mode === "unsummarized") {
				return b.summary === "";
			}
			return true; // all
		});

		const total = targetBookmarks.length;
		setBulkProgress({ done: 0, total });
		setShowBulkConfirm(null);

		if (total === 0) {
			setIsBulkSummarizing(false);
			return;
		}

		const batchSize = 3;
		let doneCount = 0;

		for (let i = 0; i < total; i += batchSize) {
			if (bulkAbortRef.current) {
				break;
			}

			const batch = targetBookmarks.slice(i, i + batchSize);

			await Promise.all(
				batch.map(async (bm) => {
					if (bulkAbortRef.current) return;
					try {
						const data = await summarizeBookmark(bm, settings);
						const newTags =
							Array.isArray(data.tags) && data.tags.length > 0
								? Array.from(new Set(data.tags))
								: ["ai-generated"];

						updateBookmark(bm.id, {
							summary: data.summary || "Summary generated successfully.",
							tags: newTags,
						});
					} catch (e) {
						console.error(`Bulk summarize failed for ${bm.title}:`, e);
						const errMsg = e instanceof Error ? e.message : "connection failed";
						updateBookmark(bm.id, {
							summary: `Failsafe Summary for ${bm.title}: expert reference. (Error: ${errMsg})`,
							tags: ["failsafe", "ai"],
						});
					}
					doneCount++;
					setBulkProgress((prev) => ({ ...prev, done: doneCount }));
				}),
			);
		}

		setIsBulkSummarizing(false);
		setShowBulkConfirm(null);
	};

	const stopBulkSummarize = () => {
		bulkAbortRef.current = true;
		setIsBulkSummarizing(false);
	};

	const filteredBookmarks = useMemo(() => {
		return bookmarks.filter((b) => {
			// search
			const matchesSearch =
				b.title.toLowerCase().includes(search.toLowerCase()) ||
				b.url.toLowerCase().includes(search.toLowerCase()) ||
				b.summary.toLowerCase().includes(search.toLowerCase()) ||
				b.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

			// folder filter
			if (selectedFolderFilter === "all") return matchesSearch;
			if (selectedFolderFilter === "uncategorized")
				return matchesSearch && !b.folderId;
			return matchesSearch && b.folderId === selectedFolderFilter;
		});
	}, [bookmarks, search, selectedFolderFilter]);

	return (
		<div className="h-full flex flex-col space-y-6">
			{/* HEADER SUMMARY SECTION */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h2 className="text-3xl font-bold dark:text-white tracking-tight">
						Bookmarks Manager
					</h2>
					<p className="text-gray-500 dark:text-gray-400">
						Add, organize, and summarize bookmarks with AI-powered insight.
					</p>
				</div>
				<button
					type="button"
					onClick={() => setIsAdding(!isAdding)}
					className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 text-sm"
				>
					<PlusSquare size={18} />
					{isAdding ? "Close Drawer" : "Add New Bookmark"}
				</button>
			</div>

			{/* MINI STATS CARDS */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
					<span className="text-xs font-semibold text-blue-700 dark:text-blue-400 block uppercase tracking-wider">
						Total Stored
					</span>
					<span className="text-2xl font-bold dark:text-white mt-1 block">
						{metrics.total}
					</span>
				</div>
				<div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
					<span className="text-xs font-semibold text-amber-700 dark:text-amber-400 block uppercase tracking-wider">
						No Folder
					</span>
					<span className="text-2xl font-bold dark:text-white mt-1 block">
						{metrics.noFolder}
					</span>
				</div>
				<div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
					<span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 block uppercase tracking-wider">
						Locked (Manual)
					</span>
					<span className="text-2xl font-bold dark:text-white mt-1 block">
						{metrics.locked}
					</span>
				</div>
				<div className="bg-purple-50/50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
					<span className="text-xs font-semibold text-purple-700 dark:text-purple-400 block uppercase tracking-wider">
						AI Summarized Ratio
					</span>
					<span className="text-2xl font-bold dark:text-white mt-1 block">
						{metrics.total > 0
							? Math.round((metrics.summarized / metrics.total) * 100)
							: 0}
						%
					</span>
				</div>
			</div>

			{/* BULK SUMMARIZE PANEL */}
			<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<h3 className="font-bold text-base dark:text-white flex items-center gap-2">
							<Sparkles className="text-purple-500" size={18} />
							Bulk Summarize Bookmarks
						</h3>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
							Generate AI summaries and tags in sequential batches of 3.
						</p>
					</div>
					<div className="flex gap-2 flex-wrap">
						{!isBulkSummarizing ? (
							<>
								<button
									type="button"
									onClick={() => setShowBulkConfirm({ mode: "unsummarized" })}
									className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
								>
									<Sparkles size={14} />
									Summarize Unsummarized (
									{bookmarks.filter((b) => b.summary === "").length})
								</button>
								<button
									type="button"
									onClick={() => setShowBulkConfirm({ mode: "all" })}
									className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-850 dark:text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all border border-gray-250 dark:border-gray-700 active:scale-95 flex items-center gap-1.5 cursor-pointer"
								>
									<Sparkles size={14} className="text-purple-500" />
									Re-summarize All ({bookmarks.length})
								</button>
							</>
						) : (
							<button
								type="button"
								onClick={stopBulkSummarize}
								className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
							>
								<StopCircle size={14} />
								Stop Processing
							</button>
						)}
					</div>
				</div>

				{isBulkSummarizing && (
					<div className="space-y-2">
						<div className="flex justify-between text-xs font-medium dark:text-gray-300">
							<span>
								Summarizing {bulkProgress.done} of {bulkProgress.total}{" "}
								bookmarks...
							</span>
							<span>
								{bulkProgress.total > 0
									? Math.round((bulkProgress.done / bulkProgress.total) * 100)
									: 0}
								%
							</span>
						</div>
						<div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
							<div
								className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-300"
								style={{
									width: `${bulkProgress.total > 0 ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%`,
								}}
							/>
						</div>
					</div>
				)}
			</div>

			{/* BULK CONFIRMATION MODAL */}
			{showBulkConfirm && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
					<div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 max-w-md w-full shadow-2xl space-y-4">
						<h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
							<AlertCircle className="text-amber-500" size={22} />
							Confirm Bulk AI Summarize
						</h3>
						<p className="text-sm text-gray-600 dark:text-gray-350 leading-relaxed">
							{showBulkConfirm.mode === "unsummarized" ? (
								<>
									You are about to summarize{" "}
									<strong>
										{bookmarks.filter((b) => b.summary === "").length}
									</strong>{" "}
									bookmarks that do not have any summaries. Bookmarks with
									existing summaries will be skipped.
								</>
							) : (
								<>
									You are about to re-summarize{" "}
									<strong>{bookmarks.length}</strong> bookmarks. This will
									override all existing summaries and tags.
								</>
							)}
						</p>
						<div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 text-xs text-blue-800 dark:text-blue-300">
							Note: This will execute in parallel batches of 3 to respect rate
							limits. You can cancel the operation at any time.
						</div>
						<div className="flex justify-end gap-3 pt-2">
							<button
								type="button"
								onClick={() => setShowBulkConfirm(null)}
								className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium cursor-pointer"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => handleBulkSummarize(showBulkConfirm.mode)}
								className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-5 py-2 rounded-xl text-sm transition-all cursor-pointer"
							>
								Start Processing
							</button>
						</div>
					</div>
				</div>
			)}

			{/* DRAWER FOR ADDING NEW BOOKMARK */}
			{isAdding && (
				<form
					onSubmit={handleAddNew}
					className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4 animate-fade-in"
				>
					<h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
						<PlusSquare size={20} className="text-blue-500" />
						Create Web Reference Entry
					</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label
								htmlFor="new-url"
								className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2"
							>
								Web URL
							</label>
							<input
								id="new-url"
								type="text"
								required
								placeholder="https://example.com/some-docs"
								value={newUrl}
								onChange={(e) => setNewUrl(e.target.value)}
								className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white"
							/>
						</div>
						<div>
							<label
								htmlFor="new-title"
								className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2"
							>
								Friendly Title (Optional)
							</label>
							<input
								id="new-title"
								type="text"
								placeholder="Leave blank to parse from Domain"
								value={newTitle}
								onChange={(e) => setNewTitle(e.target.value)}
								className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white"
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label
								htmlFor="new-folder"
								className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2"
							>
								Destination Folder
							</label>
							<select
								id="new-folder"
								value={newFolderId}
								onChange={(e) => setNewFolderId(e.target.value)}
								className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white"
							>
								<option value="none">-- Uncategorized root directory --</option>
								{folders.map((f) => (
									<option key={f.id} value={f.id}>
										{f.name}
									</option>
								))}
							</select>
						</div>
						<div>
							<label
								htmlFor="new-tags"
								className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2"
							>
								Initial Tags (Comma separated)
							</label>
							<input
								id="new-tags"
								type="text"
								placeholder="e.g. tutorial, css, favorite"
								value={newTagsString}
								onChange={(e) => setNewTagsString(e.target.value)}
								className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white"
							/>
						</div>
					</div>

					<div className="flex justify-end gap-3 pt-2">
						<button
							type="button"
							onClick={() => setIsAdding(false)}
							className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
						>
							Cancel
						</button>
						<button
							type="submit"
							className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-sm"
						>
							Add Entry
						</button>
					</div>
				</form>
			)}

			{/* FILTER AND SEARCH CONTROLS */}
			<div className="flex flex-col sm:flex-row gap-3 items-center">
				<div className="relative flex-1 w-full">
					<Search
						className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
						size={18}
					/>
					<input
						type="text"
						placeholder="Search tags, friendly title, URLs, or summarized context..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white text-sm"
					/>
				</div>

				<select
					value={selectedFolderFilter}
					onChange={(e) => setSelectedFolderFilter(e.target.value)}
					className="w-full sm:w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
				>
					<option value="all">📁 All Folders</option>
					<option value="uncategorized">📂 Uncategorized</option>
					<option divider="true" disabled>
						──────────
					</option>
					{folders.map((f) => (
						<option key={f.id} value={f.id}>
							{f.name}
						</option>
					))}
				</select>
			</div>

			{/* CARDS LISTING GRID */}
			<div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[350px]">
				{filteredBookmarks.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 dark:bg-gray-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
						<Globe
							className="text-gray-300 dark:text-gray-700 mb-3"
							size={40}
						/>
						<h4 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
							No bookmarks displayable
						</h4>
						<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
							Try adjusting your search criteria or directory filter.
						</p>
					</div>
				) : (
					filteredBookmarks.map((bm) => {
						const hasSummary = bm.summary && bm.summary.trim().length > 0;
						return (
							<div
								key={bm.id}
								className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-900/50 hover:shadow-md transition-all group duration-300 relative"
							>
								<div className="flex items-start gap-4">
									{/* GOOGLE FAVICON API WITH FALLBACK */}
									<div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-800 flex items-center justify-center flex-shrink-0 shadow-sm">
										{getFaviconUrl(bm.url) ? (
											<img
												src={getFaviconUrl(bm.url)}
												alt=""
												onError={(e) => {
													(e.target as HTMLImageElement).style.display = "none";
												}}
												className="w-6 h-6 object-contain"
												referrerPolicy="no-referrer"
											/>
										) : (
											<Globe size={18} className="text-gray-400" />
										)}
									</div>

									<div className="flex-1 min-w-0 pr-4">
										<div className="flex items-center gap-2 flex-wrap">
											<a
												href={bm.url}
												target="_blank"
												rel="noreferrer"
												className="text-base font-semibold text-gray-900 dark:text-white dark:hover:text-blue-400 hover:text-blue-600 truncate transition-colors flex items-center gap-1.5"
											>
												{bm.title}
												<ExternalLink
													size={14}
													className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400"
												/>
											</a>
											{(() => {
												const effectiveFolderId =
													settings.monitoredFolderId ||
													folders.find((f) => f.name.toLowerCase() === "tosort")
														?.id ||
													"";
												const isFailedOrUnorganized =
													bm.aiFailed ||
													(settings.autoOrganizeEnabled &&
														effectiveFolderId !== "" &&
														bm.folderId === effectiveFolderId &&
														!bm.summary);
												if (!isFailedOrUnorganized) return null;
												return (
													<button
														type="button"
														className="text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/30 px-1.5 py-0.5 rounded cursor-pointer transition-all active:scale-95 shrink-0 flex items-center gap-1 ml-1.5"
														title="AI Auto-Organize Failed. Click to retry."
														onClick={(e) => {
															e.preventDefault();
															e.stopPropagation();
															triggerAutoOrganize(
																bm.id,
																bm.title,
																bm.url,
																bm.folderId,
																true,
															);
														}}
													>
														<AlertCircle size={12} className="text-red-500" />
														<span>Retry</span>
													</button>
												);
											})()}
										</div>

										<p className="text-xs text-gray-600 dark:text-gray-300 font-mono mt-1 break-all select-all flex items-center gap-1">
											{parseDomainName(bm.url)}
										</p>

										{/* FOLDER AND TAG CHIPS */}
										<div className="flex flex-wrap items-center gap-2 mt-3">
											<span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
												<FolderIcon size={11} />
												{folders.find((f) => f.id === bm.folderId)?.name ||
													"Root / Uncategorized"}
											</span>
											{bm.tags.map((tag) => (
												<span
													key={tag}
													className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md transition-colors group/tag relative"
												>
													<button
														type="button"
														onClick={() => setSearch(tag)}
														className="cursor-pointer hover:underline bg-transparent border-0 p-0 text-inherit font-inherit text-[11px] font-semibold text-gray-650 dark:text-gray-300 inline"
													>
														#{tag}
													</button>
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															const newTags = bm.tags.filter((t) => t !== tag);
															updateBookmark(bm.id, { tags: newTags });
														}}
														className="opacity-0 group-hover/tag:opacity-100 text-gray-400 hover:text-red-500 transition-all ml-1 font-bold text-xs cursor-pointer focus:opacity-100"
														title={`Remove tag #${tag}`}
													>
														×
													</button>
												</span>
											))}

											{editingTagsId === bm.id ? (
												<form
													onSubmit={(e) => {
														e.preventDefault();
														const normalized = tagInputValue
															.trim()
															.toLowerCase()
															.replace(/\s+/g, "-");
														if (normalized && !bm.tags.includes(normalized)) {
															updateBookmark(bm.id, {
																tags: [...bm.tags, normalized],
															});
														}
														setEditingTagsId(null);
														setTagInputValue("");
													}}
													className="inline-flex items-center"
												>
													<input
														type="text"
														placeholder="Add tag..."
														value={tagInputValue}
														onChange={(e) => setTagInputValue(e.target.value)}
														onKeyDown={(e) => {
															if (e.key === "Escape") {
																setEditingTagsId(null);
																setTagInputValue("");
															}
														}}
														onBlur={() => {
															const normalized = tagInputValue
																.trim()
																.toLowerCase()
																.replace(/\s+/g, "-");
															if (normalized && !bm.tags.includes(normalized)) {
																updateBookmark(bm.id, {
																	tags: [...bm.tags, normalized],
																});
															}
															setEditingTagsId(null);
															setTagInputValue("");
														}}
														className="text-[10px] px-2 py-0.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white outline-none w-20 focus:ring-1 focus:ring-blue-500"
													/>
												</form>
											) : (
												<button
													type="button"
													onClick={() => {
														setEditingTagsId(bm.id);
														setTagInputValue("");
													}}
													className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
												>
													＋ Add tag
												</button>
											)}
										</div>

										{/* DYNAMIC SUMMARY DISPLAY */}
										{hasSummary ? (
											<div className="mt-3 text-sm text-gray-700 dark:text-gray-200 bg-gray-50/50 dark:bg-gray-950 p-3 rounded-xl border border-gray-200 dark:border-gray-800 leading-relaxed">
												<span className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1">
													<Sparkles size={11} /> AI Generated Summary & Insights
												</span>
												{bm.summary}
											</div>
										) : (
											<p className="mt-3 text-xs italic text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
												<AlertCircle size={13} /> Summary not yet requested. Use
												the AI engine to generate detailed insights.
											</p>
										)}
									</div>

									{/* ACTION CONTROLS */}
									<div className="flex flex-col sm:flex-row gap-2 self-start flex-shrink-0">
										<button
											type="button"
											onClick={() =>
												updateBookmark(bm.id, {
													manuallyAssigned: !bm.manuallyAssigned,
												})
											}
											className={`p-1.5 rounded-xl transition-all border cursor-pointer ${
												bm.manuallyAssigned
													? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400"
													: "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-650"
											}`}
											title={
												bm.manuallyAssigned
													? "Locked from AI auto-sort (Click to unlock)"
													: "Unlocked (Click to lock from AI)"
											}
										>
											{bm.manuallyAssigned ? (
												<Lock size={14} />
											) : (
												<Unlock size={14} />
											)}
										</button>
										<button
											type="button"
											onClick={() => handleAISummarize(bm)}
											disabled={summarizingId === bm.id}
											className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
												hasSummary
													? "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
													: "bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border-purple-200/50 dark:border-purple-800/40 text-purple-700 dark:text-purple-300"
											}`}
											title="Generate summaries using activated large language model"
										>
											<Sparkles
												size={14}
												className={`shrink-0 ${
													summarizingId === bm.id
														? "animate-spin"
														: hasSummary
															? "text-emerald-500"
															: "text-purple-500"
												}`}
											/>
											{summarizingId === bm.id
												? "Processing..."
												: hasSummary
													? "Re-summarize"
													: "Summarize"}
										</button>
										<button
											type="button"
											onClick={() => {
												if (
													globalThis.confirm(
														`Are you sure you want to delete the bookmark "${bm.title}"?`,
													)
												) {
													deleteBookmark(bm.id);
												}
											}}
											className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
											title="Delete bookmark"
										>
											<Trash size={15} />
										</button>
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
