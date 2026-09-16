# Changelog

All notable changes to PDF Workbench are documented here.

---

## [1.0.1] — 2026-09-15

### Fixed

- **Stale pre-1.0 UI copy removed across the app** — Compression and Merge pages no longer describe already-shipped features as "coming next"; the PDF Viewer no longer shows a "0.2.0 / PDF Viewer MVP" header describing its own thumbnail rail and metadata panel as future work; the 404 page no longer references a "roadmap panel."
- **Friendly error messages no longer leak raw library internals** — `getFriendlyPdfError` and every `PdfLoadError` call site (`pdfEdit`, `pdfMerge`, `pdfSplit`, `pdfLoader`, `pdfCompression`, `pdfToImages`, Images → PDF) now consistently show a safe, specific message instead of raw pdf-lib/pdf.js error text, while still logging the original error via `console.error` for debugging.

### Removed

- **~51 stray compiled `.js` files** that had been checked into `src/` alongside their `.ts`/`.tsx` sources — leftover `tsc` output from a build config gap. `tsconfig.app.json` now sets `noEmit: true` so `tsc -b` (used only for type-checking) can't regenerate them, with a `.gitignore` backstop.
- **Dead code** — `buildMergedFileName`/`NamedFile`, the unused `wrapPdfLoadError` helper, the superseded `strokeToPdfPoints`/`PdfStrokePoint` vector-stroke path, and unreachable `canvas.toBlob`/`atob` browser-compatibility fallbacks (this app only ever runs in evergreen browsers).
- **Pre-1.0 rollout scaffolding** — `ToolPlaceholder.tsx` and its router fallback (every tool has been live since 1.0.0), the vestigial `status`/`eta`/per-tool `version` fields on `toolRoutes.ts`/`toolHelp.ts`, and the Landing Page's "What's coming next" card, which had drifted to list an already-shipped feature.

### Improved

- **8 duplicate UUID-with-fallback ID helpers** consolidated into a single `createLocalId(prefix)` in `src/lib/ids.ts`.
- **Router exhaustiveness** — `router.tsx`'s tool-to-page lookup is now typed as `Record<ToolId, ReactNode>` (`ToolId` shared with `documentPipeline.ts`'s activity categorization), so adding a new tool route without wiring up its element now fails `tsc` at build time instead of silently rendering a blank page.
- Two placeholder unit tests (`expect(true).toBe(true)`) in `pdfCompression.test.ts` / `pdfToImages.test.ts` replaced with real behavior tests covering per-page skip/warning/failure handling and ZIP bundling.

### Documentation

- `docs/ARCHITECTURE.md`, `README.md`, and `CONTRIBUTING.md` updated to match the above — accurate Zustand store count and `documentPipeline.ts` exports, the release line corrected from `v0.9.0` to `v1.0.0`, and a trimmed tools table without the removed per-tool version column.
- Added a `CHANGELOG.md` convention: a pre-commit hook (`.githooks/pre-commit`, wired up by `npm install`) now requires a changelog entry alongside other project changes.

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
