const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.resolve(rootDir, "dist");

console.log("🚀 Starting Chrome Extension compilation...");

try {
	// 1. Run standard Vite build
	console.log("📦 Bundling React assets with Vite...");
	execSync("bun run build", { cwd: rootDir, stdio: "inherit" });
	console.log("✓ Vite build completed successfully.");

	// 2. Generate Manifest V3 manifest.json
	console.log("📝 Creating manifest.json...");
	const manifest = {
		manifest_version: 3,
		name: "AI Bookmark Manager",
		version: "0.5.1",
		description:
			"An AI-powered bookmark manager with categorization, summary generation, dark mode, and duplicate detection.",
		action: {
			default_popup: "index.html?popup=true",
		},
		icons: {
			16: "icons/icon-16.png",
			48: "icons/icon-48.png",
			128: "icons/icon-128.png",
		},
		background: {
			service_worker: "background.js",
		},
		permissions: ["storage", "bookmarks", "notifications"],
		host_permissions: [
			"https://generativelanguage.googleapis.com/*",
			"https://api.openai.com/*",
			"http://*/*",
			"https://*/*",
		],
	};

	fs.writeFileSync(
		path.join(distDir, "manifest.json"),
		JSON.stringify(manifest, null, 2),
		"utf-8",
	);
	console.log("✓ manifest.json created in dist/ folder.");

	// 3. Inform user about side-loading
	console.log("\n🎉 Extension successfully compiled!");
	console.log(
		"================================================================",
	);
	console.log("How to load this extension in Google Chrome:");
	console.log("1. Open Chrome and navigate to: chrome://extensions");
	console.log('2. Enable "Developer mode" toggle in the top-right corner.');
	console.log('3. Click "Load unpacked" button in the top-left corner.');
	console.log(`4. Select the build directory: \x1b[36m${distDir}\x1b[0m`);
	console.log(
		"================================================================",
	);
} catch (error) {
	console.error("❌ Compilation failed:", error.message);
	process.exit(1);
}
