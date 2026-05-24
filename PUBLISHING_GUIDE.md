# AI Bookmark Manager - Publishing & Distribution Guide (v0.4.2)

This guide provides the complete set of steps and required information for open-sourcing the project on GitHub under the MIT License and publishing the extension to the Google Chrome Web Store.

---

## Part 1: Publishing on GitHub as an MIT Project

### 1. Verification of MIT License Files

The project has been prepared with version `0.4.2` and configured with:

- **`LICENSE`**: A standard MIT License has been generated in the root directory.
- **`package.json`**: Configured with `"version": "0.4.2"` and `"license": "MIT"`.
- **`README.md`**: Updated to state the MIT open-source license.

### 2. Standard Git & GitHub Setup Checklist

1.  **Check `.gitignore`**: Ensure local secrets and build artifacts are not committed. The project is pre-configured with a `.gitignore` to ignore:
    - `node_modules/`
    - `dist/` (temporary build directory)
    - `.env` and `.env.local` (critical to keep your Gemini/OpenAI API keys private!)
    - `.fastembed_cache/`
2.  **Initialize Git (if not already done)**:
    ```bash
    git init
    git add .
    git commit -m "chore: release v0.4.2 with MIT License and publishing preparation"
    ```
3.  **Create a Repository on GitHub**:
    - Go to [github.com/new](https://github.com/new).
    - Set the Repository Name (e.g., `ai-bookmark-manager`).
    - Keep description concise: _"An AI-powered bookmark manager with auto-categorization, duplicate pruning, and local history."_
    - Keep the **"Add a LICENSE"** setting as **None** (since we already have a `LICENSE` file in the codebase).
    - Click **Create repository**.
4.  **Link and Push**:
    ```bash
    git remote add origin https://github.com/<your-username>/ai-bookmark-manager.git
    git branch -M main
    git push -u origin main
    ```
5.  **Enable GitHub Features (Recommended for MIT projects)**:
    - **Repository Topics**: Add tags like `chrome-extension`, `react`, `tailwind`, `gemini-api`, `ai-bookmark-manager`, `mit-license` to improve search discoverability.
    - **Releases**: Create a new release tagged `v0.4.2` and upload a brief release changelog outlining the version details.

---

## Part 2: Shipping to the Google Chrome Web Store

Before submitting, run the build compiler locally to get the production-ready build:

```bash
bun run build:extension
```

The output will be placed in the **`dist/`** directory.

### 1. Developer Account Registration

1.  Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2.  Sign in with a Google Account.
3.  Accept the developer agreement and pay the one-time **$5 USD developer fee** (charged by Google to verify identity and prevent spam extensions).

### 2. Packaging the Extension

1.  Locate the compiled **`dist/`** folder (which contains your static assets and the generated `manifest.json`).
2.  Compress the **contents** of the `dist/` folder into a single `.zip` file (e.g., `ai-bookmark-manager-v0.4.2.zip`).
    - _Warning:_ Zip the _contents_ of `dist/` directly, not the `dist` folder itself. When opened, the root of the ZIP file must contain the `manifest.json`.

### 3. Upload and Store Listing Details

1.  Click **Add new item** on the Developer Dashboard.
2.  Upload your `.zip` file.
3.  Fill out the **Store Listing** fields:
    - **Product Name:** `AI Bookmark Manager`
    - **Summary description (160 characters max):** Use the text from `CHROMEWEBSTORE.md`:
      > _An AI-powered bookmark organizer that automatically categorizes, summarizes, tags, and cleans up duplicate bookmarks directly in your browser._
    - **Detailed description:** Copy and paste the list of key features from `CHROMEWEBSTORE.md`.
    - **Category:** Select `Productivity` or `Developer Tools`.
    - **Language:** Select `English` (or your primary language).

### 4. Graphic Assets Requirements

You will need to upload these required graphics:

- **Extension Icon:** A square `128x128` pixels image.
- **Screenshots:** At least one screenshot showing the extension interface in action. Size must be `1280x800` or `640x400` pixels (PNG format recommended).
- **Promotional Tile (Optional but recommended):** A small tile image `440x280` pixels.

### 5. Privacy & Permissions Declarations (Crucial for Review Approval)

Google audits extension permissions very strictly. Refer to the specifications in `CHROMEWEBSTORE.md` for these answers in the console:

1.  **Single-Purpose Declaration:** Explain that the extension's sole purpose is to help users manage, organize, and prune bookmarks using local or user-provided AI models.
2.  **Permissions Justification:**
    - **`bookmarks`**: Needed to fetch, create folders, move, and delete bookmarks to categorize and prune duplicates.
    - **`storage`**: Needed to securely persist your configuration settings, API provider keys, and the undo/revert database history.
3.  **Host Permissions Justification:**
    - **`https://generativelanguage.googleapis.com/*`**: Required to perform direct client-side requests to the Google Gemini API using the user's personal API key.
    - **`https://api.openai.com/*`**: Required to call the OpenAI API directly for bookmark processing.
4.  **Data Usage Disclosure:**
    - Mark that the extension does **not** collect or transfer user data to third-party servers. All communications are direct API calls to LLM hosts, and all bookmark indexing is kept entirely client-side in the user's browser.
    - Provide a link to a privacy policy (you can host the text from `CHROMEWEBSTORE.md` on a GitHub Pages site or a simple gist).
