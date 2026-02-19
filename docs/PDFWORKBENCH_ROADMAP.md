# PDF Workbench — Project Roadmap to v1.0.0

This roadmap defines the milestones required to deliver a polished, production-quality **client-side PDF tool suite** built with **React + TypeScript + Vite + Tailwind** and deployable on **Netlify**.

The roadmap covers versions **0.1.0 → 1.0.0** and focuses on the following core features:

- PDF viewing
- Merge / split
- Page editing (reorder, rotate, delete)
- Images → PDF
- Compression
- Signatures
- Polished UI, accessibility, tests, and documentation

---

## Status — 2026-02-19

- Completed 0.1.0 "Project Foundations" — Vite app shell, theming, routing, state, linting/testing stack, and Netlify deploy are live.
- 0.2.0 viewer now ships drag/drop ingest, pdf.js rendering, cached page draws, richer metadata, and a scrollable thumbnail rail.
- Merge/split data modeling + workflow outline captured in `docs/MERGE_SPLIT_PLAN.md`.
- Merge workspace now ingests multiple PDFs, reorders them, and streams merged downloads via `pdf-lib`.
- Split workspace now renders selectable thumbnails, per-page exports, and every-N presets bundled into ZIP downloads.
- Password-protected PDFs now prompt for unlock codes directly inside the viewer and merge flow.
- Page editor (0.4.0) is live with reorder/rotate/delete controls, undo stack, and covered by unit + Playwright tests.
- Images→PDF (0.5.0) now supports layout presets, PNG integrity checks with automatic re-encoding fallbacks, and a stable E2E download flow.
- Shared `PdfSource` → `ExportResult` pipeline contract and `logExportResult` helper now back merge, split, page editor, and images workspaces for consistent naming, metadata, and activity logging.
- Compression (0.6.0) workspace now has working canvas-based downscale + JPEG re-encode pipeline with three presets (High/Balanced/Smallest), actual before/after size reporting, unit tests, and Playwright E2E coverage.
- Signatures (0.7.0) workspace now ships draw/type/upload signature creation, text/symbol fill tools, pen/highlighter freehand drawing, drag/resize placement, undo stack (Ctrl+Z), session persistence across refreshes, and canvas-to-PNG stroke export. Covered by unit tests (10 cases) and Playwright E2E (2 scenarios).
- UX & Accessibility (0.8.0) delivers shared utilities (`formatBytes`, `formatTimestamp`), `useDragDrop` hook replacing ~30 lines per page across all 7 tools, shared UI components (Alert, Button, DropZone), `useFocusTrap` and `useKeyboardShortcuts` hooks, ARIA roles on all modals and fullscreen overlay, skip-to-content link, keyboard shortcuts (Ctrl+O, arrow nav, +/- zoom, 0 reset), and 124 unit tests + 11 Playwright E2E tests all passing.
- Feature Gaps (0.8.5) delivers PDF → Images export tool (format/scale/quality controls, ZIP bundling, progress bar), text search in viewer (Ctrl+F, debounced search, match navigation, SearchBar component), 138 unit tests + E2E coverage. Password protection on export deferred — pdf-lib v1.17.1 cannot encrypt PDFs and no viable browser-only alternative exists.
- 0.9.0 Hardening is complete: help modals, footer, error boundaries, friendly error messages, Merge/Split E2E tests, Lighthouse audit + optimisations, and full documentation (README, ARCHITECTURE.md, CONTRIBUTING.md, CHANGELOG.md). Next: 1.0.0 stable release.

---

## Version Series Overview

- **0.1.x — Foundations**: Project setup, navigation, core architecture
- **0.2.x — PDF Viewer Core**: Viewing, navigation, thumbnails
- **0.3.x — Merge & Split**: Core file manipulation workflows
- **0.4.x — Page Editor**: Reorder, rotate, delete
- **0.5.x — Images → PDF**: Build PDFs from image sets
- **0.6.x — Compression**: Optimize/resize PDF output
- **0.7.x — Signatures**: Drawing/placing signatures
- **0.8.0 — UX & Accessibility**: Fit & finish, keyboard controls
- **0.8.5 — Feature Gaps**: Text search, password protection on export, PDF → Images
- **0.9.x — Hardening**: Tests, error handling, docs
- **1.0.0 — Stable Release**: Complete, polished suite
- **Post-1.0 — New Tools**: Watermark/page numbering, redaction, PDF → Images batch

---

