// Check if running inside a Chrome Extension with Bookmarks API
export const isExtension =
	typeof chrome !== "undefined" && chrome.bookmarks !== undefined;

/** Resolve a favicon image URL for a given web link */
export const getFaviconUrl = (urlStr: string): string => {
	try {
		const url = new URL(urlStr);
		return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
	} catch {
		return "";
	}
};

/** Trim host prefixes like www. to return a user-friendly domain label */
export const parseDomainName = (urlStr: string): string => {
	try {
		const url = new URL(urlStr);
		return url.hostname.replace("www.", "");
	} catch {
		return "Web Link";
	}
};

/** Check if a domain or its parent domain is present in the ignored domains list */
export const isUrlIgnored = (url: string, ignoredSites: string[]): boolean => {
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase();
		return ignoredSites.some((site) => {
			const cleanSite = site.trim().toLowerCase();
			if (!cleanSite) return false;
			return host === cleanSite || host.endsWith(`.${cleanSite}`);
		});
	} catch {
		return false;
	}
};

/** Get the root domain name for a URL */
export const getUrlDomain = (url: string): string => {
	try {
		const parsed = new URL(url);
		return parsed.hostname.toLowerCase();
	} catch {
		return "";
	}
};
