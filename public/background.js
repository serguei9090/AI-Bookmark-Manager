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

let lastRequestStartTime = 0;

async function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enforceRateLimit(settings) {
	const rpm = settings.apiRequestsPerMinute ?? 15;
	if (rpm <= 0) return;

	const minInterval = 60000 / rpm;
	const now = Date.now();
	const timeSinceLast = now - lastRequestStartTime;

	if (timeSinceLast < minInterval) {
		const waitTime = minInterval - timeSinceLast;
		lastRequestStartTime = lastRequestStartTime + minInterval;
		await wait(waitTime);
	} else {
		lastRequestStartTime = now;
	}
}

async function callLlmDirect(
	settings,
	systemPrompt,
	prompt,
	responseSchema = undefined,
	jsonMode = true,
) {
	await enforceRateLimit(settings);
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

	if (provider === "gemini" && !apiKey) {
		throw new Error(
			"Gemini API Key is missing. Please enter your API Key in Settings.",
		);
	}
	if (provider === "openai" && !apiKey) {
		throw new Error(
			"OpenAI API Key is missing. Please enter your API Key in Settings.",
		);
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
				temperature: temperature ?? 0.7,
				...(maxTokens > 0 ? { maxOutputTokens: maxTokens } : {}),
			},
		};

		if (jsonMode) {
			body.generationConfig.responseMimeType = "application/json";
			if (responseSchema) {
				body.generationConfig.responseSchema = responseSchema;
			}
		}

		const res = await fetch(apiUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			const errText = await res.text();
			throw new Error(`Gemini API Error (${res.status}): ${errText}`);
		}
		const data = await res.json();
		const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
		if (!content) {
			throw new Error("Gemini API returned an empty or invalid structure.");
		}
		return content;
	}

	let apiUrl = `${cleanBaseUrl}/chat/completions`;
	if (
		!cleanBaseUrl.includes("/v1") &&
		!cleanBaseUrl.includes("/v1beta") &&
		!cleanBaseUrl.endsWith("/api/generate")
	) {
		apiUrl = `${cleanBaseUrl}/v1/chat/completions`;
	}

	let requestBody = {};

	const headers = { "Content-Type": "application/json" };
	if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

	if (provider === "ollama" && cleanBaseUrl.endsWith("/api/generate")) {
		apiUrl = cleanBaseUrl;
		requestBody = {
			model: model || "llama3",
			prompt: `${systemPrompt}\n\n${prompt}`,
			stream: false,
			...(jsonMode ? { format: "json" } : {}),
			options: {
				temperature: temperature || 0.7,
				...(maxTokens > 0 ? { num_predict: maxTokens } : {}),
			},
		};
	} else {
		requestBody = {
			model: model || (provider === "openai" ? "gpt-4o-mini" : "local-model"),
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: prompt },
			],
			temperature: temperature || 0.7,
			...(maxTokens > 0 ? { max_tokens: maxTokens } : {}),
			...(jsonMode ? { response_format: { type: "json_object" } } : {}),
		};
	}

	const res = await fetch(apiUrl, {
		method: "POST",
		headers,
		body: JSON.stringify(requestBody),
	});
	if (!res.ok) {
		const errText = await res.text();
		const truncatedErr =
			errText.length > 500 ? `${errText.substring(0, 500)}...` : errText;
		throw new Error(
			`${provider.toUpperCase()} API Error (${res.status}): ${truncatedErr}`,
		);
	}
	const data = await res.json();

	if (provider === "ollama" && cleanBaseUrl.endsWith("/api/generate")) {
		if (!data.response) {
			throw new Error("Ollama API returned an empty response.");
		}
		return data.response;
	}

	const content = data.choices?.[0]?.message?.content;
	if (content === undefined || content === null) {
		throw new Error(
			`${provider.toUpperCase()} API returned an empty content payload.`,
		);
	}
	return content;
}