## Platform Guardrails & Messaging (cross-cutting)

**Goals:** Respond to privacy, scale, and clarity risks before v1.0 ships.

- Prominent privacy statement (“files never leave your device”) plus FAQ coverage explaining browser-only processing and pdf.js sandbox limits.
- File-size and page-count caps per tool with warnings, progress indicators, and cancel affordances for long jobs.
- Shared document pipeline contract (`LoadedPdf`, `PdfSource`, `ExportResult`) so every workspace reuses ingest/export/error handling.
- Consistent download naming (original base name + operation + timestamp) and predictable ZIP structures.
- Error taxonomy with user-friendly copy for password-required, corrupted, unsupported encryption, oversized, and general render failures.
- Accessibility baseline for keyboard/focus management across drag/drop zones, thumbnail grids, and modal workflows.

---

## 0.1.0 — Project Foundations

**Goals:** Establish the technical base and core UI layout.

**Status:** Feature work shipped and deployed to Netlify (Jan 28 2026). GitHub Actions automation remains outstanding.

### User-Facing

- [x] Landing page with navigation placeholders
- [x] Dark/light mode toggle
- [x] Basic app shell and layout

### Engineering

- [x] Initialize project: React + TypeScript + Vite
- [x] Add Tailwind design system
- [x] Set up routing (React Router)
- [x] Add Zustand or Context-based global store
- [x] ESLint + Prettier + strict TS config
- [x] Add Vitest + React Testing Library
- [x] GitHub Actions CI (lint + tests)
- [x] Deploy initial build to Netlify

---

## 0.2.0 — PDF Viewer MVP

**Goals:** Load and view PDFs with thumbnails and zoom.

### User-Facing

- [x] Upload/drag-drop a PDF
- [x] Thumbnail sidebar with scroll
- [x] Page navigation (prev/next/jump)
- [x] Zoom controls (in/out, fit width, fit page)
- [x] Page count and file info

### Engineering

- [x] Integrate `pdfjs-dist` for rendering
- [x] Implement simple rendered-page cache
- [x] Create `LoadedPdf` data model
- [x] Create unified “file loader” module

### Tests

- [x] Component tests for viewer interactions
- [x] Basic E2E: load sample PDF and navigate

---

## 0.3.0 — Merge & Split

**Goals:** Multi-file merging and page extraction.

### User-Facing

- [x] **Merge**: drop multiple PDFs, reorder list, merge & download
- [x] **Split**: render selectable thumbnails, extract focused selections
- [x] “Split every N pages” option with bundled ZIP download

### Engineering

- [x] Integrate `pdf-lib` for merge/split manipulation paths
- [x] Add pure functions (`mergePdfs`, `extractPagesFromLoadedPdf`, `splitPdfByChunkSize`, `buildZipFromEntries`)
- [x] Reuse viewer loader + metadata when entering the split workspace

### Tests

- [x] Unit tests for merging and extraction flows (`pdfMerge.test.ts`, `pdfSplit.test.ts`)
- [x] E2E-lite: merge two PDFs and verify resulting page count (`src/lib/pdfMerge.test.ts`)

---

## 0.4.0 — Page Editor (Reorder/Rotate/Delete)

**Goals:** Page-level manipulation tools.

### User-Facing

- [x] Thumbnail grid editor for drag-and-drop reordering
- [x] Inline rotate left/right controls on every tile
- [x] Delete/restore toggle with overlay treatment
- [x] "Apply & Download" primary call-to-action
- [x] Simple "Undo last change" history stack

### Engineering

- [x] Page state model (`EditablePage`) with rotation + delete flags
- [x] `applyPageEdits` pipeline that rebuilds the PDF on export
- [x] Local thumbnail renderer reusing the pdf.js worker config

### Tests

- [x] Unit tests for reorder/rotate/delete logic (`pdfEdit.test.ts`)
- [x] E2E verifying new page order and deletes (`pdfEdit.test.ts` width/rotation assertions)

---

## 0.5.0 — Images → PDF

**Goals:** Build PDFs from images.

### User-Facing

- [x] Drag/drop multiple images
- [x] Reorder images
- [x] Choose page size, orientation, fit mode (fit/fill/center)
- [x] “Create PDF & Download”

### Engineering

- [x] Read/preview images
- [x] Use `pdf-lib` to embed images
- [x] Layout utility for positioning/scaling
- [x] PNG integrity guard with automatic canvas re-encoding (prevents `embedPng` hang)

### Tests

