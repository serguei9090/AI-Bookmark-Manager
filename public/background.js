const ENCRYPTION_KEY = "nano_banana_salt_2026";

function decryptApiKey(cipherText) {
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

function getDecryptedSettings(settings) {
	if (!settings) return {};
	return {
		...settings,
		geminiApiKey: decryptApiKey(settings.geminiApiKey || ""),
		openaiApiKey: decryptApiKey(settings.openaiApiKey || ""),
		ollamaApiKey: decryptApiKey(settings.ollamaApiKey || ""),
		lmstudioApiKey: decryptApiKey(settings.lmstudioApiKey || ""),
		customApiKey: decryptApiKey(settings.customApiKey || ""),
		apiKey: decryptApiKey(settings.apiKey || ""),
	};
}

async function callLlmDirect(settings, systemPrompt, prompt) {
	const { provider, model, temperature, maxTokens } = settings;
	let baseUrl = "";
	let apiKey = "";

	if (provider === "gemini") {
		baseUrl = settings.geminiUrl || "https://generativelanguage.googleapis.com";
		apiKey = settings.geminiApiKey || "";
	} else if (provider === "openai") {
		baseUrl = settings.openaiUrl || "https://api.openai.com/v1";
		apiKey = settings.openaiApiKey || "";
	} else if (provider === "ollama") {
		baseUrl = settings.ollamaUrl || "http://localhost:11434";
		apiKey = settings.ollamaApiKey || "";
	} else if (provider === "lmstudio") {
		baseUrl = settings.lmstudioUrl || "http://localhost:1234/v1";
		apiKey = settings.lmstudioApiKey || "";
	} else {
		baseUrl = settings.customUrl || "http://localhost:8080/v1";
		apiKey = settings.customApiKey || "";
	}

	const cleanBaseUrl = baseUrl.replace(/\/$/, "");

	if (provider === "gemini") {
		const isFullUrl = cleanBaseUrl.includes("/v1");
		const apiUrl = isFullUrl
			? `${cleanBaseUrl}/models/${model}:generateContent?key=${apiKey}`
			: `${cleanBaseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

		const body = {
			contents: [
				{ role: "user", parts: [{ text: `${systemPrompt}\n\n${prompt}` }] },
			],
			generationConfig: {
				responseMimeType: "application/json",
				temperature: temperature ?? 0.7,
				...(maxTokens > 0 ? { maxOutputTokens: maxTokens } : {}),
			},
		};

		const res = await fetch(apiUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) throw new Error(`Gemini API Error: ${res.status}`);
		const data = await res.json();
		return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
	}

	const apiUrl = `${cleanBaseUrl}/chat/completions`;
	const requestBody = {
		model: model || (provider === "openai" ? "gpt-4o-mini" : "local-model"),
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: prompt },
		],
		temperature: temperature || 0.7,
		...(maxTokens > 0 ? { max_tokens: maxTokens } : {}),
		response_format: { type: "json_object" },
	};

	const headers = { "Content-Type": "application/json" };
	if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

	const res = await fetch(apiUrl, {
		method: "POST",
		headers,
		body: JSON.stringify(requestBody),
	});
	if (!res.ok)
		throw new Error(`${provider.toUpperCase()} API Error: ${res.status}`);
	const data = await res.json();
	return data.choices?.[0]?.message?.content || "";
}

function cleanAndParseJson(text) {
	try {
		return JSON.parse(text.trim());
	} catch (e) {
		const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
		if (match?.[1]) {
			try {
				return JSON.parse(match[1].trim());
			} catch (_) {}
		}
		const firstBrace = text.indexOf("{");
		const lastBrace = text.lastIndexOf("}");
		if (firstBrace !== -1 && lastBrace !== -1) {
			try {
				return JSON.parse(text.substring(firstBrace, lastBrace + 1));
			} catch (_) {}
		}
		throw e;
	}
}

async function triggerBackgroundAutoOrganize(id, title, url, folderId) {
	try {
		const storage = await chrome.storage.local.get([
			"bm_settings",
			"bm_blueprint_folders",
			"bm_metadata_bookmarks",
			"bm_metadata_folders",
		]);
		let rawSettings = storage.bm_settings || {};
		if (typeof rawSettings === "string") rawSettings = JSON.parse(rawSettings);
		const settings = getDecryptedSettings(rawSettings);

		if (!settings.autoOrganizeEnabled) return;

		let targetMonitoredId = settings.monitoredFolderId || "";

		// Fetch existing folders from chrome bookmarks api to resolve monitored folder name
		const bookmarksTree = await new Promise((resolve) =>
			chrome.bookmarks.getTree(resolve),
		);
		const foldersList = [];
		const traverse = (node) => {
			if (!node.url && node.id !== "0" && node.parentId) {
				foldersList.push({ id: node.id, name: node.title });
			}
			if (node.children) node.children.forEach(traverse);
		};
		if (bookmarksTree?.[0]) traverse(bookmarksTree[0]);

		if (
			!targetMonitoredId ||
			!foldersList.some((f) => f.id === targetMonitoredId)
		) {
			const existing = foldersList.find(
				(f) => f.name.toLowerCase() === "tosort",
			);
			if (existing) {
				targetMonitoredId = existing.id;
				rawSettings.monitoredFolderId = existing.id;
				await chrome.storage.local.set({ bm_settings: rawSettings });
			} else {
				// Create "ToSort" folder at root Bookmarks Bar "1"
				const newFolder = await new Promise((resolve) => {
					chrome.bookmarks.create({ parentId: "1", title: "ToSort" }, resolve);
				});
				targetMonitoredId = newFolder.id;
				rawSettings.monitoredFolderId = newFolder.id;
				await chrome.storage.local.set({ bm_settings: rawSettings });

				const metadataFolders = storage.bm_metadata_folders || {};
				metadataFolders[newFolder.id] = {
					promptContext: "Folder monitored for AI Auto-Organization",
				};
				await chrome.storage.local.set({
					bm_metadata_folders: metadataFolders,
				});
			}
		}

		if (folderId !== targetMonitoredId) return;

		const systemPrompt =
			settings.systemPrompt ||
			"You are an intelligent bookmark manager assistant.";
		const summaryText = await callLlmDirect(
			settings,
			systemPrompt,
			`Provide a concise 1-2 sentence summary and max 5 tags for this bookmark. Return a JSON object with keys "summary" (string) and "tags" (array of strings).\nURL: ${url}\nTitle: ${title}`,
		);

		const parsed = cleanAndParseJson(summaryText);
		const summary = parsed.summary || "";
		const tags = parsed.tags || [];

		const aiFolders = storage.bm_blueprint_folders || [];
		const sortText = await callLlmDirect(
			settings,
			systemPrompt,
			`You are an expert bookmark organizer. Please categorize these bookmarks into the provided folders.\nReturn a JSON object with a key "mappings" containing a list of mappings linking bookmarkId to folderId.\n\nFolders:\n${aiFolders.map((f) => `- ID: ${f.id}, Name: ${f.name}, Context: ${f.promptContext}`).join("\n")}\n\nBookmarks:\n- ID: ${id}, URL: ${url}, Title: ${title}`,
		);

		const parsedSort = cleanAndParseJson(sortText);
		let matchedAiFolderId = null;
		if (
			parsedSort &&
			Array.isArray(parsedSort.mappings) &&
			parsedSort.mappings[0]
		) {
			matchedAiFolderId = parsedSort.mappings[0].folderId;
		}

		let destRealFolderId = null;
		if (matchedAiFolderId && matchedAiFolderId !== "null") {
			const aiFolder = aiFolders.find((f) => f.id === matchedAiFolderId);
			if (aiFolder) {
				// Double check if folder exists in real folders
				const existingReal = foldersList.find(
					(f) =>
						f.id === aiFolder.id ||
						f.name.toLowerCase() === aiFolder.name.toLowerCase(),
				);
				if (existingReal) {
					destRealFolderId = existingReal.id;
				} else {
					// Create folder recursively under bookmarks bar
					const createdFolder = await new Promise((resolve) => {
						chrome.bookmarks.create(
							{ parentId: "1", title: aiFolder.name },
							resolve,
						);
					});
					destRealFolderId = createdFolder.id;
					const metadataFolders = storage.bm_metadata_folders || {};
					metadataFolders[createdFolder.id] = {
						promptContext: aiFolder.promptContext || "",
					};
					await chrome.storage.local.set({
						bm_metadata_folders: metadataFolders,
					});
				}
			}
		}

		const metadataBookmarks = storage.bm_metadata_bookmarks || {};
		metadataBookmarks[id] = {
			tags,
			summary,
			manuallyAssigned: false,
			ignoredDead: false,
			aiFailed: false,
		};
		await chrome.storage.local.set({
			bm_metadata_bookmarks: metadataBookmarks,
		});

		if (destRealFolderId) {
			await new Promise((resolve) =>
				chrome.bookmarks.move(id, { parentId: destRealFolderId }, resolve),
			);
		}
	} catch (err) {
		console.error("AI Auto-Organize background failed:", err);
		// Mark as failed in metadata
		try {
			const storage = await chrome.storage.local.get(["bm_metadata_bookmarks"]);
			const metadataBookmarks = storage.bm_metadata_bookmarks || {};
			metadataBookmarks[id] = {
				...metadataBookmarks[id],
				aiFailed: true,
			};
			await chrome.storage.local.set({
				bm_metadata_bookmarks: metadataBookmarks,
			});
		} catch (_err) {}
	}
}

chrome.bookmarks.onCreated.addListener((id, node) => {
	if (node.url) {
		triggerBackgroundAutoOrganize(
			id,
			node.title,
			node.url,
			node.parentId || null,
		);
	}
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === "CHECK_LINK") {
		const { url, timeoutMs = 8000 } = message;

		const performFetch = async () => {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

			try {
				const res = await fetch(url, {
					method: "GET",
					cache: "no-store",
					signal: controller.signal,
				});
				clearTimeout(timeoutId);
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
				if (controller.signal.aborted) {
					return { alive: false, status: 408, message: "Timeout (8s)" };
				}

				// Fallback to mode: 'no-cors' GET
				const noCorsController = new AbortController();
				const noCorsTimeoutId = setTimeout(
					() => noCorsController.abort(),
					timeoutMs,
				);

				try {
					await fetch(url, {
						method: "GET",
						mode: "no-cors",
						signal: noCorsController.signal,
						cache: "no-store",
					});
					clearTimeout(noCorsTimeoutId);
					return {
						alive: true,
						status: 0,
						message: "Reachable (CORS Opaque)",
					};
				} catch (_noCorsErr) {
					clearTimeout(noCorsTimeoutId);
					const isTimeout = noCorsController.signal.aborted;
					return {
						alive: false,
						status: isTimeout ? 408 : 0,
						message: isTimeout ? "Timeout (8s)" : "Unreachable / DNS Error",
					};
				}
			}
		};

		performFetch()
			.then((result) => sendResponse(result))
			.catch((err) =>
				sendResponse({
					alive: false,
					status: 500,
					message: err.message || "Fetch Error",
				}),
			);

		return true; // Keep message channel open for async sendResponse
	}
});

// Badge logic for failed bookmark AI processing
async function updateExtensionBadge() {
	try {
		const storage = await chrome.storage.local.get([
			"bm_settings",
			"bm_metadata_bookmarks",
		]);
		let rawSettings = storage.bm_settings || {};
		if (typeof rawSettings === "string") rawSettings = JSON.parse(rawSettings);

		// If auto-organize is disabled, clear badge
		if (!rawSettings.autoOrganizeEnabled) {
			chrome.action.setBadgeText({ text: "" });
			return;
		}

		// Find monitored folder ID
		let targetMonitoredId = rawSettings.monitoredFolderId || "";

		// Fetch tree to resolve folders and bookmarks
		const bookmarksTree = await new Promise((resolve) =>
			chrome.bookmarks.getTree(resolve),
		);

		const foldersList = [];
		const traverseFolders = (node) => {
			if (!node.url && node.id !== "0" && node.parentId) {
				foldersList.push({ id: node.id, name: node.title });
			}
			if (node.children) node.children.forEach(traverseFolders);
		};
		if (bookmarksTree?.[0]) traverseFolders(bookmarksTree[0]);

		if (!targetMonitoredId) {
			const existing = foldersList.find(
				(f) => f.name.toLowerCase() === "tosort",
			);
			if (existing) targetMonitoredId = existing.id;
		}

		const allBookmarks = [];
		const traverseBookmarks = (node) => {
			if (node.url) {
				allBookmarks.push({ id: node.id, folderId: node.parentId });
			}
			if (node.children) node.children.forEach(traverseBookmarks);
		};
		if (bookmarksTree?.[0]) traverseBookmarks(bookmarksTree[0]);

		const metadataBookmarks = storage.bm_metadata_bookmarks || {};
		let failedCount = 0;
		for (const bm of allBookmarks) {
			const meta = metadataBookmarks[bm.id] || {};
			const isFailed = meta.aiFailed;
			const isUnorganized =
				targetMonitoredId && bm.folderId === targetMonitoredId && !meta.summary;
			if (isFailed || isUnorganized) {
				failedCount++;
			}
		}

		if (failedCount > 0) {
			chrome.action.setBadgeText({ text: failedCount.toString() });
			chrome.action.setBadgeBackgroundColor({ color: "#EF4444" }); // Red color
			chrome.action.setTitle({
				title: `${failedCount} bookmark AI categorization pending/failed`,
			});
		} else {
			chrome.action.setBadgeText({ text: "" });
			chrome.action.setTitle({ title: "AI Bookmark Manager" });
		}
	} catch (err) {
		if (
			err?.message &&
			(err.message.includes("No SW Context") ||
				err.message.includes("context invalidated") ||
				err.message.includes("Extension context invalidated"))
		) {
			return;
		}
		console.error("Failed to update extension badge:", err);
	}
}

// Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, areaName) => {
	if (
		areaName === "local" &&
		(changes.bm_metadata_bookmarks || changes.bm_settings)
	) {
		updateExtensionBadge();
	}
});

// Run badge update on load/startup
chrome.runtime.onStartup.addListener(updateExtensionBadge);
updateExtensionBadge();
