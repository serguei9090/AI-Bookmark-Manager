# Chrome Web Store Metadata & Permissions Justification

This document details the store listing metadata, permissions justifications, and privacy disclosures for the **AI Bookmark Manager** extension, as required for submission to the Chrome Web Store.

---

## 1. Store Listing Information

### **Product Name**
AI Bookmark Manager

### **Single-Purpose Description**
An AI-powered bookmark organizer that automatically categorizes, summarizes, tags, and cleans up duplicate bookmarks directly in your browser.

### **Detailed Description**
AI Bookmark Manager is a premium, client-side browser extension designed to help you take control of your bookmark vault. By connecting directly to your choice of AI model providers (including Google Gemini, OpenAI, Ollama, and LM Studio), it provides smart categorization, automatic summaries, and key tagging features without sacrificing privacy.

Key features include:
- **Direct AI Integration:** Call models directly using your own API keys. No middleware or third-party proxies.
- **Smart Folder Categorization:** Automatically analyze and organize bookmarks into logical categories and folder structures.
- **Auto-Summarization & Tagging:** Generate concise 1-2 sentence summaries and tags for your bookmarks.
- **Duplicate & Empty Folder Pruning:** Easily find duplicates or identify empty folders to keep your bookmark tree tidy.
- **Local Rollback History:** Tracks changes to allow you to undo categorizations and edits.
- **Responsive Dashboard & Popup:** Access all settings and organizing views from either a full-screen dashboard or the quick extension popup.

---

## 2. Permissions Justifications

In compliance with the Chrome Web Store's **Minimal Permission Policy**, this extension requests only the minimum set of permissions necessary to function:

### **`"bookmarks"`**
- **Purpose:** To read, create, update, delete, and reorganize bookmarks in the browser.
- **Justification:** The core utility of the extension is to manage bookmarks. Without this permission, the extension cannot retrieve the user's bookmarks tree, create new folders for AI proposals, move bookmarks to organized folders, or prune duplicate entries.

### **`"storage"`**
- **Purpose:** To persist extension settings and metadata.
- **Justification:** Needed to store user settings (such as dark mode preferences, selected AI providers, and custom model names) and custom bookmark metadata (tags, summaries, and manual override flags). In Manifest V3, this ensures settings are preserved in the background service worker.

---

## 3. Host Permissions Justifications

### **`https://generativelanguage.googleapis.com/*`**
- **Justification:** Required to connect directly and securely to the Google Gemini API to perform text summarization and categorization tasks.

### **`https://api.openai.com/*`**
- **Justification:** Required to connect directly and securely to the OpenAI API for chat completions and classification.

---

## 4. Privacy & Data Disclosure Policy

### **Data Processing & Collection**
- **Zero Third-Party Proxies:** The AI Bookmark Manager does not send your bookmarks, URLs, titles, or settings to any server owned by the developers. All requests are sent directly to the official LLM provider APIs (e.g., Google or OpenAI) or run entirely on your local machine (via Ollama or LM Studio).
- **Encryption at Rest:** All configured API keys are encrypted at rest using local symmetric obfuscation before being saved into your browser's extension storage, preventing plaintext exfiltration.
- **Personal Data:** We do not collect, store, or transmit any personally identifiable information (PII), browser history, or search queries.