- [x] Unit tests for layout math
- [x] Unit tests for PNG integrity heuristics
- [x] E2E: images → PDF → verify page count + download completes reliably

---

## 0.6.0 — Compression / Optimization

**Goals:** Reduce PDF size (image-heavy first).

**Progress checkpoint — Feb 2026**

- [x] Shared export contract + download naming strategy is live across merge, split, page editor, and images flows, giving compression a ready-made ingest/export backbone.
- [x] `logExportResult` now supports detail overrides, so compression summaries can reuse the same activity log UI to communicate preset, savings, and warnings.
- [x] Merge/split/image/page editor suites cover the shared logging helper, ensuring compression work can focus on new processing instead of foundational plumbing.
- [x] Compression workspace UI complete with three quality presets (High/Balanced/Smallest), size projections, and guardrail messaging.
- [x] Canvas-based downscale + JPEG re-encode pipeline implemented; actual before/after sizes displayed after compression.
- [x] Unit tests for compression helpers (preset logic, dimension scaling, size estimation).
- [x] Playwright E2E coverage for compression flow (preset selection, download, valid output verification).
- [ ] Remaining scope: optional serverless optimizer investigation (post-v1.0).

### User-Facing

- [x] Load PDF in "Compress" workspace with clear messaging that pages are rasterized (text/vector content converted to images).
- [x] Quality presets (High / Balanced / Smallest) with copy outlining visual vs. size trade-offs.
- [x] Display original size, projected size, and percentage delta before running; show actual results afterward.
- [x] "Compress & Download" primary action with real-time progress feedback.
- [ ] Future: "Try serverless optimizer" callout for heavier jobs (post-v1.0).

### Engineering

- [x] Canvas-based page rendering via pdf.js at reduced resolution per preset thresholds.
- [x] JPEG re-encoding with preset-driven quality floors (0.85/0.75/0.65).
- [x] Rebuild PDF with pdf-lib using compressed JPEG images.
- [x] Guardrail warnings for large files (>50MB) and high page counts (>200 pages).
- [ ] Future: Selective image-only compression that preserves text/vector streams verbatim (would require deeper PDF parsing).
- [ ] Future: Serverless/edge pipeline for archival-grade compression.

### Tests

- [x] Unit tests for compression helpers (preset logic, dimension scaling, size estimation).
- [x] E2E: compress sample PDF and verify valid output with correct page count.
- [x] E2E: verify large page count warning triggers for PDFs with >200 pages.
- [x] Component tests for compression page initial state and UI elements.

---

## 0.7.0 — Signatures & Fill Tools

**Goals:** Add visual signatures and lightweight PDF filling/annotation tools so users can complete forms, drop stickers, and add inline notes before exporting.

### User-Facing

- [x] Scope is visual signature stamping only (not cryptographic signing) with explicit UI copy to set expectations.
- Signature modal:
  - [x] Draw (canvas)
  - [x] Type (script fonts)
  - [x] Upload transparent PNG

- [x] Drag/resize signature placement
- [x] Save signatures in local storage
- [x] Fill mode with inline text boxes for typing answers anywhere on the page
- [x] Sticker/checkmark palette for quickly marking boxes or initials
- [x] Basic pen/highlighter tool for sketching on the PDF

### Engineering

- [x] Store signature image(s)
- [x] Map viewer coordinates → PDF coordinates
- [x] Embed signature image in chosen location
- [x] Extend placement math to support text/sticker/pen primitives with sizing + color controls
- [x] Update stamping pipeline to draw text, stickers, and pen strokes directly into the exported PDF using pdf-lib fonts/paths
- [x] Persist fill elements with undo/redo support so form edits survive refreshes

### Tests

- [x] Unit tests for coordinate mapping
- [x] E2E: place signature and export
- [x] Copy test ensuring UI never implies digital/certified signature capabilities
- [x] Unit + integration coverage for fill/sticker/pen placement math
- [x] E2E: complete a sample form with text/stickers and export the filled PDF

---

## 0.8.0 — UX & Accessibility

**Goals:** Finalize usability and polish.

**Progress checkpoint — Feb 2026**

