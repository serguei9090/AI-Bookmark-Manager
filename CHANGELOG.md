# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.2] - 2026-05-24

### Added
- **Separate Results Tabs**: Divided the Link Health Checker outcomes into three sub-tabs: **Offline / Dead**, **Unhealthy HTTP**, and **Ignored / Safe** with live counters.
- **Dynamic Card Styling**: Bookmark status cards now use color-coding: Red borders for Dead sites, Amber borders for Unhealthy status codes (e.g. 404/403/500/999), and Gray/translucent borders for Ignored links.
- **Manual Re-Check Action**: Added a minimalist refresh icon button to each card, allowing users to recheck individual links instantly (e.g., after turning on a VPN) with real-time feedback (spinning loader).
- **Workspace Maintenance Tools Tab**: Transitioned the sidebar from a single-purpose Duplicate Finder to a unified **Tools** tab.

### Fixed
- **DNS / Timeout False Positives**: Refactored connectivity checking logic to wait 1 second and retry once before declaring failure.
- **Domain Root Fallback**: If a deep subpage connection fails, the checker queries the base domain. If the domain root resolves, the bookmark is marked as "Unhealthy" (Host Reachable) instead of "Offline / Dead" to prevent accidental bulk deletes.
- **Scope Bookmark Counts**: Enhanced the scope selector dropdown to recursively compute and display the correct number of bookmarks inside each folder.
- **Stop Button Visibility**: Fixed stop audit button CSS background color to correctly render in bright red.

## [0.4.1] - 2026-05-24

### Added
- Initial Link Health Checker with CORS bypass and no-cors fallback connectivity tests.
- Support for ignoring dead bookmarks and persisting the ignore metadata state.
- MIT License configuration and initial Chrome Web Store publishing guides.
