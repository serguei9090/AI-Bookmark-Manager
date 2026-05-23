# AI Bookmark Manager & Chrome Extension Sandbox

## This is a personal learning project created for educational purposes and to explore different code concepts with ai concepts.

* **Status:** Personal sandbox / Portfolio piece.
* **License:** This project is open-source and available for public educational use under the MIT License.
* **Purpose:** Academic research and technical skill development.
* **License:** This project is for study purposes and is MIT open source license.


An AI-powered bookmark manager acting as an interactive Chrome extension simulator. Features semantic categorization, auto-tagging, summary generation, dark mode, duplicate detection, and a persistent 10-state undo/revert database history.

---

## ✨ Features

- **Double Workspace Display**: Seamlessly toggle between a full Web Dashboard layout and an interactive Chrome Extension Popup simulator.
- **Semantic Auto-Sorting**: Organizes bookmarks into subfolders based on folder prompts and titles using Large Language Models.
- **De-Duplication**: Quickly audits bookmark paths to find exact duplicates and cleans up index databases safely.
- **Persistent Change Logs**: Saves a rolling log of the last 10 changes in `localStorage`, letting you revert to any state with one click.
- **Chrome Extension Compilation**: Build and package the extension with Manifest V3 for browser deployment instantly.

---

## 🛠 Run Locally

### Prerequisites

Make sure you have [Node.js](https://nodejs.org) installed on your system.

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure AI Environment (Optional)

Create a `.env.local` file in the root directory and add your Gemini API Key:

```env
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

### 3. Run Development Server

```bash
npm run dev
```

The application will run locally, letting you test the simulated extension popup and sandbox dashboard immediately.

---

## 📦 Compile Chrome Extension

To compile the React + Vite application into a Manifest V3 compliant Chrome Extension:

```bash
npm run build:extension
```

This command runs Vite's build compiler and outputs a ready-to-load package inside the `dist/` folder, including a custom generated `manifest.json`.

### How to Load in Google Chrome:

1. Open Chrome and navigate to: `chrome://extensions`
2. Enable the **"Developer mode"** toggle in the top-right corner.
3. Click the **"Load unpacked"** button in the top-left corner.
4. Select the output directory: `dist/` of this project.

The extension icon will now appear in your browser, ready to manage your bookmarks!
