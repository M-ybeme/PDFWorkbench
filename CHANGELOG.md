# Changelog

All notable changes to PDF Workbench are documented here.

---

## [0.9.0] — 2026-02-19

### Added

- **Help/About modal** — `ToolHelpModal` accessible via a hover `?` button in the sidebar (desktop) and a tool context bar above the content area (mobile). Each tool has its own description, feature list, and keyboard shortcuts.
- **App footer** — 3-column footer with version stamp (left), logo link (center), and social links — LinkedIn, GitHub, Ko-fi (right).
- **Error boundaries** — `ErrorBoundary` class component wraps every tool route. A crash in one tool is isolated and shows a "Try again / ← Back to tools" recovery UI instead of a blank screen.
- **Merge E2E tests** — 2 scenarios: basic merge verifying page count, and reorder-then-merge.
- **Split E2E tests** — 3 scenarios: cherry-pick selection download, every-N-pages ZIP, and odd-pages selection.
- **React Router v7 future flags** — `v7_startTransition` and `v7_relativeSplatPath` opted in to silence deprecation warnings.
- **`APP_VERSION` constant** in AppShell — version string is now defined once and used throughout the sidebar, Overview badge, and footer.

### Improved

- **Friendly error messages** — all 6 tool pages that used bespoke red `<div>` error blocks now use the shared `<Alert variant="error" onDismiss>` component consistently.
- **Google Fonts loading** — moved from a render-blocking CSS `@import` to `<link rel="preconnect">` + `<link rel="stylesheet">` in `index.html`, eliminating the three-hop waterfall.
- **Logo preload** — `<link rel="preload" as="image">` added for the sidebar/footer logo (LCP element on every page).
- **Vendor chunk splitting** — `vite.config.ts` now splits `pdfjs-dist`, `pdf-lib`, `jszip`, and other `node_modules` into stable named chunks for better long-term caching.
- **Images page accessibility** — removed redundant `aria-label` attributes from `<label>` elements that already had `htmlFor` + text content, fixing the 90 → 96 Lighthouse accessibility score on that page.

### Documentation

- `README.md` updated to v0.9.0 with full tool table and links to new docs.
- `docs/ARCHITECTURE.md` — new file: directory structure, data flow diagram, key modules table, state management, routing, build config, and testing strategy.
- `CONTRIBUTING.md` — new file: prerequisites, scripts, code style, new-tool checklist, accessibility requirements, PR guidelines.
- `CHANGELOG.md` — this file.

---

## [0.8.9] — 2026-02-16

### Improved — Compression

- Full-screen loading modal (spinner + message) shown while compression runs so long-running operations are visible.

### Improved — Signatures text tool

- After placing a text block, the tool stays in text mode, clears the draft field, and deselects the placed block — ready for the next entry immediately.
- Clicking an existing text placement on the canvas switches automatically to the Text tool.
- "Done editing" promoted from a small text link to a solid filled button.
- Removed the 15% minimum width enforced on text placements — boxes can be as small as the user drags.

### Added — Signatures stroke layer

- "Draw strokes above other annotations" checkbox in the Pen and Highlighter panels to control z-order. Respected in both the canvas preview and the exported PDF.

---

## [0.8.5] — 2026-02-10

### Added

- **PDF → Images** — new tool page. Export each page as PNG or JPEG at 1×/2×/3× scale; download pages individually or as a ZIP archive.
- **Text search in viewer** — `Ctrl+F` opens a SearchBar with debounced case-insensitive full-text search across all pages via `getTextContent()`. Match count, Enter/Shift+Enter navigation, Escape to close.
- `usePdfTextSearch` hook with per-page text content caching.
- `SearchBar` component with `role="search"`, auto-focus, and full keyboard support.

### Infrastructure

- Route registration, landing page badge, activity log category, and help content for PDF → Images.

---

## [0.8.0] — 2026-01-30

### Added

- **Shared UI components** — `Alert` (with `role="alert"`, variants, dismiss), `Button` (variants + sizes), `DropZone` (accent colours per tool).
- **`useDragDrop` hook** — unified drag-and-drop + file input + global `Ctrl+O` ingest. Migrated across all 7 tool pages.
- **`useFocusTrap` hook** — Tab/Shift+Tab trapping with focus restoration. Applied to `PasswordPromptModal`, `SignatureBuilderModal`, and the fullscreen viewer overlay.
- **`useKeyboardShortcuts` hook** — declarative shortcut registration with input-element guard.
- **ARIA** — `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby` on all modals and fullscreen overlay.
- **Skip-to-content link** and `aria-label` on the navigation landmark in AppShell.
- **Keyboard shortcuts** — viewer page navigation (←/→), zoom (+/−/0), and global `Ctrl+O`.
- **`formatBytes` / `formatTimestamp`** utilities extracted from 6+ files into `src/lib/format.ts`.

