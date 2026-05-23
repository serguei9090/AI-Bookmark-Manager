import { Bookmark, Folder, Settings, Proposal } from "../types";

function cleanAndParseJson(text: string): any {
  const cleaned = text.trim();

  // 1. Try to parse directly
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Ignore and try cleaning
  }

  // 2. Try to extract markdown code blocks if present
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(codeBlockRegex);
  if (match && match[1]) {
    const codeBlockContent = match[1].trim();
    try {
      return JSON.parse(codeBlockContent);
    } catch (e) {
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
    } catch (e) {
      // Ignore
    }
  }

  // Try parsing array if '[' is present
  if (firstBracket !== -1 && lastBracket !== -1) {
    try {
      const arrText = cleaned.substring(firstBracket, lastBracket + 1);
      return JSON.parse(arrText);
    } catch (e) {
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
    } catch (e) {
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

// Unified call helper to query LLM APIs directly
async function callLlmDirect(
  settings: Settings,
  systemPrompt: string,
  prompt: string,
  responseSchema?: any,
): Promise<string> {
  const { provider, model, temperature, maxTokens } = settings;
  const { url: baseUrl, apiKey } = getProviderConfig(settings);

  if (provider === "gemini" && !apiKey) {
    throw new Error("Gemini API Key is missing. Please enter your API Key in Settings.");
  }
  if (provider === "openai" && !apiKey) {
    throw new Error("OpenAI API Key is missing. Please enter your API Key in Settings.");
  }

  if (provider === "gemini") {
    // Direct Gemini API call
    const cleanBaseUrl = baseUrl.replace(/\/$/, "");
    // Support custom path if user provided full v1/v1beta, otherwise default to v1beta
    const isFullUrl = cleanBaseUrl.includes("/v1");
    const apiUrl = isFullUrl
      ? `${cleanBaseUrl}/models/${model}:generateContent?key=${apiKey}`
      : `${cleanBaseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body: any = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${prompt}` }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: temperature || 0.7,
        ...(maxTokens > 0 ? { maxOutputTokens: maxTokens } : {}),
      },
    };

    if (responseSchema) {
      body.generationConfig.responseSchema = responseSchema;
    }

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

  // OpenAI-compatible Chat Completions providers (openai, lmstudio, custom, and ollama fallback)
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  // Decide which endpoint to hit
  let apiUrl = `${cleanBaseUrl}/chat/completions`;
  let requestBody: any = {};

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // Special handling for Ollama native generate endpoint if requested or URL indicates it
  if (provider === "ollama" && cleanBaseUrl.endsWith("/api/generate")) {
    apiUrl = cleanBaseUrl;
    requestBody = {
      model: model || "llama3",
      prompt: `${systemPrompt}\n\n${prompt}`,
      stream: false,
      format: "json",
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
      response_format: { type: "json_object" },
    };
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
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

  const responseText = await callLlmDirect(
    settings,
    settings.systemPrompt ||
      "You are an intelligent bookmark manager assistant.",
    prompt,
    schema,
  );

  const parsed = cleanAndParseJson(responseText);
  return {
    summary: parsed.summary || "",
    tags: parsed.tags || [],
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

  const responseText = await callLlmDirect(
    settings,
    systemPrompt,
    prompt,
    schema,
  );
  const parsed = cleanAndParseJson(responseText);

  const mappingObj: Record<string, string | null> = {};
  if (Array.isArray(parsed.mappings)) {
    parsed.mappings.forEach((item: any) => {
      if (item && item.bookmarkId) {
        const fid = item.folderId;
        mappingObj[item.bookmarkId] =
          fid === null || fid === "null" || fid === "" ? null : fid;
      }
    });
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

  const responseText = await callLlmDirect(
    settings,
    systemPrompt,
    prompt,
    schema,
  );
  const parsed = cleanAndParseJson(responseText);
  return parsed.proposals || [];
}