- [x] Shared formatting utilities (`formatBytes`, `formatTimestamp`) extracted from 6+ files into `src/lib/format.ts` with 16 unit tests covering edge cases.
- [x] `useDragDrop` hook consolidates drag/drop + file input + global Ctrl+O event handling; all 7 tool pages migrated, removing ~30 lines of duplication each.
- [x] Shared UI components (Alert, Button, DropZone) with ARIA roles, variant/size systems, and per-tool accent colors.
- [x] `useFocusTrap` hook with Tab/Shift+Tab trapping and focus restoration applied to PasswordPromptModal, SignatureBuilderModal, and fullscreen viewer overlay.
- [x] `useKeyboardShortcuts` declarative hook with input-element guard; used for viewer navigation and global Ctrl+O.
- [x] All modals and fullscreen overlay have `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`.
- [x] Skip-to-content link and `aria-label` on navigation landmark in AppShell.
- [x] 124 unit tests and 11 Playwright E2E tests all passing; TypeScript and build clean.

### User-Facing

- [x] Unified layout across all tools (shared `useDragDrop`, `Alert`, `Button`, `DropZone` components)
- [x] Keyboard shortcuts:
  - [x] Viewer navigation: arrows for page, +/- for zoom, 0 for reset
  - [x] Ctrl+O: open file (global, dispatched via custom event)
- [x] ARIA roles and proper tab order (modals, fullscreen overlay, skip link, nav landmark)

### Engineering

- [x] Shared UI components (Alert with ARIA roles, Button with variants, DropZone with accent colors)
- [x] Shared hooks (`useDragDrop`, `useFocusTrap`, `useKeyboardShortcuts`)
- [x] Shared utilities (`formatBytes`, `formatTimestamp`)
- [x] a11y linting (`eslint-plugin-jsx-a11y/recommended` already configured) and keyboard testing

### Tests

- [x] Component tests for keyboard bindings (PasswordPromptModal, PdfViewerPage)
- [x] E2E keyboard navigation scenario (skip link, Ctrl+O, arrow nav, zoom, ARIA landmarks)

---

## 0.8.5 — Feature Gaps

**Goals:** Close obvious feature gaps in existing tools before hardening.

**Progress checkpoint — Feb 2026**

- [x] PDF → Images export tool page with format (PNG/JPEG), scale (1x/2x/3x), JPEG quality slider, progress bar, and ZIP bundling for multi-page exports.
- [x] Text search in viewer: `Ctrl+F` opens SearchBar, debounced case-insensitive search across all pages via `page.getTextContent()`, match navigation (Enter/Shift+Enter), match count display.
- [x] `usePdfTextSearch` hook with per-page text content caching, match navigation, and page boundary crossing.
- [x] `SearchBar` component with auto-focus, keyboard shortcuts (Escape to close, Enter/Shift+Enter for next/prev), `role="search"` accessibility.
- [x] Route registration, activity log category, and landing page badge for PDF → Images.
- [ ] Password protection on export — deferred. pdf-lib v1.17.1 cannot encrypt output PDFs and no viable browser-only alternative exists.

### User-Facing

- [x] Text search in viewer (`Ctrl+F`) with match count and navigation
- [x] PDF → Images export — render pages as PNG/JPEG, download individually or as ZIP
- [ ] ~~Password protection on export~~ — deferred (pdf-lib limitation)

### Engineering

- [x] `usePdfTextSearch` hook extracting text via pdf.js `getTextContent()` with debounced search and cached text per page
- [x] `SearchBar` component with auto-focus, Enter/Shift+Enter navigation, Escape to close
- [x] `pdfToImages.ts` rendering pipeline: canvas-based page rendering at configurable scale, PNG/JPEG export, JSZip bundling
- [x] `PdfToImagesPage.tsx` tool page following established CompressionToolPage pattern

### Tests

- [x] Unit tests for SearchBar component (9 tests)
- [x] Unit tests for pdfToImages types (5 tests)
- [x] E2E: search text in viewer, toggle search bar
- [x] E2E: export multi-page PDF as ZIP of PNGs, export single-page as direct JPEG

---

## 0.8.9 — Tool UX Polish

**Goals:** Fix usability problems discovered in real use of the Compression and Signatures tools.

### Compression

- [x] Add full-screen loading modal (spinner + "Compressing your PDF… please don't close this tab") while compression runs so the long-running operation is obvious to the user.

### Signatures — Text tool workflow

- [x] After placing a text block, stay in text mode (no automatic switch back to Signature tool), clear the draft text field, and deselect the placed block so the next text entry can begin immediately.
- [x] Clicking an existing text placement on the canvas now automatically switches to the Text tool so editing is immediately available.
- [x] Promote "Done editing" from a tiny text link to a solid filled button so it's obvious how to finish editing a placed text block.

