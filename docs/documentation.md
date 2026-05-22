# AI Bookmark Manager - Technical Documentation

This document describes the application architecture, tech stack, key functionalities, and security details regarding bookmark data integrity.

---

## 1. Technology Stack

The application is structured as a modern Single Page Application (SPA) designed to load both as a web dashboard and as a Chrome extension popup.

- **Frontend Core**: [React 19](https://react.dev) & [TypeScript](https://www.typescriptlang.org)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com) (utility-first styles with a unified modern dark/light system and custom animations)
- **Build System**: [Vite 6](https://vite.dev) (for high-speed HMR in development and static asset optimization in production)
- **Icons**: [Lucide React](https://lucide.dev) (premium micro-icons)
- **Backend Sandbox Dev Proxy**: [Express.js](https://expressjs.com) (serves compiled web assets, handles static directory queries, and proxies Large Language Model requests safely using the `@google/genai` SDK)

---

## 2. Key Functionalities

### 🧠 Semantic AI Auto-Sorting
- Uses Google Gemini API to analyze bookmark titles, URLs, and summaries.
- Matches them to the custom contexts of defined folders.
- Allocates them to folders automatically based on semantic meaning.

### 📝 AI Summarization & Tagging
- Direct calls to Gemini extract key descriptions, summaries, and core topics from bookmarks to index them for keyword searches.

### 🔍 Duplicate Link Finder
- Normalizes paths (e.g. trimming trailing slashes, downcasing schemes) to list exact duplicates and clean up redundant references.

### 🕰 Persistent Change History
- Keeps track of all state changes up to the last 10 versions.
- Saves snapshots of bookmarks + folders database in `localStorage` under the `bm_history` key.
- Allows users to undo changes instantly by reverting to a previous state.

---

## 3. Bookmark Safety: Ensuring User Data Protection

To guarantee that the user never loses their bookmark structure, several architectural rules are enforced:

### A. Non-Destructive local sandboxing by default
The application manages bookmarks in React State and stores them in `localStorage`. This prevents the application from making any direct writes or mutations to the browser's native database without permission.

### B. Explicit confirmations on all bulk actions
- **Deduplication**: Bulk deduplication prompts the user with the number of bookmarks to be deleted and keeps the oldest (original) bookmark by default.
- **Clear All**: Clearing the database requires explicit verification.

### C. Chrome Bookmarks Integration Concept
When deployed as a Chrome Extension, the application can interface with the native `chrome.bookmarks` API. By querying the tree:
1. All sorting and duplicate audits are performed **locally** in the extension popup memory.
2. The user sees a list of proposed organization changes before any action is taken.
3. No native bookmarks are modified or deleted without explicit user confirmation of the proposed mapping.

### D. 10-State Rolling Undo History
Any delete, import, AI sorting, or manual edit pushes the *previous state* onto a rolling history stack. If a user deletes a folder or duplicates by mistake, they can navigate to the **History** tab and click **Revert State** to restore the database to the exact snapshot from that point. Reverting also pushes the state right before reverting onto the history list, allowing users to even "undo an undo".
