import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import type { Bookmark, Folder, HistoryEntry, Settings } from "./types";

// Initial Data
const initialBookmarks: Bookmark[] = [];

const initialFolders: Folder[] = [];

const initialSettings: Settings = {
	provider: "gemini",
	model: "gemini-3.5-flash",
	customUrl: "",
	apiKey: "",
	systemPrompt: "You are an intelligent bookmark manager assistant.",
	darkMode: true,
	temperature: 0.7,
	maxTokens: 0,
	viewMode: "dashboard",
	geminiUrl: "",
	geminiApiKey: "",
	openaiUrl: "",
	openaiApiKey: "",
	ollamaUrl: "",
	ollamaApiKey: "",
	lmstudioUrl: "",
	lmstudioApiKey: "",
	customApiKey: "",
	maxHistoryEntries: 10,
};

// Check if running inside a Chrome Extension with Bookmarks API
const isExtension =
	typeof chrome !== "undefined" && chrome.bookmarks !== undefined;

const ENCRYPTION_KEY = "nano_banana_salt_2026";

function encryptApiKey(text: string): string {
	if (!text) return "";
	let result = "";
	for (let i = 0; i < text.length; i++) {
		const charCode = text.charCodeAt(i);
		const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
		result += String.fromCharCode(charCode ^ keyChar);
	}
	return btoa(unescape(encodeURIComponent(result)));
}

function decryptApiKey(cipherText: string): string {
	if (!cipherText) return "";
	try {
		const decoded = decodeURIComponent(escape(atob(cipherText)));
		let result = "";
		for (let i = 0; i < decoded.length; i++) {
			const charCode = decoded.charCodeAt(i);
			const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
			result += String.fromCharCode(charCode ^ keyChar);
		}
		return result;
	} catch (_e) {
		return cipherText;
	}
}

function encryptSettings(s: Settings): Settings {
	return {
		...s,
		geminiApiKey: encryptApiKey(s.geminiApiKey || ""),
		openaiApiKey: encryptApiKey(s.openaiApiKey || ""),
		ollamaApiKey: encryptApiKey(s.ollamaApiKey || ""),
		lmstudioApiKey: encryptApiKey(s.lmstudioApiKey || ""),
		customApiKey: encryptApiKey(s.customApiKey || ""),
		apiKey: encryptApiKey(s.apiKey || ""),
	};
}

function decryptSettings(s: Settings): Settings {
	return {
		...s,
		geminiApiKey: decryptApiKey(s.geminiApiKey || ""),
		openaiApiKey: decryptApiKey(s.openaiApiKey || ""),
		ollamaApiKey: decryptApiKey(s.ollamaApiKey || ""),
		lmstudioApiKey: decryptApiKey(s.lmstudioApiKey || ""),
		customApiKey: decryptApiKey(s.customApiKey || ""),
		apiKey: decryptApiKey(s.apiKey || ""),
	};
}

// Chrome-protected root bookmark node IDs — never modify these directly
const CHROME_ROOT_IDS = new Set(["0", "1", "2", "3"]);

/** Safe wrapper: skip chrome.bookmarks.update on protected root nodes */
const safeBmUpdate = (
	id: string,
	changes: { title?: string; url?: string },
	cb: () => void,
) => {
	if (CHROME_ROOT_IDS.has(id)) {
		cb();
		return;
	}
	chrome.bookmarks.update(id, changes, () => cb());
};

/** Safe wrapper: skip chrome.bookmarks.move on protected root nodes */
const safeBmMove = (id: string, dest: { parentId: string }, cb: () => void) => {
	if (CHROME_ROOT_IDS.has(id)) {
		cb();
		return;
	}
	chrome.bookmarks.move(id, dest, () => cb());
};

/** Safe wrapper: skip chrome.bookmarks.remove on protected root nodes */
const safeBmRemove = (id: string, cb: () => void) => {
	if (CHROME_ROOT_IDS.has(id)) {
		cb();
		return;
	}
	chrome.bookmarks.remove(id, () => cb());
};

/** Safe wrapper: skip chrome.bookmarks.removeTree on protected root nodes */
const safeBmRemoveTree = (id: string, cb: () => void) => {
	if (CHROME_ROOT_IDS.has(id)) {
		cb();
		return;
	}
	chrome.bookmarks.removeTree(id, () => cb());
};

/** Normalize a parentId: map null / "0" / undefined -> "1" (Bookmarks Bar) */
const safeParentId = (id: string | null | undefined): string =>
	!id || (CHROME_ROOT_IDS.has(id) && id !== "1" && id !== "2" && id !== "3")
		? "1"
		: id;

// Utility functions for storage persistence
const getStorageItem = async <T = unknown>(key: string): Promise<T | null> => {
	if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
		return new Promise((resolve) => {
			chrome.storage.local.get([key], (result) => {
				resolve((result[key] as T) ?? null);
			});
		});
	}
	const item = localStorage.getItem(key);
	return item ? (JSON.parse(item) as T) : null;
};

const setStorageItem = async (key: string, value: unknown): Promise<void> => {
	if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
		return new Promise((resolve) => {
			chrome.storage.local.set({ [key]: value }, () => {
				resolve();
			});
		});
	}
	localStorage.setItem(key, JSON.stringify(value));
};

