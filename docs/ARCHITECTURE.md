# PDF Workbench — Architecture

This document describes the codebase structure, key design decisions, and data-flow patterns for contributors and maintainers.

---

## Design Principles

1. **Client-side only.** Every PDF operation runs in the browser. No files are sent to a server. `pdf.js` handles rendering; `pdf-lib` handles creation and manipulation.
2. **Lazy-loaded tools.** Each tool page is a separate dynamic import. Heavy dependencies (`pdfjs-dist`, `pdf-lib`, `jszip`) are bundled into stable vendor chunks that the browser caches across page loads.
3. **Shared pipeline contract.** All tools follow the same `PdfSource → LoadedPdf → ExportResult` lifecycle. See [`DOCUMENT_PIPELINE_CONTRACT.md`](DOCUMENT_PIPELINE_CONTRACT.md) for the full spec.
4. **Isolated crashes.** Every tool route is wrapped in an `ErrorBoundary`. A bug in one tool cannot bring down the rest of the app.

---

## Directory Structure

```
src/
  components/       Shared UI components (AppShell, Alert, Button, DropZone, modals)
  data/             Static data (toolRoutes, toolHelp content)
  hooks/            Custom React hooks (useDragDrop, useFocusTrap, useKeyboardShortcuts, usePdfTextSearch)
  lib/              Pure utility modules — PDF operations, formatting, layout math
  pages/            One file per tool page; owns local state and wires lib/ calls together
  state/            Zustand stores (uiState, activityLog)
  router.tsx        createBrowserRouter with lazy page imports and future flags
  main.tsx          React root mount
  index.css         Tailwind directives + :root theme variables

docs/
  ARCHITECTURE.md               This file
  PDFWORKBENCH_ROADMAP.md       Milestone plan through v1.0
  DOCUMENT_PIPELINE_CONTRACT.md PdfSource / LoadedPdf / ExportResult type contract
  MERGE_SPLIT_PLAN.md           Early planning notes for 0.3.x

playwright/         End-to-end test specs (one file per tool)
public/             Static assets (logo, favicons, site.webmanifest)
index.html          App entry — preconnects, font link, logo preload, theme init script
vite.config.ts      Vite + Vitest config with manualChunks for vendor splitting
```

---

## Key Modules (`src/lib/`)

| File                    | Purpose                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pdfLoader.ts`          | Loads a `File` through pdf.js, returns a `LoadedPdf`. Handles password prompts.                                  |
| `pdfMerge.ts`           | Merges an ordered list of `LoadedPdf` objects into a single `Uint8Array` via pdf-lib.                            |
| `pdfSplit.ts`           | Extracts page subsets (`extractPagesFromLoadedPdf`) or chunks (`splitPdfByChunkSize`) into `Uint8Array` results. |
| `pdfEdit.ts`            | Applies reorder/rotate/delete instructions from the Page Editor and rebuilds the PDF.                            |
| `pdfCompression.ts`     | Rasterises each page via pdf.js canvas at a preset DPI, re-encodes as JPEG, rebuilds with pdf-lib.               |
| `pdfToImages.ts`        | Renders pages to canvas at configurable scale, exports as PNG or JPEG blobs, bundles as ZIP.                     |
| `signaturePlacement.ts` | Coordinate mapping between canvas viewport pixels and pdf-lib PDF-unit coordinates.                              |
| `signatureStamp.ts`     | Embeds signature images, text blocks, and pen strokes into the exported PDF.                                     |
| `imageLayout.ts`        | Computes `x/y/width/height` for fit, fill, and center modes inside a page's margin box.                          |
| `pngIntegrity.ts`       | Detects and repairs malformed PNG headers before `pdf-lib.embedPng()` is called.                                 |
| `pdfErrors.ts`          | Maps pdf.js/pdf-lib error codes to user-friendly message strings.                                                |
| `documentPipeline.ts`   | `ExportResult` type and `logExportResult` helper (writes to the activity log store).                             |
| `downloads.ts`          | `triggerBlobDownload` — creates an object URL, clicks it, then schedules revocation.                             |
| `fileNames.ts`          | Generates consistent download filenames (`{baseName}.{operation}.{timestamp}.{ext}`).                            |
| `format.ts`             | `formatBytes` and `formatTimestamp` display helpers.                                                             |
| `pdfWorker.ts`          | Configures the pdf.js worker (sets `workerSrc` for the bundled worker file).                                     |
| `theme.ts`              | Reads/writes the theme preference to `localStorage`.                                                             |

---

## Data Flow

```
User drops a file
       │
       ▼
  pdfLoader.ts          ← loadPdfFromFile()
  (pdf.js parse)
       │
       ▼
  LoadedPdf             ← { pageCount, metadata, doc, data }
       │
       ├──► Tool page state (React useState / Zustand)
       │         │
       │         ▼
       │    lib/ operation  (merge, split, compress, …)
       │         │
       │         ▼
       │    ExportResult   ← { blob, downloadName, durationMs, activity }
       │         │
       │    ┌────┴────────────────┐
       │    ▼                     ▼
       │  triggerBlobDownload   logExportResult
       │  (saves file)         (updates activity log → landing page)
       │
       └──► Error → Alert component (variant="error", onDismiss)
