# Project Testing Documentation

## Project Summary

This repository implements an AI-powered bookmark manager that functions as an interactive Chrome extension simulator. It combines a web dashboard interface with a simulated Chrome Extension Popup sandbox, featuring semantic organization, duplicate detection, and persistent state management via a 10-state undo/revert history.

Key functionalities include:
*   **Bookmark Management**: Semantic sorting, auto-tagging, and de-duplication of bookmarks.
*   **Extension Simulation**: Ability to compile and load a Manifest V3 compliant Chrome Extension for browser deployment.
*   **State Persistence**: A robust system for tracking and reverting the application state across multiple operations.

## Testing Strategy

Testing should cover functional correctness, data integrity, and extension compilation success.

### 1. Unit/Integration Tests (If Applicable)

If unit tests exist within `src/` or related modules, ensure they cover the core logic for:
*   Semantic categorization algorithms.
*   Duplicate detection routines in the index database.
*   State management handlers (undo/revert logic).

### 2. End-to-End (E2E) Testing

E2E tests should focus on validating the full user flow:
*   **Dashboard Functionality**: Verify that bookmark sorting and display across both workspace modes are accurate.
*   **State History Verification**: Test the persistence and correctness of the 10-state undo/revert mechanism. Attempt to revert to known states and verify data integrity post-reversion.
*   **Extension Build Validation**: Execute the build process (`npm run build:extension`) and manually verify that the resulting `dist/manifest.json` is valid and correctly structured for Manifest V3 compliance.

### 3. Extension Loading Test

Verify the manual loading procedure:
*   Ensure the command sequence (building, navigating to `chrome://extensions`, 'Load unpacked' with `dist/`) executes without error in a clean environment.
*   Confirm that the extension icon successfully appears and functions within the Chrome browser context.

### 4. Environment Checks

Verify prerequisites are met:
*   Ensure Node.js is installed on the execution environment.
*   Verify the `npm install` step completes successfully without dependency errors.

**Note**: Since this project relies heavily on LLM interactions and file system operations, testing must involve both application logic checks and external compilation verification.