# Changelog

All notable changes to PDF Workbench are documented here.

---

## [1.0.7] — 2026-09-16

### Fixed

- **"Reset workspace," replacing the file, and Ctrl+O could destroy the active document while Compression, PDF → Images, Split, or Page Editor were still reading pages from it for an in-flight compress/export/split/apply-edits operation.** The operation then failed against a destroyed pdf.js document, surfacing a misleading generic error instead of the real cause. Each page's existing busy flag (`isCompressing`, `isExporting`, `isDownloading`, or `isSelectionDownloading`/`isBundleDownloading` on Split) now also guards `resetWorkspace()` and file replacement (`handleFilesSelected`, which covers the file picker, drag-and-drop, and Ctrl+O alike) with an early return, and disables the Reset button and file input in the UI while busy. The guard is independent of the `disabled` attribute, so a stale click can't slip through it.

### Tests

- 13 new focused tests across `CompressionToolPage.test.tsx`, `SplitToolPage.test.tsx`, and two new files `PdfToImagesPage.test.tsx`/`PageEditorPage.test.tsx`, verifying: Reset and the file input are disabled while the relevant operation is in flight; clicking Reset (even with the `disabled` attribute stripped, simulating a stale/programmatic click) never calls the underlying document reset; both re-enable once the operation finishes, on both success and failure.

---

## [1.0.6] — 2026-09-16

### Fixed

- **Images → PDF: a stale ingest batch could resurrect cleared images or bypass the 24-image cap.** Overlapping `handleFiles()` calls — e.g. clicking "Clear list" or selecting a second batch while an earlier one was still decoding — let the earlier batch's results land afterward, since nothing tracked whether it had been superseded. A monotonically-increasing request id now marks each ingest batch; a batch that finishes after being superseded (by Clear or a newer selection) discards its results instead of committing them or showing stale success/error banners.
- **The `MAX_IMAGES` cap could be bypassed by two batches racing against the same stale count.** The limit is now enforced against the live image list at commit time (inside the `setImages` updater), not the `images.length` a batch's closure was created with — a batch that would push the queue past 24 is truncated to the remaining capacity, deterministically, with the existing limit message shown.
- **A decoded image with zero or negative dimensions could silently produce a blank PDF page.** `createImageAsset()` now rejects such images immediately with a safe, typed `PdfLoadError` naming the file; `buildImagesPdf()` carries the same check as a defensive backstop against a malformed `ImageAsset` built some other way.

### Tests

- 4 new unit tests for `ensureValidImageDimensions` and `buildImagesPdf`'s use of it.
- 5 new component tests (`ImagesToPdfPage.test.tsx`, new file) covering: a stale batch superseded by Clear, a stale batch superseded by a newer selection, the `MAX_IMAGES` cap holding under overlapping batches, a single batch truncated to remaining capacity, and normal ingestion behavior unchanged.

---

## [1.0.5] — 2026-09-16

### Improved

- **Images → PDF's image/PDF processing logic moved out of the page component** into `src/lib/imagesToPdf.ts`, matching every other tool's `page → lib → pdf-lib/browser APIs` shape. `ImagesToPdfPage.tsx` now owns only UI state, drag/reorder, layout options, and download/activity triggering — it delegates image decoding, PNG repair, non-native format re-encoding (WebP/GIF/BMP/…), and PDF construction to the new module.
- A genuinely unsupported file type now throws a typed `PdfLoadError` (`"unsupported"`) instead of a raw `Error`, so a future caller that doesn't already substitute its own message gets a safe one for free — today's per-image and per-export error messages shown to users are unchanged.

### Tests

- 15 new unit tests for `imagesToPdf.ts` covering: supported JPEG/PNG passthrough, JPEG MIME aliases, non-native format re-encoding to JPEG, an untyped file sniffed by PNG signature, the PNG repair path (succeeds, falls back to JPEG, and propagates a rejection when both attempts fail), a genuinely unsupported type, multi-image page ordering and count, page sizing from the requested layout, embed-failure wrapping, and the standardized export result shape.
- 1 new Playwright test exercising the browser canvas re-encode path end-to-end with a real GIF upload — previously only the native-PNG path was covered by E2E.

---

## [1.0.4] — 2026-09-16

### Fixed