```

---

## State Management

Two Zustand stores, both in `src/state/`:

**`uiState`**

- `navOpen` / `setNavOpen` — mobile nav toggle
- `sidebarCollapsed` / `setSidebarCollapsed` — desktop sidebar collapse
- No persistence (resets on reload)

**`activityLog`**

- `entries[]` — recent `ExportResult` summaries surfaced on the landing page
- Persisted to `localStorage` via Zustand `persist` middleware

Tool pages own their local state (`useState`) for ephemeral UI concerns: loaded PDF, error messages, generating flags, selected pages, etc.

---

## Routing

`src/router.tsx` uses `createBrowserRouter` with:

- **Lazy imports** for every tool page (`React.lazy` + `Suspense`)
- **`ErrorBoundary`** wrapping every tool element (per-tool crash isolation)
- **Future flags** (`v7_startTransition`, `v7_relativeSplatPath`) to opt into React Router v7 behaviour early

The route tree is driven by `src/data/toolRoutes.ts`, which is the single source of truth for tool IDs, labels, versions, paths, and nav summaries. Adding a new tool requires:

1. A new entry in `toolRoutes.ts`
2. A new page component in `src/pages/`
3. A new entry in `src/data/toolHelp.ts` (for the help modal)
4. A lazy import + element in `router.tsx`

---

## Shared Hooks

| Hook                   | Purpose                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `useDragDrop`          | Unified file ingest — drag-and-drop zone + hidden `<input>` + global `Ctrl+O`. Used by all 8 tool pages.  |
| `useFocusTrap`         | Traps Tab/Shift+Tab focus within a modal ref. Applied to all dialogs.                                     |
| `useKeyboardShortcuts` | Declarative shortcut registration with input-element guard. Used for viewer navigation and global Ctrl+O. |
| `usePdfTextSearch`     | Searches text content across all pages via pdf.js `getTextContent()` with per-page caching.               |

---

## Build Configuration

**Chunk splitting** (`vite.config.ts`):

- `vendor-pdfjs` — `pdfjs-dist` (~2.5 MB unminified)
- `vendor-pdflib` — `pdf-lib` (~600 KB)
- `vendor-jszip` — `jszip`
- `vendor` — all other `node_modules`
- App code splits further per-route via React lazy imports

**`index.html` performance hints**:

- `<link rel="preconnect">` to `fonts.googleapis.com` and `fonts.gstatic.com`
- `<link rel="stylesheet">` for Google Fonts (Space Grotesk + DM Sans) — avoids the render-blocking `@import` waterfall
- `<link rel="preload" as="image">` for the logo (LCP element on every page)
- Inline theme-init `<script>` that reads `localStorage` and sets `data-theme` before first paint (prevents flash of wrong theme)

---

## Testing

**Unit tests** (`vitest` + `@testing-library/react`):

- One `*.test.ts` file per lib module
- Component tests for interactive UI pieces (SearchBar, PasswordPromptModal, etc.)
- Run with `npm run test`

**E2E tests** (`playwright`, Chromium only):

- One spec file per tool in `playwright/`
- Each spec builds a real test PDF with `pdf-lib`, uploads it, asserts on UI feedback and validates the downloaded output
- Run with `npm run test:e2e` (dev server starts automatically if not already running)

**CI**: GitHub Actions runs lint → unit tests → build on every push and pull request.