function cleanAndParseJson(text) {
	const cleaned = text.trim();

	// 1. Try to parse directly
	try {
		return JSON.parse(cleaned);
	} catch (_e) {
		// Ignore and try cleaning
	}

	// 2. Try to extract markdown code blocks if present
	const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/iu;
	const match = cleaned.match(codeBlockRegex);
	if (match?.[1]) {
		const codeBlockContent = match[1].trim();
		try {
			return JSON.parse(codeBlockContent);
		} catch (_e) {
			// Ignore and fall through
		}
	}

	// 3. Try to find the last '{' and last '}' (common for final object in chain-of-thought)
	const lastBrace = cleaned.lastIndexOf("}");
	const lastStartBrace = cleaned.lastIndexOf("{");
	if (lastStartBrace !== -1 && lastBrace !== -1 && lastStartBrace < lastBrace) {
		try {
			const objText = cleaned.substring(lastStartBrace, lastBrace + 1);
			return JSON.parse(objText);
		} catch (_e) {
			// Ignore
		}
	}

	// 4. Try to find the first '{' and last '}' (original strategy)
	const firstBrace = cleaned.indexOf("{");
	if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
		try {
			const objText = cleaned.substring(firstBrace, lastBrace + 1);
			return JSON.parse(objText);
		} catch (_e) {
			// Ignore
		}
	}

	// 5. Try to find the first '{' and first '}'
	const firstEndBrace = cleaned.indexOf("}");
	if (firstBrace !== -1 && firstEndBrace !== -1 && firstBrace < firstEndBrace) {
		try {
			const objText = cleaned.substring(firstBrace, firstEndBrace + 1);
			return JSON.parse(objText);
		} catch (_e) {
			// Ignore
		}
	}

	// 6. Try parsing array from first '[' and last ']'
	const firstBracket = cleaned.indexOf("[");
	const lastBracket = cleaned.lastIndexOf("]");
	if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
		try {
			const arrText = cleaned.substring(firstBracket, lastBracket + 1);
			return JSON.parse(arrText);
		} catch (_e) {
			// Ignore
		}
	}

	// If all fails, throw original parsing error
	return JSON.parse(cleaned);
}