type AppContextType = {
	bookmarks: Bookmark[];
	folders: Folder[];
	aiFolders: Folder[];
	settings: Settings;
	history: HistoryEntry[];
	setBookmarks: React.Dispatch<React.SetStateAction<Bookmark[]>>;
	setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
	setAiFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
	setSettings: React.Dispatch<React.SetStateAction<Settings>>;
	updateBookmark: (id: string, updates: Partial<Bookmark>) => void;
	deleteBookmark: (id: string) => void;
	addBookmark: (bookmark: Bookmark) => void;
	batchUpdateBookmarks: (newBookmarks: Bookmark[], description: string) => void;
	bulkDeleteBookmarks: (ids: string[], description: string) => void;
	updateFolder: (id: string, updates: Partial<Folder>) => void;
	addFolder: (folder: Omit<Folder, "id"> & { id?: string }) => Promise<string>;
	deleteFolder: (id: string) => void;
	bulkDeleteFolders: (ids: string[], description: string) => void;
	addAiFolder: (folder: Folder) => void;
	updateAiFolder: (id: string, updates: Partial<Folder>) => void;
	deleteAiFolder: (id: string) => void;
	reloadAiFoldersFromReal: () => void;
	revertToState: (id: string) => void;
	clearHistory: () => void;
	injectPresetData: (name: string, bms: Bookmark[], fols: Folder[]) => void;
	clearDatabase: () => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
		if (isExtension) {
			return [];
		}
		const saved = localStorage.getItem("bm_bookmarks");
		return saved ? JSON.parse(saved) : initialBookmarks;
	});

	const [folders, setFolders] = useState<Folder[]>(() => {
		if (isExtension) {
			return [];
		}
		const saved = localStorage.getItem("bm_folders");
		return saved ? JSON.parse(saved) : initialFolders;
	});

	const [aiFolders, setAiFolders] = useState<Folder[]>([]);

	const [settings, setSettings] = useState<Settings>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("bm_settings");
			if (saved) {
				try {
					const parsed = JSON.parse(saved);
					return decryptSettings({ ...initialSettings, ...parsed });
				} catch (_e) {
					return initialSettings;
				}
			}
		}
		return initialSettings;
	});

	const isReconcilingRef = React.useRef(false);

	const [history, setHistory] = useState<HistoryEntry[]>(() => {
		const saved = localStorage.getItem("bm_history");
		return saved ? JSON.parse(saved) : [];
	});

	const initializeHistoryIfEmpty = useCallback(
		(bms: Bookmark[], fols: Folder[]) => {
			setHistory((prev) => {
				if (prev.length === 0) {
					const entry: HistoryEntry = {
						id: crypto.randomUUID(),
						bookmarks: bms,
						folders: fols,
						timestamp: Date.now(),
						description: "System initialized (Startup)",
					};
					return [entry];
				}
				return prev;
			});
		},
		[],
	);

	// Async data loader for extension / metadata merge
	const loadData = useCallback(async () => {
		if (isExtension) {
			try {
				const bookmarksMeta =
					(await getStorageItem("bm_metadata_bookmarks")) || {};
				const foldersMeta = (await getStorageItem("bm_metadata_folders")) || {};

				chrome.bookmarks.getTree((tree) => {
					const foldersList: Folder[] = [];
					const bookmarksList: Bookmark[] = [];

					const traverse = (node: chrome.bookmarks.BookmarkTreeNode) => {
						const isRoot = node.id === "0" || !node.parentId;
						if (!isRoot) {
							const isFolder = !node.url;
							const parentIdMapped =
								node.parentId === "0" || !node.parentId ? null : node.parentId;

							if (isFolder) {
								const meta = foldersMeta[node.id] || {};
								foldersList.push({
									id: node.id,
									parentId: parentIdMapped,
									name: node.title,
									promptContext: meta.promptContext || "",
								});
							} else {
								const meta = bookmarksMeta[node.id] || {};
								bookmarksList.push({
									id: node.id,
									title: node.title,
									url: node.url || "",
									folderId: parentIdMapped,
									tags: meta.tags || [],
									summary: meta.summary || "",
									dateAdded: node.dateAdded || Date.now(),
									manuallyAssigned: meta.manuallyAssigned || false,
									ignoredDead: meta.ignoredDead || false,
								});
							}
						}

						if (node.children) {
							for (const child of node.children) {
								traverse(child);
							}
						}
					};

					if (tree && tree.length > 0) {
						traverse(tree[0]);
					}

					setBookmarks(bookmarksList);
					setFolders(foldersList);
					initializeHistoryIfEmpty(bookmarksList, foldersList);

					getStorageItem("bm_blueprint_folders").then((savedAiFolders) => {
						if (savedAiFolders) {
							setAiFolders(savedAiFolders);
						} else {
							const initialAiFolders = foldersList.map((f) => ({ ...f }));
							setAiFolders(initialAiFolders);
							setStorageItem("bm_blueprint_folders", initialAiFolders);
						}
					});
				});
			} catch (err) {
				console.error("Error loading bookmarks from Chrome API", err);
			}
		} else {
			// Sandbox fallback loading
			const savedBookmarks = localStorage.getItem("bm_bookmarks");
			const savedFolders = localStorage.getItem("bm_folders");

			let bookmarksList: Bookmark[] = savedBookmarks
				? JSON.parse(savedBookmarks)
				: [];
			let foldersList: Folder[] = savedFolders ? JSON.parse(savedFolders) : [];

			const bookmarksMeta =
				(await getStorageItem("bm_metadata_bookmarks")) || {};
			const foldersMeta = (await getStorageItem("bm_metadata_folders")) || {};

			bookmarksList = bookmarksList.map((bm) => {
				const meta = bookmarksMeta[bm.id] || {};
				return {
					...bm,
					tags: meta.tags || bm.tags || [],
					summary: meta.summary || bm.summary || "",
					manuallyAssigned:
						meta.manuallyAssigned || bm.manuallyAssigned || false,
					ignoredDead: meta.ignoredDead || bm.ignoredDead || false,
				};
			});

			foldersList = foldersList.map((fol) => {
				const meta = foldersMeta[fol.id] || {};
				return {
					...fol,
					promptContext: meta.promptContext || fol.promptContext || "",
				};
			});

			setBookmarks(bookmarksList);
			setFolders(foldersList);
			initializeHistoryIfEmpty(bookmarksList, foldersList);

			const savedAiFolders = await getStorageItem("bm_blueprint_folders");
			if (savedAiFolders) {
				setAiFolders(savedAiFolders);
			} else {
				const initialAiFolders = foldersList.map((f) => ({ ...f }));
				setAiFolders(initialAiFolders);
				await setStorageItem("bm_blueprint_folders", initialAiFolders);
			}
		}
	}, [initializeHistoryIfEmpty]);

	// Sync event listeners for external Chrome Bookmark updates
	useEffect(() => {
		loadData();

		if (isExtension) {
			const handleCreated = () => {
				if (!isReconcilingRef.current) loadData();
			};
			const handleRemoved = () => {
				if (!isReconcilingRef.current) loadData();
			};
			const handleChanged = () => {
				if (!isReconcilingRef.current) loadData();
			};
			const handleMoved = () => {
				if (!isReconcilingRef.current) loadData();
			};

			chrome.bookmarks.onCreated.addListener(handleCreated);
			chrome.bookmarks.onRemoved.addListener(handleRemoved);
			chrome.bookmarks.onChanged.addListener(handleChanged);
			chrome.bookmarks.onMoved.addListener(handleMoved);

			return () => {
				chrome.bookmarks.onCreated.removeListener(handleCreated);
				chrome.bookmarks.onRemoved.removeListener(handleRemoved);
				chrome.bookmarks.onChanged.removeListener(handleChanged);
				chrome.bookmarks.onMoved.removeListener(handleMoved);
			};
		}
	}, [loadData]);

	// Save updates in sandbox mode to localStorage
	useEffect(() => {
		if (!isExtension) {
			localStorage.setItem("bm_bookmarks", JSON.stringify(bookmarks));
		}
	}, [bookmarks]);

	useEffect(() => {
		if (!isExtension) {
			localStorage.setItem("bm_folders", JSON.stringify(folders));
		}
	}, [folders]);

	// Load settings and history asynchronously on mount for both extension and web
	useEffect(() => {
		getStorageItem<Settings>("bm_settings").then((savedSettings) => {
			if (savedSettings) {
				setSettings(decryptSettings(savedSettings));
			}
		});
		getStorageItem<HistoryEntry[]>("bm_history").then((savedHistory) => {
			if (savedHistory) {
				setHistory(savedHistory);
			}
		});
	}, []);

	useEffect(() => {
		const encrypted = encryptSettings(settings);
		setStorageItem("bm_settings", encrypted);

		if (settings.darkMode) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}, [settings]);

	useEffect(() => {
		setStorageItem("bm_history", history);
	}, [history]);

	const pushHistory = (
		description: string,
		currentBookmarks: Bookmark[],
		currentFolders: Folder[],
	) => {
		setHistory((prev) => {
			const entry: HistoryEntry = {
				id: crypto.randomUUID(),
				bookmarks: currentBookmarks,
				folders: currentFolders,
				timestamp: Date.now(),
				description,
			};
			return [entry, ...prev].slice(0, settings.maxHistoryEntries || 10);
		});
	};

	const addBookmark = (bookmark: Bookmark) => {
		if (isExtension) {
			isReconcilingRef.current = true;
			const parentId = bookmark.folderId || undefined;
			chrome.bookmarks.create(
				{
					parentId,
					title: bookmark.title,
					url: bookmark.url,
				},
				(created) => {
					if (!created) {
						isReconcilingRef.current = false;
						console.error(
							"Failed to create bookmark:",
							chrome.runtime.lastError,
						);
						return;
					}
					getStorageItem("bm_metadata_bookmarks").then((currentMeta) => {
						const meta = currentMeta || {};
						meta[created.id] = {
							tags: bookmark.tags || [],
							summary: bookmark.summary || "",
							manuallyAssigned: bookmark.manuallyAssigned || false,
							ignoredDead: bookmark.ignoredDead || false,
						};
						setStorageItem("bm_metadata_bookmarks", meta).then(async () => {
							await loadData();
							pushHistory(
								`Added bookmark: ${bookmark.title}`,
								bookmarks,
								folders,
							);
							isReconcilingRef.current = false;
						});
					});
				},
			);
		} else {
			const newBookmark: Bookmark = {
				...bookmark,
				id: bookmark.id || crypto.randomUUID(),
			};
			getStorageItem("bm_metadata_bookmarks").then((currentMeta) => {
				const meta = currentMeta || {};
				meta[newBookmark.id] = {
					tags: newBookmark.tags || [],
					summary: newBookmark.summary || "",
					manuallyAssigned: newBookmark.manuallyAssigned || false,
					ignoredDead: newBookmark.ignoredDead || false,
				};
				setStorageItem("bm_metadata_bookmarks", meta).then(() => {
					pushHistory(
						`Added bookmark: ${newBookmark.title}`,
						bookmarks,
						folders,
					);
					setBookmarks((prev) => [newBookmark, ...prev]);
				});
			});
		}
	};

	const updateBookmark = (id: string, updates: Partial<Bookmark>) => {
		const bm = bookmarks.find((b) => b.id === id);
		if (!bm) return;
		pushHistory(`Updated bookmark: ${bm.title}`, bookmarks, folders);

		if (isExtension) {
			isReconcilingRef.current = true;
			const promises: Promise<unknown>[] = [];

			const title = updates.title !== undefined ? updates.title : undefined;
			const url = updates.url !== undefined ? updates.url : undefined;

			if (title !== undefined || url !== undefined) {
				promises.push(
					new Promise<void>((resolve) => {
						safeBmUpdate(id, { title, url }, resolve);
					}),
				);
			}

			if (updates.folderId !== undefined && updates.folderId !== bm.folderId) {
				const parentId = safeParentId(updates.folderId);
				promises.push(
					new Promise<void>((resolve) => {
						safeBmMove(id, { parentId }, resolve);
					}),
				);
			}

			if (
				updates.tags !== undefined ||
				updates.summary !== undefined ||
				updates.manuallyAssigned !== undefined ||
				updates.ignoredDead !== undefined
			) {
				const metadataPromise = getStorageItem("bm_metadata_bookmarks").then(
					(currentMeta) => {
						const meta = currentMeta || {};
						meta[id] = {
							tags:
								updates.tags !== undefined
									? updates.tags
									: meta[id]?.tags || [],
							summary:
								updates.summary !== undefined
									? updates.summary
									: meta[id]?.summary || "",
							manuallyAssigned:
								updates.manuallyAssigned !== undefined
									? updates.manuallyAssigned
									: meta[id]?.manuallyAssigned || false,
							ignoredDead:
								updates.ignoredDead !== undefined
									? updates.ignoredDead
									: meta[id]?.ignoredDead || false,
						};
						return setStorageItem("bm_metadata_bookmarks", meta);
					},
				);
				promises.push(metadataPromise);
			}

			Promise.all(promises)
				.then(async () => {
					await loadData();
					isReconcilingRef.current = false;
				})
				.catch((err) => {
					isReconcilingRef.current = false;
					console.error("Error updating bookmark:", err);
				});
		} else {
			getStorageItem("bm_metadata_bookmarks").then((currentMeta) => {
				const meta = currentMeta || {};
				meta[id] = {
					tags:
						updates.tags !== undefined ? updates.tags : meta[id]?.tags || [],
					summary:
						updates.summary !== undefined
							? updates.summary
							: meta[id]?.summary || "",
					manuallyAssigned:
						updates.manuallyAssigned !== undefined
							? updates.manuallyAssigned
							: meta[id]?.manuallyAssigned || false,
					ignoredDead:
						updates.ignoredDead !== undefined
							? updates.ignoredDead
							: meta[id]?.ignoredDead || false,
				};
				setStorageItem("bm_metadata_bookmarks", meta).then(() => {
					setBookmarks((prev) =>
						prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
					);
				});
			});
		}
	};

	const deleteBookmark = (id: string) => {
		const bm = bookmarks.find((b) => b.id === id);
		pushHistory(`Deleted bookmark: ${bm ? bm.title : id}`, bookmarks, folders);

		if (isExtension) {
			isReconcilingRef.current = true;
			safeBmRemove(id, () => {
				getStorageItem("bm_metadata_bookmarks").then((currentMeta) => {
					let deletePromise = Promise.resolve();
					if (currentMeta?.[id]) {
						delete currentMeta[id];
						deletePromise = setStorageItem(
							"bm_metadata_bookmarks",
							currentMeta,
						);
					}
					deletePromise
						.then(async () => {
							await loadData();
							isReconcilingRef.current = false;
						})
						.catch((err) => {
							isReconcilingRef.current = false;
							console.error("Error in deleteBookmark:", err);
						});
				});
			});
		} else {
			getStorageItem("bm_metadata_bookmarks").then((currentMeta) => {
				if (currentMeta?.[id]) {
					delete currentMeta[id];
					setStorageItem("bm_metadata_bookmarks", currentMeta);
				}
				setBookmarks((prev) => prev.filter((b) => b.id !== id));
			});
		}
	};

	const batchUpdateBookmarks = (
		newBookmarks: Bookmark[],
		description: string,
	) => {
		pushHistory(description, bookmarks, folders);
		if (isExtension) {
			isReconcilingRef.current = true;
			const promises: Promise<unknown>[] = [];

			getStorageItem("bm_metadata_bookmarks").then((currentMeta) => {
				const meta = currentMeta || {};
				newBookmarks.forEach((newBm) => {
					const oldBm = bookmarks.find((b) => b.id === newBm.id);
					if (!oldBm) return;

					if (newBm.title !== oldBm.title || newBm.url !== oldBm.url) {
						promises.push(
							new Promise<void>((resolve) => {
								safeBmUpdate(
									newBm.id,
									{ title: newBm.title, url: newBm.url },
									resolve,
								);
							}),
						);
					}
					if (newBm.folderId !== oldBm.folderId) {
						const parentId = safeParentId(newBm.folderId);
						promises.push(
							new Promise<void>((resolve) => {
								safeBmMove(newBm.id, { parentId }, resolve);
							}),
						);
					}

					meta[newBm.id] = {
						tags: newBm.tags || [],
						summary: newBm.summary || "",
						manuallyAssigned:
							newBm.manuallyAssigned !== undefined
								? newBm.manuallyAssigned
								: meta[newBm.id]?.manuallyAssigned || false,
						ignoredDead:
							newBm.ignoredDead !== undefined
								? newBm.ignoredDead
								: meta[newBm.id]?.ignoredDead || false,
					};
				});

				const storagePromise = setStorageItem("bm_metadata_bookmarks", meta);
				promises.push(storagePromise);

				Promise.all(promises)
					.then(async () => {
						await loadData();
						isReconcilingRef.current = false;
					})
					.catch((err) => {
						isReconcilingRef.current = false;
						console.error("Error in batchUpdateBookmarks:", err);
					});
			});
		} else {
			getStorageItem("bm_metadata_bookmarks").then((currentMeta) => {
				const meta = currentMeta || {};
				newBookmarks.forEach((bm) => {
					meta[bm.id] = {
						tags: bm.tags || [],
						summary: bm.summary || "",
						manuallyAssigned:
							bm.manuallyAssigned !== undefined
								? bm.manuallyAssigned
								: meta[bm.id]?.manuallyAssigned || false,
						ignoredDead:
							bm.ignoredDead !== undefined
								? bm.ignoredDead
								: meta[bm.id]?.ignoredDead || false,
					};
				});
				setStorageItem("bm_metadata_bookmarks", meta).then(() => {
					setBookmarks(newBookmarks);
				});
			});
		}
	};

	const bulkDeleteBookmarks = (ids: string[], description: string) => {
		pushHistory(description, bookmarks, folders);
		if (isExtension) {
			isReconcilingRef.current = true;
			const removePromises = ids.map((id) => {
				return new Promise<void>((resolve) => {
					safeBmRemove(id, resolve);
				});
			});

			Promise.all(removePromises).then(() => {
				getStorageItem("bm_metadata_bookmarks").then((currentMeta) => {
					if (currentMeta) {
						for (const id of ids) {
							delete currentMeta[id];
						}
					}
					const deletePromise = currentMeta
						? setStorageItem("bm_metadata_bookmarks", currentMeta)
						: Promise.resolve();

					deletePromise
						.then(async () => {
							await loadData();
							isReconcilingRef.current = false;
						})
						.catch((err) => {
							isReconcilingRef.current = false;
							console.error("Error in bulkDeleteBookmarks:", err);
						});
				});
			});
		} else {
			getStorageItem("bm_metadata_bookmarks").then((currentMeta) => {
				if (currentMeta) {
					ids.forEach((id) => {
						delete currentMeta[id];
					});
					setStorageItem("bm_metadata_bookmarks", currentMeta);
				}
				setBookmarks((prev) => prev.filter((b) => !ids.includes(b.id)));
			});
		}
	};

	const addFolder = (
		folder: Omit<Folder, "id"> & { id?: string },
	): Promise<string> => {
		return new Promise((resolve) => {
			const folderId = folder.id || crypto.randomUUID();
			if (isExtension) {
				isReconcilingRef.current = true;
				chrome.bookmarks.create(
					{
						parentId: safeParentId(folder.parentId),
						title: folder.name,
					},
					(created) => {
						if (!created) {
							isReconcilingRef.current = false;
							console.error(
								"Failed to create folder:",
								chrome.runtime.lastError,
							);
							resolve("");
							return;
						}
						getStorageItem("bm_metadata_folders").then((currentMeta) => {
							const meta = currentMeta || {};
							meta[created.id] = {
								promptContext: folder.promptContext || "",
							};
							setStorageItem("bm_metadata_folders", meta).then(async () => {
								await loadData();
								pushHistory(`Added folder: ${folder.name}`, bookmarks, folders);
								isReconcilingRef.current = false;
								resolve(created.id);
							});
						});
					},
				);
			} else {
				const newFolder: Folder = {
					parentId: folder.parentId,
					name: folder.name,
					promptContext: folder.promptContext || "",
					id: folderId,
				};
				getStorageItem("bm_metadata_folders").then((currentMeta) => {
					const meta = currentMeta || {};
					meta[newFolder.id] = {
						promptContext: newFolder.promptContext || "",
					};
					setStorageItem("bm_metadata_folders", meta).then(() => {
						pushHistory(`Added folder: ${newFolder.name}`, bookmarks, folders);
						setFolders((prev) => [...prev, newFolder]);
						resolve(newFolder.id);
					});
				});
			}
		});
	};

	const updateFolder = (id: string, updates: Partial<Folder>) => {
		const fol = folders.find((f) => f.id === id);
		if (!fol) return;
		pushHistory(`Updated folder: ${fol.name}`, bookmarks, folders);

		if (isExtension) {
			isReconcilingRef.current = true;
			const promises: Promise<unknown>[] = [];

			if (updates.name !== undefined) {
				promises.push(
					new Promise<void>((resolve) => {
						safeBmUpdate(id, { title: updates.name }, resolve);
					}),
				);
			}
			if (updates.parentId !== undefined && updates.parentId !== fol.parentId) {
				const parentId = safeParentId(updates.parentId);
				promises.push(
					new Promise<void>((resolve) => {
						safeBmMove(id, { parentId }, resolve);
					}),
				);
			}

			if (updates.promptContext !== undefined) {
				const metadataPromise = getStorageItem("bm_metadata_folders").then(
					(currentMeta) => {
						const meta = currentMeta || {};
						meta[id] = {
							promptContext: updates.promptContext || "",
						};
						return setStorageItem("bm_metadata_folders", meta);
					},
				);
				promises.push(metadataPromise);
			}

			Promise.all(promises)
				.then(async () => {
					await loadData();
					isReconcilingRef.current = false;
				})
				.catch((err) => {
					isReconcilingRef.current = false;
					console.error("Error updating folder:", err);
				});
		} else {
			getStorageItem("bm_metadata_folders").then((currentMeta) => {
				const meta = currentMeta || {};
				meta[id] = {
					promptContext:
						updates.promptContext !== undefined
							? updates.promptContext
							: meta[id]?.promptContext || "",
				};
				setStorageItem("bm_metadata_folders", meta).then(() => {
					setFolders((prev) =>
						prev.map((f) => (f.id === id ? { ...f, ...updates } : f)),
					);
				});
			});
		}
	};

	const deleteFolder = (id: string) => {
		const fol = folders.find((f) => f.id === id);
		if (!fol) return;
		pushHistory(`Deleted folder: ${fol.name}`, bookmarks, folders);

		if (isExtension) {
			isReconcilingRef.current = true;
			chrome.bookmarks.getSubTree(id, (results) => {
				if (results && results.length > 0) {
					const folderNode = results[0];
					const parentId = safeParentId(folderNode.parentId);

					const movePromises = (folderNode.children || []).map((child) => {
						return new Promise<void>((resolve) => {
							safeBmMove(child.id, { parentId }, resolve);
						});
					});

					Promise.all(movePromises).then(() => {
						safeBmRemove(id, () => {
							getStorageItem("bm_metadata_folders").then((currentMeta) => {
								let deletePromise = Promise.resolve();
								if (currentMeta?.[id]) {
									delete currentMeta[id];
									deletePromise = setStorageItem(
										"bm_metadata_folders",
										currentMeta,
									);
								}
								deletePromise
									.then(async () => {
										await loadData();
										isReconcilingRef.current = false;
									})
									.catch((err) => {
										isReconcilingRef.current = false;
										console.error("Error in deleteFolder:", err);
									});
							});
						});
					});
				} else {
					isReconcilingRef.current = false;
				}
			});
		} else {
			getStorageItem("bm_metadata_folders").then((currentMeta) => {
				if (currentMeta?.[id]) {
					delete currentMeta[id];
					setStorageItem("bm_metadata_folders", currentMeta);
				}
				// Promote child folders when parent is deleted in sandbox mode
				setFolders((prev) =>
					prev
						.filter((f) => f.id !== id)
						.map((f) =>
							f.parentId === id ? { ...f, parentId: fol.parentId } : f,
						),
				);
				setBookmarks((prev) =>
					prev.map((b) => (b.folderId === id ? { ...b, folderId: null } : b)),
				);
			});
		}
	};

	const bulkDeleteFolders = (ids: string[], description: string) => {
		pushHistory(description, bookmarks, folders);
		const emptyFolderIds = new Set(ids);
		if (isExtension) {
			isReconcilingRef.current = true;
			// Filter target folders to locate root-most folders to delete in one go
			const rootMostIds = ids.filter((id) => {
				const fol = folders.find((f) => f.id === id);
				return !fol?.parentId || !emptyFolderIds.has(fol.parentId);
			});

			const removePromises = rootMostIds.map((id) => {
				return new Promise<void>((resolve) => {
					safeBmRemoveTree(id, resolve);
				});
			});

			Promise.all(removePromises).then(() => {
				getStorageItem("bm_metadata_folders").then((currentMeta) => {
					if (currentMeta) {
						for (const id of ids) {
							delete currentMeta[id];
						}
					}
					const deletePromise = currentMeta
						? setStorageItem("bm_metadata_folders", currentMeta)
						: Promise.resolve();

					deletePromise
						.then(async () => {
							await loadData();
							isReconcilingRef.current = false;
						})
						.catch((err) => {
							isReconcilingRef.current = false;
							console.error("Error in bulkDeleteFolders:", err);
						});
				});
			});
		} else {
			getStorageItem("bm_metadata_folders").then((currentMeta) => {
				if (currentMeta) {
					ids.forEach((id) => {
						delete currentMeta[id];
					});
					setStorageItem("bm_metadata_folders", currentMeta);
				}
				setFolders((prev) => prev.filter((f) => !ids.includes(f.id)));
				setBookmarks((prev) =>
					prev.map((b) =>
						b.folderId && ids.includes(b.folderId)
							? { ...b, folderId: null }
							: b,
					),
				);
			});
		}
	};

	const revertChromeBookmarks = async (
		targetBookmarks: Bookmark[],
		targetFolders: Folder[],
	) => {
		if (!isExtension) return;

		// 1. Get current flat list of Chrome bookmarks & folders
		const getCurrentChromeTree = (): Promise<
			chrome.bookmarks.BookmarkTreeNode[]
		> => {
			return new Promise((resolve) => {
				chrome.bookmarks.getTree((tree) => {
					const list: chrome.bookmarks.BookmarkTreeNode[] = [];
					const traverse = (node: chrome.bookmarks.BookmarkTreeNode) => {
						list.push(node);
						if (node.children) {
							for (const child of node.children) traverse(child);
						}
					};
					if (tree && tree.length > 0) traverse(tree[0]);
					resolve(list);
				});
			});
		};

		const currentNodes = await getCurrentChromeTree();
		const currentFolders = currentNodes.filter((n) => !n.url && n.id !== "0");
		const currentBookmarks = currentNodes.filter((n) => !!n.url);

		const oldIdToNewId: Record<string, string> = {
			"1": "1", // Bookmarks Bar
			"2": "2", // Other Bookmarks
			"3": "3", // Mobile Bookmarks
		};

		// Helper to create folders recursively
		const ensureFolderInChrome = async (
			oldFolderId: string,
		): Promise<string> => {
			if (oldIdToNewId[oldFolderId]) {
				return oldIdToNewId[oldFolderId];
			}

			const targetFolder = targetFolders.find((f) => f.id === oldFolderId);
			if (!targetFolder) {
				return "1";
			}

			const parentId = targetFolder.parentId
				? await ensureFolderInChrome(targetFolder.parentId)
				: "1";

			// Check if folder exists
			const existing = currentFolders.find(
				(f) => f.title === targetFolder.name && f.parentId === parentId,
			);
			if (existing) {
				oldIdToNewId[oldFolderId] = existing.id;
				return existing.id;
			}

			return new Promise<string>((resolve) => {
				chrome.bookmarks.create(
					{
						parentId,
						title: targetFolder.name,
					},
					(created) => {
						oldIdToNewId[oldFolderId] = created.id;
						resolve(created.id);
					},
				);
			});
		};

		for (const f of targetFolders) {
			await ensureFolderInChrome(f.id);
		}

		const createdBookmarkIds = new Set<string>();

		for (const bm of targetBookmarks) {
			const parentId = bm.folderId ? oldIdToNewId[bm.folderId] || "1" : "1";
			const existing = currentBookmarks.find((b) => b.url === bm.url);

			if (existing) {
				// Skip updating/moving protected root nodes
				if (CHROME_ROOT_IDS.has(existing.id)) {
					oldIdToNewId[bm.id] = existing.id;
					createdBookmarkIds.add(existing.id);
				} else {
					await new Promise<void>((resolve) => {
						safeBmUpdate(existing.id, { title: bm.title }, () => {
							if (existing.parentId !== parentId) {
								safeBmMove(existing.id, { parentId }, () => {
									oldIdToNewId[bm.id] = existing.id;
									createdBookmarkIds.add(existing.id);
									resolve();
								});
							} else {
								oldIdToNewId[bm.id] = existing.id;
								createdBookmarkIds.add(existing.id);
								resolve();
							}
						});
					});
				}
			} else {
				await new Promise<void>((resolve) => {
					chrome.bookmarks.create(
						{
							parentId,
							title: bm.title,
							url: bm.url,
						},
						(created) => {
							oldIdToNewId[bm.id] = created.id;
							createdBookmarkIds.add(created.id);
							resolve();
						},
					);
				});
			}
		}

		// Delete bookmarks not in target
		for (const cb of currentBookmarks) {
			if (!createdBookmarkIds.has(cb.id) && !CHROME_ROOT_IDS.has(cb.id)) {
				await new Promise<void>((resolve) => {
					safeBmRemove(cb.id, resolve);
				});
			}
		}

		// Delete folders not in target (never touch root nodes)
		const targetNewFolderIds = new Set(Object.values(oldIdToNewId));
		for (const cf of currentFolders) {
			if (!CHROME_ROOT_IDS.has(cf.id) && !targetNewFolderIds.has(cf.id)) {
				await new Promise<void>((resolve) => {
					safeBmRemoveTree(cf.id, resolve);
				});
			}
		}

		// Save metadata with new IDs
		const bmsMeta: Record<
			string,
			{ tags?: string[]; summary?: string; manuallyAssigned?: boolean }
		> = {};
		targetBookmarks.forEach((b) => {
			const newId = oldIdToNewId[b.id] || b.id;
			bmsMeta[newId] = {
				tags: b.tags,
				summary: b.summary,
				manuallyAssigned: b.manuallyAssigned || false,
			};
		});

		const folsMeta: Record<string, { promptContext?: string }> = {};
		targetFolders.forEach((f) => {
			const newId = oldIdToNewId[f.id] || f.id;
			folsMeta[newId] = { promptContext: f.promptContext };
		});

		await setStorageItem("bm_metadata_bookmarks", bmsMeta);
		await setStorageItem("bm_metadata_folders", folsMeta);
	};

	const revertToState = async (id: string) => {
		const entry = history.find((h) => h.id === id);
		if (!entry) return;
		pushHistory(`Reverted to: ${entry.description}`, bookmarks, folders);

		if (isExtension) {
			isReconcilingRef.current = true;
			try {
				await revertChromeBookmarks(entry.bookmarks, entry.folders);
				await loadData();
			} catch (err) {
				console.error("Error during bookmarks revert reconciliation:", err);
			} finally {
				isReconcilingRef.current = false;
			}
		} else {
			setBookmarks(entry.bookmarks);
			setFolders(entry.folders);
		}
	};

	const clearHistory = () => {
		setHistory([]);
	};

	const injectPresetData = (name: string, bms: Bookmark[], fols: Folder[]) => {
		pushHistory(`Injected preset: ${name}`, bookmarks, folders);
		if (isExtension) {
			chrome.bookmarks.create(
				{
					parentId: "1",
					title: `Preset: ${name}`,
				},
				(presetRoot) => {
					const folderIdMap: Record<string, string> = {};

					const createFoldersMap = async () => {
						const remainingFolders = [...fols];
						for (
							let loop = 0;
							loop < 10 && remainingFolders.length > 0;
							loop++
						) {
							for (let i = remainingFolders.length - 1; i >= 0; i--) {
								const f = remainingFolders[i];
								if (!f.parentId || folderIdMap[f.parentId]) {
									const parent = f.parentId
										? folderIdMap[f.parentId]
										: presetRoot.id;
									const createdFolder =
										await new Promise<chrome.bookmarks.BookmarkTreeNode>(
											(resolve) => {
												chrome.bookmarks.create(
													{
														parentId: parent,
														title: f.name,
													},
													resolve,
												);
											},
										);
									folderIdMap[f.id] = createdFolder.id;

									const currentFoldersMeta =
										(await getStorageItem("bm_metadata_folders")) || {};
									currentFoldersMeta[createdFolder.id] = {
										promptContext: f.promptContext || "",
									};
									await setStorageItem(
										"bm_metadata_folders",
										currentFoldersMeta,
									);

									remainingFolders.splice(i, 1);
								}
							}
						}

						const currentBookmarksMeta =
							(await getStorageItem("bm_metadata_bookmarks")) || {};
						for (const bm of bms) {
							const parent = bm.folderId
								? folderIdMap[bm.folderId]
								: presetRoot.id;
							const createdBookmark =
								await new Promise<chrome.bookmarks.BookmarkTreeNode>(
									(resolve) => {
										chrome.bookmarks.create(
											{
												parentId: parent,
												title: bm.title,
												url: bm.url,
											},
											resolve,
										);
									},
								);
							currentBookmarksMeta[createdBookmark.id] = {
								tags: bm.tags || [],
								summary: bm.summary || "",
								manuallyAssigned: bm.manuallyAssigned || false,
							};
						}
						await setStorageItem("bm_metadata_bookmarks", currentBookmarksMeta);
					};

					createFoldersMap();
				},
			);
		} else {
			getStorageItem("bm_metadata_bookmarks").then((currentBookmarksMeta) => {
				const bookmarksMeta = currentBookmarksMeta || {};
				bms.forEach((bm) => {
					bookmarksMeta[bm.id] = {
						tags: bm.tags || [],
						summary: bm.summary || "",
						manuallyAssigned: bm.manuallyAssigned || false,
					};
				});
				setStorageItem("bm_metadata_bookmarks", bookmarksMeta);
			});

			getStorageItem("bm_metadata_folders").then((currentFoldersMeta) => {
				const foldersMeta = currentFoldersMeta || {};
				fols.forEach((f) => {
					foldersMeta[f.id] = {
						promptContext: f.promptContext || "",
					};
				});
				setStorageItem("bm_metadata_folders", foldersMeta);
			});

			setBookmarks(bms);
			setFolders(fols);
		}
	};

	const clearDatabase = () => {
		pushHistory("Cleared bookmarks and folders database", bookmarks, folders);
		if (isExtension) {
			chrome.bookmarks.getTree((tree) => {
				const root = tree[0];
				if (root.children) {
					root.children.forEach((child) => {
						// child is "1" (Bookmarks Bar), "2" (Other), "3" (Mobile) — safe as parent
						if (child.children) {
							child.children.forEach((subChild) => {
								// Never removeTree on protected root nodes themselves
								if (CHROME_ROOT_IDS.has(subChild.id)) return;
								safeBmRemoveTree(subChild.id, () => {
									if (chrome.runtime.lastError) {
										console.warn(
											"Skipped protected node:",
											subChild.id,
											chrome.runtime.lastError,
										);
									}
								});
							});
						}
					});
				}
				setStorageItem("bm_metadata_bookmarks", {});
				setStorageItem("bm_metadata_folders", {});
			});
		} else {
			setBookmarks([]);
			setFolders([]);
			setStorageItem("bm_metadata_bookmarks", {});
			setStorageItem("bm_metadata_folders", {});
		}
	};

	const addAiFolder = (folder: Folder) => {
		setAiFolders((prev) => {
			const next = [...prev, folder];
			setStorageItem("bm_blueprint_folders", next);
			return next;
		});
	};

	const updateAiFolder = (id: string, updates: Partial<Folder>) => {
		setAiFolders((prev) => {
			const next = prev.map((f) => (f.id === id ? { ...f, ...updates } : f));
			setStorageItem("bm_blueprint_folders", next);
			return next;
		});
	};

	const deleteAiFolder = (id: string) => {
		setAiFolders((prev) => {
			const next = prev.filter((f) => f.id !== id && f.parentId !== id);
			setStorageItem("bm_blueprint_folders", next);
			return next;
		});
	};

	const reloadAiFoldersFromReal = () => {
		const next = folders.map((rf) => {
			const existing = aiFolders.find(
				(af) =>
					af.id === rf.id || af.name.toLowerCase() === rf.name.toLowerCase(),
			);
			return {
				...rf,
				promptContext: existing ? existing.promptContext : "",
			};
		});
		setAiFolders(next);
		setStorageItem("bm_blueprint_folders", next);
	};

	return (
		<AppContext.Provider
			value={{
				bookmarks,
				folders,
				aiFolders,
				settings,
				history,
				setBookmarks,
				setFolders,
				setAiFolders,
				setSettings,
				updateBookmark,
				deleteBookmark,
				addBookmark,
				batchUpdateBookmarks,
				bulkDeleteBookmarks,
				updateFolder,
				addFolder,
				deleteFolder,
				bulkDeleteFolders,
				addAiFolder,
				updateAiFolder,
				deleteAiFolder,
				reloadAiFoldersFromReal,
				revertToState,
				clearHistory,
				injectPresetData,
				clearDatabase,
			}}
		>
			{children}
		</AppContext.Provider>
	);
};

export const useAppContext = () => {
	const context = useContext(AppContext);
	if (!context)
		throw new Error("useAppContext must be used within AppProvider");
	return context;
};
