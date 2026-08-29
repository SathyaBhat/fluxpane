# Changelog

All notable changes to FluxPane will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No changes yet.

## [1.1.2] - 2026-08-29

### Fixed
- Author dropdown now includes authors from all matching articles, not just the first loaded page

## [1.1.1] - 2026-08-16

### Fixed
- Windows release workflow now uses the Tauri v1-compatible GitHub Action
- Existing GitHub Releases can be rebuilt through the manual workflow trigger

## [1.1.0] - 2026-08-16

### Added
- Read/unread filtering with multi-select status dropdown (Unread / Read / Starred / All) replacing the binary toggle
- Author filter dropdown in filter bar with multi-select and per-author article counts
- "Mark All Read" respects active author and status filters — marks only visible unread entries
- Toggle read/unread button in article detail view header
- Category-level article filtering — clicking a category name in the sidebar loads all articles from that category
- Category unread counts shown as accent-colored badge next to category name in sidebar
- Category name and collapse chevron are now separate controls — click name to filter, click chevron to collapse
- Auto-refresh feed counters on window focus and every 5 minutes
- Collapsible categories in sidebar with persisted collapse state
- Catppuccin theme system with 4 flavors + system default
  - Created `src/themes/catppuccin.ts` with Latte, Frappé, Macchiato, and Mocha color palettes
  - Created `src/hooks/useTheme.tsx` - React context for theme management with system preference detection
  - Created `src/components/ThemeSettings.tsx` - Theme picker UI with live preview and color swatches
  - Default theme set to "system" - automatically follows OS dark/light preference
  - Theme preference persisted to localStorage (`fluxpane-theme`)
  - Dynamic CSS variable application for real-time theme switching
- Favicon display in sidebar for feed items
  - Created `src/services/favicon.ts` - Favicon service with Google favicon API integration
  - Created `src/hooks/useFavicon.tsx` - React hook for fetching and caching favicons
  - Added 7-day localStorage caching for favicon URLs (`fluxpane-favicon-cache`)
  - Implemented batch preloading with concurrency limit (5 concurrent requests)
  - Added fallback to first letter of feed title when favicon fails to load
  - Updated `src/components/Sidebar.tsx` with `FeedIcon` component
- Auto-update changelog skill
  - Created `.pi/skills/update-changelog/SKILL.md`
  - Created `.pi/skills/update-changelog/update.cjs` with auto-section detection

### Changed
- Article detail views automatically fetch full article content when opened
- Articles are marked read in-place on open and remain visible in the list (no longer removed from the unread list immediately)
- Filter bar consolidated into a single row below the toolbar (status dropdown + author dropdown + Mark All Read)
- Category headers in sidebar are now more visually prominent (bolder, uppercase, active highlight)
- Feed unread count badges only shown when count > 0
- Renamed application from "KimiFlux" to "FluxPane"
  - Updated `package.json` name to "fluxpane"
  - Updated `package-lock.json` name entries
  - Updated `index.html` title to "FluxPane"
  - Updated `src-tauri/Cargo.toml` name and description
  - Updated `src-tauri/tauri.conf.json` productName, identifier, and window title
  - Updated `src/components/Sidebar.tsx` header title
  - Updated localStorage keys: `fluxpane-config`, `fluxpane-favicon-cache`, `fluxpane-theme`

### Fixed
- Author dropdown counts now update when articles are marked read
- "Mark All Read" previously did nothing when viewing "All Unread" (no feed selected); now correctly marks all visible unread entries
- Author filter resetting when clicking an article (was incorrectly tied to entries changing rather than feed switching)
- Articles disappearing from the list immediately when opened and marked read — articles now stay pinned in the list until the article pane is closed or the feed/category is switched
- Unread-only sidebar preference not persisted across app restarts
- Fixed HTTP connection failure in release builds when connecting to Miniflux
  - Updated `src-tauri/tauri.conf.json` HTTP allowlist to allow all URLs with scope `["http://**", "https://**"]`
  - Updated CSP `connect-src` from `http:// https://` to `*` to allow all connections
  - Replaced axios with Tauri's HTTP API (`@tauri-apps/api/http`) in `src/services/miniflux.ts`
  - Updated `src/components/SettingsModal.tsx` to use Tauri HTTP API for connection testing
  - Added Tauri environment detection to fall back to browser fetch for web builds