async function summarizeBookmark(bookmark, settings) {
	if (!bookmark?.url) {
		return { summary: "", tags: [] };
	}

	const prompt = `Provide a concise 1-2 sentence summary and max 5 tags for this bookmark. Return a JSON object with keys "summary" (string) and "tags" (array of strings).\nURL: ${bookmark.url}\nTitle: ${bookmark.title}`;

	const schema = {
		type: "OBJECT",
		properties: {
			summary: { type: "STRING" },
			tags: {
				type: "ARRAY",
				items: { type: "STRING" },
			},
		},
		required: ["summary", "tags"],
	};

	let responseText = "";
	try {
		responseText = await callLlmDirect(
			settings,
			settings.systemPrompt ||
				"You are an intelligent bookmark manager assistant.",
			prompt,
			schema,
		);
	} catch (e) {
		console.warn(
			"Attempt 1 (with schema) failed for summarize in background:",
			bookmark.title,
			e,
		);
		try {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			responseText = await callLlmDirect(
				settings,
				settings.systemPrompt ||
					"You are an intelligent bookmark manager assistant.",
				`${prompt}\nIMPORTANT: You must return ONLY a raw JSON object with keys "summary" (string) and "tags" (array of strings). Do NOT include any introductory or concluding text, markdown code blocks, or bullet points. Just start with '{' and end with '}'.`,
				undefined,
			);
		} catch (e2) {
			throw new Error(
				`AI inference failed: ${e2 instanceof Error ? e2.message : String(e2)}`,
			);
		}
	}

	let parsed = {};
	try {
		parsed = cleanAndParseJson(responseText);
	} catch (err) {
		console.warn(
			"JSON parsing failed, attempting text heuristic parsing for:",
			responseText,
			err,
		);
		// Try heuristic text parsing
		const summaryMatch = responseText.match(
			/(?:summary|desc|description):\s*([^\n]+)/iu,
		);
		const tagsMatch = responseText.match(/(?:tags|keywords):\s*([^\n]+)/iu);

		let summary = "";
		let tags = [];

		if (summaryMatch?.[1]) {
			summary = summaryMatch[1].trim();
		} else {
			// If no "summary:" header, take the first 1-2 sentences of the text as summary
			const sentences = responseText
				.split(/[.!?\n]+/u)
				.map((s) => s.trim())
				.filter(Boolean);
			// Filter out bullet points/stars at the start of sentences
			const cleanSentences = sentences
				.map((s) => s.replace(/^[*\s\d.-]+/u, "").trim())
				.filter(Boolean);
			if (cleanSentences.length > 0) {
				summary = `${cleanSentences.slice(0, 2).join(". ")}.`;
			}
		}

		if (tagsMatch?.[1]) {
			tags = tagsMatch[1]
				.split(/[\s,#;]+/u)
				.map((t) =>
					t
						.trim()
						.toLowerCase()
						.replace(/[^\p{L}\p{N}_-]+/gu, ""),
				)
				.filter(
					(t) => t.length > 1 && !t.includes("tag") && !t.includes("keyword"),
				);
		} else {
			// Try to find any hashtags in the text
			const hashTags = responseText.match(/#\p{L}+/gu);
			if (hashTags) {
				tags = hashTags.map((t) => t.slice(1).toLowerCase());
			}
		}

		parsed = { summary, tags };
	}

	return {
		summary: parsed.summary ?? "",
		tags: parsed.tags ?? [],
	};
}

async function autoSortBookmarks(bookmarks, folders, settings) {
	if (
		!bookmarks ||
		bookmarks.length === 0 ||
		!folders ||
		folders.length === 0
	) {
		return {};
	}

	const systemPrompt =
		settings.systemPrompt ||
		"You are an intelligent bookmark manager assistant.";

	const prompt = `You are an expert bookmark organizer. Please categorize these bookmarks into the provided folders.
Return a JSON object with a single key "mappings" containing a list of mappings, where each mapping links a bookmarkId to the best-matching folderId. If no good folder matches, use null.

Folders:
${folders.map((f) => `- ID: ${f.id}, Name: ${f.name}, Context: ${f.promptContext}`).join("\n")}

Bookmarks:
${bookmarks.map((b) => `- ID: ${b.id}, URL: ${b.url}, Title: ${b.title}`).join("\n")}`;

	const schema = {
		type: "OBJECT",
		properties: {
			mappings: {
				type: "ARRAY",
				description: "List of bookmark folder mappings.",
				items: {
					type: "OBJECT",
					properties: {
						bookmarkId: { type: "STRING" },
						folderId: {
							type: "STRING",
							description:
								"The best-matching folder ID, or null / 'null' / empty string if no folder matches.",
						},
					},
					required: ["bookmarkId", "folderId"],
				},
			},
		},
		required: ["mappings"],
	};

	let responseText = "";
	try {
		responseText = await callLlmDirect(settings, systemPrompt, prompt, schema);
	} catch (e) {
		console.warn(
			"Attempt 1 (with schema) failed for autoSortBookmarks in background:",
			e,
		);
		try {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			responseText = await callLlmDirect(
				settings,
				systemPrompt,
				`${prompt}\nIMPORTANT: You must return valid JSON with a single "mappings" key containing folder ID mapping objects.`,
				undefined,
			);
		} catch (e2) {
			throw new Error(
				`AI inference failed: ${e2 instanceof Error ? e2.message : String(e2)}`,
			);
		}
	}
	const parsed = cleanAndParseJson(responseText);

	const mappingObj = {};
	if (parsed && Array.isArray(parsed.mappings)) {
		for (const item of parsed.mappings) {
			if (item?.bookmarkId) {
				const fid = item.folderId;
				mappingObj[item.bookmarkId] =
					fid === null || fid === "null" || fid === "" ? null : fid;
			}
		}
	}
	return mappingObj;
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

		const bmObj = {
			id,
			title,
			url,
			folderId,
			tags: [],
			summary: "",
			dateAdded: Date.now(),
		};

		const aiResult = await summarizeBookmark(bmObj, settings);
		const summary = aiResult.summary || "";
		const tags = aiResult.tags || [];

		const aiFolders = storage.bm_blueprint_folders || [];

		const bmWithAi = {
			...bmObj,
			tags,
			summary,
		};

		const sortingMapping = await autoSortBookmarks(
			[bmWithAi],
			aiFolders,
			settings,
		);

		let destRealFolderId = null;
		const matchedAiFolderId = sortingMapping[id];
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
		const urlLower = node.url.toLowerCase();
		if (urlLower.startsWith("http://") || urlLower.startsWith("https://")) {
			triggerBackgroundAutoOrganize(
				id,
				node.title,
				node.url,
				node.parentId || null,
			);
		}
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