### Tests

- 124 unit tests and 11 Playwright E2E tests all passing at release.

---

## [0.7.0] — 2026-01-22

### Added

- **Signatures tool** — draw, type (styled typeface), or upload a transparent PNG to create signature stamps.
- Drag/resize placement on any page with a local stamp library persisted to `localStorage`.
- **Text fill** — place typed text anywhere on the page.
- **Pen/highlighter** — freehand drawing tools with z-order control (above or below other annotations).
- Undo stack (`Ctrl+Z`) for all placement operations.
- Exported PDFs are flattened — all annotations baked into page content via pdf-lib.

### Tests

- Unit tests for coordinate mapping and fill/pen placement math.
- E2E: place a signature and export; complete a form with text and stickers.

---

## [0.6.0] — 2026-01-15

### Added

- **Compression tool** — three quality presets: High (144 DPI), Balanced (96 DPI), Smallest (72 DPI).
- Canvas-based page rasterisation via pdf.js + JPEG re-encoding with pdf-lib.
- Real-time before/after file size display.
- Guardrail warnings for files over 50 MB or 200 pages.
- Shared `ExportResult` contract and `logExportResult` helper adopted across merge, split, page editor, images, and compression.

### Tests

- Unit tests for compression helpers (preset logic, dimension scaling, size estimation).
- E2E: compress a PDF, verify valid output and page count; verify large-page warning.

---

## [0.5.0] — 2026-01-10

### Added

- **Images → PDF tool** — convert JPEG, PNG, WebP, GIF, or BMP images to a multi-page PDF.
- Layout presets: Letter, A4, Square; portrait/landscape orientation; Fit/Fill/Center modes.
- Automatic PNG integrity repair (canvas re-encoding fallback) before `pdf-lib.embedPng()`.
- Drag-to-reorder image queue before export.

### Tests

- Unit tests for layout math and PNG integrity heuristics.
- E2E: images → PDF download with page count verification.

---

## [0.4.0] — 2026-01-06

### Added

- **Page Editor tool** — drag-to-reorder thumbnails with visual drop indicators.
- Per-page rotate controls (90° CW and CCW).
- Delete individual pages with visual overlay treatment.
- Undo/redo history for all page operations.

### Tests

- Unit tests for reorder/rotate/delete logic.
- E2E: verify page order and deletions in the exported PDF.

---

## [0.3.0] — 2025-12-27

### Added

- **Merge tool** — upload any number of PDFs, drag cards to reorder, download the merged result.
- **Split tool** — interactive thumbnail grid; cherry-pick pages or use presets (every N pages, even/odd); export as a single PDF or ZIP bundle.
- Password-protected PDFs prompt for unlock codes in the viewer and merge flow.

### Engineering

- `pdf-lib` integrated for merge/split manipulation.
- `mergePdfs`, `extractPagesFromLoadedPdf`, `splitPdfByChunkSize`, `buildZipFromEntries` pure functions.
- `PdfSource` / `ExportResult` document pipeline contract defined (see `docs/DOCUMENT_PIPELINE_CONTRACT.md`).

---

## [0.2.0] — 2025-12-18

### Added

- **PDF Viewer** — drag/drop or `Ctrl+O` file ingest; pdf.js canvas rendering with a page cache.
- Scrollable thumbnail rail for fast navigation.
- Page navigation (prev/next/jump to page).
- Zoom controls (50%–200%).
- Metadata inspector (author, creation date, permissions).

---

## [0.1.0] — 2025-12-10

### Added

- Project bootstrap: React 18 + TypeScript 5 + Vite 5.
- Tailwind CSS with a custom dual-theme (light/dark) design system.
- React Router 6 with an `AppShell` layout and tool placeholder routes.
- Zustand global store for UI state and theme.
- ESLint + Prettier + strict TypeScript configuration.
- Vitest + React Testing Library unit test setup.
- GitHub Actions CI (lint + tests).
- Initial Netlify deployment.
