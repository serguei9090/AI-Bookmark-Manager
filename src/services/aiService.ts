import type { Bookmark, Folder, Proposal, Settings } from "../types";

function cleanAndParseJson(text: string): unknown {
	const cleaned = text.trim();

	// 1. Try to parse directly
	try {
		return JSON.parse(cleaned);
	} catch (_e) {
		// Ignore and try cleaning
	}

	// 2. Try to extract markdown code blocks if present
	const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
	const match = cleaned.match(codeBlockRegex);
	if (match?.[1]) {
		const codeBlockContent = match[1].trim();
		try {
			return JSON.parse(codeBlockContent);
		} catch (_e) {
			// Ignore and fall through
		}
	}

	// 3. Fallback: find the first '{' and last '}' (for objects) or first '[' and last ']' (for arrays)
	const firstBrace = cleaned.indexOf("{");
	const lastBrace = cleaned.lastIndexOf("}");
	const firstBracket = cleaned.indexOf("[");
	const lastBracket = cleaned.lastIndexOf("]");

	// Try parsing object first if '{' is present and before/after corresponding parts
	if (
		firstBrace !== -1 &&
		lastBrace !== -1 &&
		(firstBracket === -1 || firstBrace < firstBracket)
	) {
		try {
			const objText = cleaned.substring(firstBrace, lastBrace + 1);
			return JSON.parse(objText);
		} catch (_e) {
			// Ignore
		}
	}

	// Try parsing array if '[' is present
	if (firstBracket !== -1 && lastBracket !== -1) {
		try {
			const arrText = cleaned.substring(firstBracket, lastBracket + 1);
			return JSON.parse(arrText);
		} catch (_e) {
			// Ignore
		}
	}

	// If we haven't succeeded, try the object parsing if we skipped it because '[' was first
	if (
		firstBrace !== -1 &&
		lastBrace !== -1 &&
		firstBracket !== -1 &&
		firstBrace > firstBracket
	) {
		try {
			const objText = cleaned.substring(firstBrace, lastBrace + 1);
			return JSON.parse(objText);
		} catch (_e) {
			// Ignore
		}
	}

	// If all fails, throw original parsing error
	return JSON.parse(cleaned);
}

// Get the effective URL and API key based on the provider and settings
export function getProviderConfig(settings: Settings): {
	url: string;
	apiKey: string;
} {
	const provider = settings.provider;
	switch (provider) {
		case "gemini":
			return {
				url: settings.geminiUrl || "https://generativelanguage.googleapis.com",
				apiKey: settings.geminiApiKey || "",
			};
		case "openai":
			return {
				url: settings.openaiUrl || "https://api.openai.com/v1",
				apiKey: settings.openaiApiKey || "",
			};
		case "ollama":
			return {
				url: settings.ollamaUrl || "http://localhost:11434",
				apiKey: settings.ollamaApiKey || "",
			};
		case "lmstudio":
			return {
				url: settings.lmstudioUrl || "http://localhost:1234/v1",
				apiKey: settings.lmstudioApiKey || "",
			};
		case "custom":
			return {
				url: settings.customUrl || "http://localhost:8080/v1",
				apiKey: settings.customApiKey || "",
			};
		default:
			return { url: "", apiKey: "" };
	}
}

let lastRequestStartTime = 0;