### Signatures — Text box width

- [x] Remove the 15% minimum width enforced on text placements. The box can now be dragged as small as the user wants; text is clipped if it doesn't fit, matching standard form-fill expectations.

### Signatures — Stroke layer order

- [x] Add a "Draw strokes above other annotations" checkbox in the Pen and Highlighter panels so users can choose whether pen/highlighter marks land on top of or behind placed signatures and text blocks.
- [x] The chosen order is respected both in the canvas preview and in the exported PDF.

---

## 0.9.0 — Hardening, Tests & Documentation

**Goals:** Prepare for production-ready v1.0.

### User-Facing

- [x] Help/About modal for each tool — `ToolHelpModal` accessible via hover `?` in sidebar (desktop) and a tool context bar above the Outlet (mobile).
- [x] Version stamp in footer — 3-column footer: version left, logo center, social links (LinkedIn, GitHub, Ko-fi) right.

### Engineering

- [X] Test coverage pass for all core modules
- Critical-path E2E tests:
  - [x] Page Editor — Open → Edit → Download
  - [x] Images → PDF
  - [x] Compress
  - [x] Sign → Download
  - [x] Merge → Download (2 scenarios: basic merge + reorder before merge)
  - [x] Split → Extract & Download (3 scenarios: selection, N-page slices ZIP, odd-pages)
- [x] Error boundaries for React — `ErrorBoundary` class component wrapping every tool route; per-tool crash isolation with "Try again" recovery and "← Back to tools" escape hatch.
- [x] Friendly error messages for corrupt/unsupported PDFs — standardised `Alert` component with dismiss used consistently across all tool pages for load and operation errors.
- [x] Lighthouse audit — scores recorded and optimisations applied:
  - Moved Google Fonts from CSS `@import` waterfall to `<link rel="preconnect">` + `<link rel="stylesheet">` in `index.html` (render-blocking chain eliminated)
  - Added `<link rel="preload" as="image" href="/PDFWorkbenchLogo.png">` for LCP element
  - Added `manualChunks` in `vite.config.ts` — `pdfjs-dist`, `pdf-lib`, `jszip`, and all other `node_modules` split into stable vendor chunks for better caching
  - Fixed accessibility regression on Images page (90 → 96): removed redundant `aria-label` from `<label>` elements that already had `htmlFor` + text content
  - Baseline scores: Performance 72–87 · Accessibility 90–96 · Best Practices 96 · SEO 92 across all 9 pages

### Documentation

- [x] Updated README — v0.9.0 tool table, links to new docs, script table, tech stack
- [x] `docs/ARCHITECTURE.md` — directory structure, data flow, key modules, state management, routing, build config, testing
- [x] `CONTRIBUTING.md` — prerequisites, scripts, code style, new-tool checklist, accessibility requirements, PR guidelines
- [x] `CHANGELOG.md` — full version history from 0.1.0 → 0.9.0

---

## 1.0.0 — Stable Release

**Definition of Done:**

- All core features implemented:
  - Viewer
  - Merge
  - Split/Extract
  - Page Editor
  - Images → PDF
  - Compression
  - Signatures

- Strong engineering support:
  - TypeScript types stable
  - Tests (unit + integrations + E2E)
  - CI running clean
  - No major user-facing issues

- UX:
  - Consistent design
  - Good accessibility
  - Clear messaging about privacy

**At this point:** The tool is ready for public use, portfolio demonstration, and long-term maintenance.

---

## Post-1.0 — Future Tools & Enhancements

Ideas for post-release expansion. These add new tool pages or significant new capabilities beyond the core v1.0 scope.

### New Tools

- **PDF → Images (batch)** — Bulk export all pages as a ZIP of PNGs/JPEGs with configurable DPI. Extends the single-page export from 0.8.5 into a full batch workflow.
- **Watermark / Page Numbering** — Add text or image overlays across all pages. Presets for "DRAFT", "CONFIDENTIAL", date stamps, and page numbering with position/font controls.
- **Redaction** — Draw rectangles over sensitive content, then permanently flatten the redacted areas. Distinct from signatures in that underlying content is destroyed on export.

### Enhancements to Existing Tools

- **Viewer**: Outline/bookmark navigation, annotation support
- **Merge**: Page interleaving mode (useful for double-sided scanning)
- **Compression**: Selective image-only compression that preserves text/vector streams verbatim
- **Signatures**: Date/time auto-stamp, initials quick-place mode

---