- **Replacing, resetting, or navigating away from a PDF while its thumbnails were still rendering could hang that render loop forever, or log a benign document replacement as a rendering error.** `useLoadedPdf()` destroyed the pdf.js document synchronously, but each page's own thumbnail cancellation only ran once React processed the resulting state update — by which time the document's worker could already be gone. `useLoadedPdf()` now exposes `pdfLifecycle`, an `AbortSignal` tied to the current document's generation that it aborts in the same synchronous step as destroying the document, before any state update or effect cleanup runs. `PdfViewerPage`, `SplitToolPage`, and `PageEditorPage` pass this signal straight into `renderThumbnails()` instead of each managing their own `AbortController`.
- `renderThumbnails()` no longer assumes `pdf.doc.getPage()` will always eventually settle — pdf.js can abandon a pending request outright when a document's worker is terminated mid-call, which used to hang the thumbnail loop indefinitely. It also now proactively cancels an in-flight render task the moment its document is invalidated, rather than waiting for pdf.js's own teardown to reject it, so a benign replacement can't be misreported as a genuine render failure.

### Tests

- 4 new tests for `useLoadedPdf` verifying `pdfLifecycle` aborts synchronously on replace, reset, and unmount — before, not after, React's own effect cleanup would run — and that each newly loaded document gets a fresh, non-aborted signal.
- 3 new tests for `renderThumbnails` covering a `getPage()` call that never settles, an in-flight render cancelled via the lifecycle signal (treated as cancellation, not an error, with cleanup still occurring), and a genuine render failure still propagating normally when unrelated to cancellation.

---

## [1.0.3] — 2026-09-16

### Improved

- **Centralized PDF thumbnail rendering** — the page-by-page "get page → build viewport → render to a temporary canvas → convert to a PNG data URL" loop, previously duplicated across `PdfViewerPage`, `SplitToolPage`, and `PageEditorPage`, is now a single `renderThumbnails(pdf, { scale, signal })` async generator (`src/lib/pdfThumbnails.ts`). Each page keeps its own thumbnail state shape and UI, and now consumes the shared generator instead of re-implementing the pdf.js rendering steps. ~110 lines of duplicated rendering logic removed.
- A failed thumbnail render now always releases its pdf.js page (`page.cleanup()`) before the error propagates — the three original implementations skipped this on failure, leaking the page's temporary render resources.
- Removed a no-op state update in `PageEditorPage`'s thumbnail error handling that did nothing and read as though it did.

### Tests

- 5 new focused tests for `renderThumbnails` covering page order and scale, cleanup after a successful render, cleanup and error propagation after a failed render, and stopping (without yielding or throwing) when aborted before or during iteration.

---

## [1.0.2] — 2026-09-16

### Fixed

- **PDF documents were never released on navigation away from the Viewer or Signatures tools** — both pages destroyed the loaded pdf.js document on explicit reset/replace, but not on unmount, leaking it every time the user navigated to another tool without clicking "Clear file" first.
- **Replacing a file while an earlier load was still in flight could leak the newer document** — if a slower, now-superseded load resolved after a newer one had already been selected, "last selected wins" depended on resolution order rather than selection order, and the winning document's `doc` was never destroyed. A monotonic request token now discards a superseded load's result and destroys its document immediately if it had already succeeded.
- **A failed dynamic import of the PDF loader module stayed cached forever** — one rejection (a stale chunk hash after a deploy, a transient network blip) would permanently break every subsequent PDF load for the rest of the tab's life. The cache now clears itself on a failed import so the next load attempt tries again.
- **Unmounting while a password prompt was open left that load suspended forever** — `useLoadedPdf()` now cancels any pending password prompt on unmount, and `usePasswordPrompt()` resolves through a ref rather than a `setState` updater, since React does not run functional updaters for a component that's already unmounting.

### Improved

- **Centralized PDF loading** — the load/password-retry/replace/reset/cleanup state machine, previously duplicated across `CompressionToolPage`, `SplitToolPage`, `PageEditorPage`, `PdfToImagesPage`, `SignaturesToolPage`, and `PdfViewerPage`, is now a single `useLoadedPdf()` hook (`src/hooks/useLoadedPdf.ts`), plus a small `usePasswordPrompt()` hook it composes internally and that `MergeToolPage` reuses directly. ~480 lines of duplicated state/effects/handlers removed. No page layout, workflow, or export behavior changed.
- `pdfLoader.ts`'s dynamic import is cached at module scope (one `import()` for the whole app) instead of once per load call, via a small generic `createLazyModule()` helper (`src/hooks/pdfLoaderModule.ts`).

### Tests

- 19 focused tests for `useLoadedPdf`/`usePasswordPrompt`/`pdfLoaderModule` covering load, replacement, reset, unmount, the full password-retry flow, a superseded concurrent load, friendly-error mapping, import-cache recovery after a failure, and password-prompt cancellation on unmount — using a mocked loader boundary rather than real PDFs.

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