async function wait(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enforceRateLimit(settings: Settings): Promise<void> {
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

// Unified call helper to query LLM APIs directly
async function callLlmDirect(
	settings: Settings,
	systemPrompt: string,
	prompt: string,
	responseSchema?: unknown,
	jsonMode = true,
): Promise<string> {
	await enforceRateLimit(settings);
	const { provider, model, temperature, maxTokens } = settings;
	const { url: baseUrl, apiKey } = getProviderConfig(settings);

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

	const controller = new AbortController();
	const timeoutId = setTimeout(() => {
		controller.abort();
	}, 30000); // 30-second timeout

	try {
		if (provider === "gemini") {
			// Direct Gemini API call
			const cleanBaseUrl = baseUrl.replace(/\/$/, "");
			// Support custom path if user provided full v1/v1beta, otherwise default to v1beta
			const isFullUrl = cleanBaseUrl.includes("/v1");
			const apiUrl = isFullUrl
				? `${cleanBaseUrl}/models/${model}:generateContent?key=${apiKey}`
				: `${cleanBaseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

			const body: {
				contents: Array<{
					role: string;
					parts: Array<{ text: string }>;
				}>;
				generationConfig: {
					responseMimeType?: string;
					temperature: number;
					maxOutputTokens?: number;
					responseSchema?: unknown;
				};
			} = {
				contents: [
					{
						role: "user",
						parts: [{ text: `${systemPrompt}\n\n${prompt}` }],
					},
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
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
				signal: controller.signal,
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

		// OpenAI-compatible Chat Completions providers (openai, lmstudio, custom, and ollama fallback)
		const cleanBaseUrl = baseUrl.replace(/\/$/, "");

		// Decide which endpoint to hit
		let apiUrl = `${cleanBaseUrl}/chat/completions`;
		let requestBody: Record<string, unknown> = {};

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (apiKey) {
			headers.Authorization = `Bearer ${apiKey}`;
		}

		// Special handling for Ollama native generate endpoint if requested or URL indicates it
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
			// Standard chat completions for OpenAI, LMStudio, Custom, Ollama
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
			signal: controller.signal,
		});

		if (!res.ok) {
			const errText = await res.text();
			throw new Error(
				`${provider.toUpperCase()} API Error (${res.status}): ${errText}`,
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
	} finally {
		clearTimeout(timeoutId);
	}
}

export async function summarizeBookmark(
	bookmark: Bookmark,
	settings: Settings,
): Promise<{ summary: string; tags: string[] }> {
	const prompt = `Provide a concise 1-2 sentence summary and max 5 tags for this bookmark. Return a JSON object with keys "summary" (string) and "tags" (array of strings).
URL: ${bookmark.url}
Title: ${bookmark.title}`;

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
			"Attempt 1 (with schema) failed for summarize:",
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

	let parsed: { summary?: string; tags?: string[] } = {};
	try {
		parsed = cleanAndParseJson(responseText) as {
			summary?: string;
			tags?: string[];
		};
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
		let tags: string[] = [];

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

export async function autoSortBookmarks(
	bookmarks: Bookmark[],
	folders: Folder[],
	settings: Settings,
): Promise<Record<string, string | null>> {
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
		console.warn("Attempt 1 (with schema) failed for autoSortBookmarks:", e);
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
	const parsed = cleanAndParseJson(responseText) as {
		mappings?: Array<{ bookmarkId: string; folderId: string | null }>;
	};

	const mappingObj: Record<string, string | null> = {};
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

export async function proposeCategories(
	bookmarks: Bookmark[],
	settings: Settings,
): Promise<Proposal[]> {
	const systemPrompt =
		settings.systemPrompt ||
		"You are an intelligent bookmark manager assistant.";

	const prompt = `You are an expert bookmark organizer. Analyze these bookmarks and propose a set of logical folder categories for them.
Return a JSON object with a single key "proposals" containing an array of proposed folder categories. Each category must have a "name" (string) and "promptContext" (string, a brief context describing what type of sites go here).

Bookmarks:
${bookmarks.map((b) => `- URL: ${b.url}, Title: ${b.title}`).join("\n")}`;

	const schema = {
		type: "OBJECT",
		properties: {
			proposals: {
				type: "ARRAY",
				description: "List of proposed folder categories.",
				items: {
					type: "OBJECT",
					properties: {
						name: { type: "STRING" },
						promptContext: {
							type: "STRING",
							description:
								"A brief prompt context describing what type of sites go here.",
						},
					},
					required: ["name", "promptContext"],
				},
			},
		},
		required: ["proposals"],
	};

	let responseText = "";
	try {
		responseText = await callLlmDirect(settings, systemPrompt, prompt, schema);
	} catch (e) {
		console.warn("Attempt 1 (with schema) failed for proposeCategories:", e);
		try {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			responseText = await callLlmDirect(
				settings,
				systemPrompt,
				`${prompt}\nIMPORTANT: You must return valid JSON with a single "proposals" key containing category objects.`,
				undefined,
			);
		} catch (e2) {
			throw new Error(
				`AI inference failed: ${e2 instanceof Error ? e2.message : String(e2)}`,
			);
		}
	}
	const parsed = cleanAndParseJson(responseText) as {
		proposals?: Proposal[];
	};
	return parsed.proposals ?? [];
}

/** Unified connection tester to verify API endpoints with given settings */
export async function testConnection(settings: Settings): Promise<void> {
	const { url: baseUrl, apiKey } = getProviderConfig(settings);
	const base = baseUrl.replace(/\/$/, "");

	let testUrl = "";
	const headers: Record<string, string> = {};

	if (settings.provider === "gemini") {
		const isFullUrl = base.includes("/v1");
		testUrl = isFullUrl
			? `${base}/models?key=${apiKey}`
			: `${base}/v1beta/models?key=${apiKey}`;
	} else if (settings.provider === "openai") {
		testUrl = `${base}/models`;
		if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
	} else if (settings.provider === "ollama") {
		testUrl = `${base}/api/tags`;
	} else {
		testUrl = base.includes("/v1") ? `${base}/models` : `${base}/v1/models`;
		if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
	}

	const res = await fetch(testUrl, { headers });
	if (!res.ok) throw new Error(`API returned HTTP ${res.status}`);
	const data = await res.json();

	if (settings.provider === "ollama" || settings.provider === "gemini") {
		if (!data.models)
			throw new Error("Invalid response format: 'models' field expected");
	} else {
		if (!data.data)
			throw new Error("Invalid response format: 'data' field expected");
	}
}

/** Unified model fetcher to load live models from API endpoints */
export async function fetchModels(settings: Settings): Promise<{
	models: string[];
	metaMap: Record<string, { outputTokenLimit?: number }>;
}> {
	const { url: baseUrl, apiKey } = getProviderConfig(settings);
	const base = baseUrl.replace(/\/$/, "");

	let models: string[] = [];
	const metaMap: Record<string, { outputTokenLimit?: number }> = {};

	if (settings.provider === "gemini") {
		const isFullUrl = base.includes("/v1");
		const listUrl = isFullUrl
			? `${base}/models?key=${apiKey}`
			: `${base}/v1beta/models?key=${apiKey}`;
		const res = await fetch(listUrl);
		if (!res.ok) throw new Error(`Gemini API returned ${res.status}`);
		const data = await res.json();

		const modelsList = (data.models || []).filter(
			(m: { supportedGenerationMethods?: string[] }) =>
				(m.supportedGenerationMethods || []).includes("generateContent"),
		);

		for (const m of modelsList) {
			const name = (m.name || "").replace(/^models\//, "");
			if (name) {
				metaMap[name] = { outputTokenLimit: m.outputTokenLimit };
			}
		}

		models = Object.keys(metaMap).sort();
	} else if (settings.provider === "openai") {
		const url = base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`;
		const res = await fetch(url, {
			headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
		});
		if (!res.ok) throw new Error(`OpenAI API returned ${res.status}`);
		const data = await res.json();
		models = (data.data || [])
			.map((m: { id?: string }) => m.id)
			.filter(Boolean)
			.sort();
	} else if (settings.provider === "ollama") {
		const res = await fetch(`${base}/api/tags`);
		if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
		const data = await res.json();
		models = (data.models || [])
			.map((m: { name?: string }) => m.name)
			.filter(Boolean)
			.sort();
	} else {
		const url = base.includes("/v1") ? `${base}/models` : `${base}/v1/models`;
		const headers: Record<string, string> = {};
		if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
		const res = await fetch(url, { headers });
		if (!res.ok) throw new Error(`Endpoint returned ${res.status}`);
		const data = await res.json();
		models = (data.data || [])
			.map((m: { id?: string }) => m.id)
			.filter(Boolean)
			.sort();
	}

	return { models, metaMap };
}
