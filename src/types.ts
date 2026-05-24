export type Bookmark = {
	id: string;
	title: string;
	url: string;
	folderId: string | null;
	tags: string[];
	summary: string;
	dateAdded: number;
	favicon?: string;
	manuallyAssigned?: boolean;
	ignoredDead?: boolean;
	aiFailed?: boolean;
};

export type Folder = {
	id: string;
	parentId: string | null; // supports subfolders nesting nested trees
	name: string;
	promptContext: string;
};

export type AIProvider = "openai" | "gemini" | "ollama" | "lmstudio" | "custom";

export type Settings = {
	provider: AIProvider;
	model: string;
	customUrl: string;
	apiKey: string;
	systemPrompt: string;
	darkMode: boolean;
	temperature: number;
	maxTokens: number;
	viewMode: "extension" | "dashboard"; // simulation layout matching user requested chrome extension concept
	geminiUrl?: string;
	geminiApiKey?: string;
	openaiUrl?: string;
	openaiApiKey?: string;
	ollamaUrl?: string;
	ollamaApiKey?: string;
	lmstudioUrl?: string;
	lmstudioApiKey?: string;
	customApiKey?: string;
	maxHistoryEntries?: number;
	autoOrganizeEnabled?: boolean;
	monitoredFolderId?: string;
};

export type Proposal = {
	name: string;
	promptContext: string;
};

export type HistoryEntry = {
	id: string;
	bookmarks: Bookmark[];
	folders: Folder[];
	timestamp: number;
	description: string;
};

export type HealthScanHistoryEntry = {
	id: string;
	timestamp: number;
	folderId: string;
	folderName: string;
	summary: {
		alive: number;
		dead: number;
		unhealthy: number;
		ignored: number;
	};
	results: Record<string, { alive: boolean; status: number; message: string }>;
};

export type LastScanResultsState = {
	results: Record<string, { alive: boolean; status: number; message: string }>;
	scopeFolderId: string;
	scanState: "idle" | "scanning" | "complete";
	scannedCount: number;
	totalToScan: number;
};

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
	id: string;
	message: string;
	type: ToastType;
};
