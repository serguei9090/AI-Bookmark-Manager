import type { Folder } from "../types";

/** Resolve a simulated blueprint folder ID to a real browser/storage folder ID by name */
export const getRealFolderId = (
	aiFolderId: string | null,
	aiFolders: Folder[],
	folders: Folder[],
): string | null => {
	if (!aiFolderId) return null;
	const aiFolder = aiFolders.find((f) => f.id === aiFolderId);
	if (!aiFolder) return null;
	const realFolder = folders.find(
		(rf) =>
			rf.id === aiFolder.id ||
			rf.name.toLowerCase() === aiFolder.name.toLowerCase(),
	);
	return realFolder ? realFolder.id : null;
};
