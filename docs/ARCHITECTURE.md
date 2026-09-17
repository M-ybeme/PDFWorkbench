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
  hooks/            Custom React hooks — see Shared Hooks below
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

| File                    | Purpose                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pdfLoader.ts`          | Loads a `File` through pdf.js, returns a `LoadedPdf`. Handles password prompts.                                                      |
| `pdfMerge.ts`           | Merges an ordered list of `LoadedPdf` objects into a single `Uint8Array` via pdf-lib.                                                |
| `pdfSplit.ts`           | Extracts page subsets (`extractPagesFromLoadedPdf`) or chunks (`splitPdfByChunkSize`) into `Uint8Array` results.                     |
| `pdfEdit.ts`            | Applies reorder/rotate/delete instructions from the Page Editor and rebuilds the PDF.                                                |
| `pdfCompression.ts`     | Rasterises each page via pdf.js canvas at a preset DPI, re-encodes as JPEG, rebuilds with pdf-lib.                                   |
| `pdfToImages.ts`        | Renders pages to canvas at configurable scale, exports as PNG or JPEG blobs, bundles as ZIP.                                         |
| `signaturePlacement.ts` | Coordinate mapping between canvas viewport pixels and pdf-lib PDF-unit coordinates.                                                  |
| `signatureStamp.ts`     | Embeds signature images, text blocks, and pen strokes into the exported PDF.                                                         |
| `imageLayout.ts`        | Computes `x/y/width/height` for fit, fill, and center modes inside a page's margin box.                                              |
| `imagesToPdf.ts`        | Decodes source images (repairing malformed PNGs, re-encoding WebP/GIF/BMP/etc. via canvas) and embeds them as PDF pages via pdf-lib. |
| `pngIntegrity.ts`       | Detects and repairs malformed PNG headers before `pdf-lib.embedPng()` is called.                                                     |
| `pdfErrors.ts`          | `PdfLoadError` taxonomy and `getFriendlyPdfError` — maps errors to user-friendly message strings.                                    |
| `documentPipeline.ts`   | `PdfSource`/`ExportResult` types, `createPdfSourceFromFile`, and `buildDownloadName(FromSources)` helpers.                           |
| `downloads.ts`          | `triggerBlobDownload` — creates an object URL, clicks it, then schedules revocation.                                                 |
| `fileNames.ts`          | Generates consistent download filenames (`{baseName}.{operation}.{timestamp}.{ext}`).                                                |
| `format.ts`             | `formatBytes` and `formatTimestamp` display helpers.                                                                                 |
| `pdfWorker.ts`          | Configures the pdf.js worker (sets `workerSrc` for the bundled worker file).                                                         |
| `theme.ts`              | Reads/writes the theme preference to `localStorage`.                                                                                 |
| `ids.ts`                | `createLocalId(prefix)` — shared UUID-with-fallback helper for locally generated entity IDs.                                         |

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

Five Zustand stores, all in `src/state/`:

**`uiState`**

- `navOpen` / `setNavOpen` — mobile nav toggle
- `sidebarCollapsed` / `setSidebarCollapsed` — desktop sidebar collapse
- No persistence (resets on reload)

**`activityLog`**

- `entries[]` — recent `ExportResult` summaries surfaced on the landing page
- `logExportResult(result)` — the entry point tool pages call after a successful export
- Persisted to `localStorage` via Zustand `persist` middleware

**`pdfAssets`**

- Used by the Merge tool to hold the ordered list of loaded PDFs (`assets[]`) plus busy/error state
- `removeAsset`/`reset` call `asset.loaded.doc.destroy()` on each pdf.js document before dropping it — new code that removes or replaces assets must preserve this cleanup to avoid leaking pdf.js document handles

**`signatureLibrary`**

- Persisted, capped list (`MAX_SIGNATURES = 10`) of reusable signature images/text the Signatures tool can stamp onto a PDF

**`signatureSession`**

- Persisted in-progress signature placement state (`placements`, `textPlacements`, `strokes`) keyed by `buildFileKey(name, size)`, so reopening the same file restores unsaved work

Tool pages own local state (`useState`) for their own ephemeral UI concerns — generating flags, selected pages, export settings, edit history, etc. The loaded-PDF/status/error/password-prompt slice itself comes from the shared `useLoadedPdf` hook (see below), not per-page state.

---

## Routing

`src/router.tsx` uses `createBrowserRouter` with:

- **Lazy imports** for every tool page (`React.lazy` + `Suspense`)
- **`ErrorBoundary`** wrapping every tool element (per-tool crash isolation)
- **Future flags** (`v7_startTransition`, `v7_relativeSplatPath`) to opt into React Router v7 behaviour early

The route tree is driven by `src/data/toolRoutes.ts`, which is the single source of truth for tool IDs, labels, paths, and nav summaries. Adding a new tool requires:

1. A new entry in `toolRoutes.ts`
2. A new page component in `src/pages/`
3. A new entry in `src/data/toolHelp.ts` (for the help modal)
4. A lazy import + element in `router.tsx`

---

## Shared Hooks

| Hook                   | Purpose                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `useDragDrop`          | Unified file ingest — drag-and-drop zone + hidden `<input>` + global `Ctrl+O`. Used by all 8 tool pages.   |
| `useLoadedPdf`         | Owns the single-document PDF loading lifecycle (load, password retry, replace, reset, cleanup). See below. |
| `usePasswordPrompt`    | Owns just the password-prompt-modal state; used internally by `useLoadedPdf` and directly by Merge.        |
| `useFocusTrap`         | Traps Tab/Shift+Tab focus within a modal ref. Applied to all dialogs.                                      |
| `useKeyboardShortcuts` | Declarative shortcut registration with input-element guard. Used for viewer navigation and global Ctrl+O.  |
| `usePdfTextSearch`     | Searches text content across all pages via pdf.js `getTextContent()` with per-page caching.                |

---

## PDF Loading Lifecycle (`useLoadedPdf`)

`src/hooks/useLoadedPdf.ts` is the single implementation of the load/password-retry/replace/reset/cleanup state machine that used to be duplicated per page. It sits directly on top of `pdfLoader.ts`: it dynamically imports `loadPdfFromFile` (cached at module scope after the first call, so every page shares one `import()`), passes it a `requestPassword` callback, and turns the result into `{ pdf, status, error }`.

**What it owns:**

- `pdf: LoadedPdf | null`, `status: "idle" | "loading" | "ready" | "error"`, `error: string | null` (via `getFriendlyPdfError`)
- `passwordPrompt` state and `submitPassword`/`cancelPassword` (delegated to `usePasswordPrompt`) — `loadPdfFromSource`'s retry loop calls `requestPassword` again on a wrong password, so the same prompt naturally reappears with `reason: "password-incorrect"`
- `loadFile(file)` — loads a file, destroying whatever was previously loaded first
- `reset()` — clears the current document and cancels any pending password prompt
- Destroying the pdf.js document exactly once at each transition: on replace, on reset, and on unmount — deferred, not skipped, while an active-operation lease is outstanding (see Document Ownership & Lifetime below). A `pdfRef` (mirroring `pdf` outside React's render cycle) is the single source of truth for "what needs destroying," so replacement and unmount can never both try to destroy the same document
- A monotonic request token guards against async races: if a newer `loadFile`/`reset` call supersedes one still in flight, the older call's eventual result is discarded and — if it was a successful load — its document is destroyed immediately rather than leaked
- `withPdfLease(fn)` — lets a long-running operation borrow the current document across an `await`, guaranteeing it isn't destroyed out from under that operation even if the document is reset, replaced, or the page unmounts before the operation finishes

**What it does not own:** tool-specific state (selected pages, edit history, export settings, canvas rendering, thumbnails). Pages react to the hook's `pdf` reference changing (to seed their own state) and to `status` becoming `"loading"` (to clear their own result/error banners), the same way they already reacted to local `pdf` state before.

**Used by:** `CompressionToolPage`, `SplitToolPage`, `PageEditorPage`, `PdfToImagesPage`, `SignaturesToolPage`, `PdfViewerPage`.

**Not used by Merge.** `MergeToolPage` holds a _list_ of documents via the `pdfAssets` store (see State Management above), a genuinely different shape — forcing it through a single-document hook would have meant turning `useLoadedPdf` into a multi-document manager just to fit one caller. It reuses `usePasswordPrompt` directly instead, since that piece (and only that piece) was duplicated identically across every tool including Merge.

---

## Document Ownership & Lifetime

`useLoadedPdf()` is the single owner of the pdf.js document's physical lifetime — no other code ever calls `doc.destroy()`. Two separate mechanisms sit on top of that ownership, for two different needs:

- **Lifecycle invalidation (`pdfLifecycle`)** — an `AbortSignal` that aborts the instant the document is superseded (replace, reset, unmount), in the same synchronous step as destruction. This is for consumers that should stop immediately and have nothing to lose by stopping early — currently just thumbnail rendering. It does **not** keep the document alive; it just tells a cancel-fast consumer to stop reading it.
- **Active-operation leases (`withPdfLease`)** — the opposite guarantee, for a long-running operation (compression, PDF → Images export) that has already started reading pages and must be allowed to finish even if the document is reset, replaced, or its page unmounts in the meantime. `await withPdfLease(async (pdf) => { ... })` acquires a lease on whichever document is current, runs the callback, and releases in `finally` regardless of how it settles — a caller cannot forget to release. While any lease on a document is outstanding, `useLoadedPdf()` defers that document's `doc.destroy()` instead of skipping it; the deferred call runs exactly once, the moment the last lease on that specific document (tracked by its `id`, not a single shared counter) releases. Releasing a lease on an old, superseded document can never affect whatever document is current by the time that release happens.

**Choosing between them:** if reading a stale/half-destroyed document would only produce a briefly-wrong preview (thumbnails), cancel it via `pdfLifecycle`. If the user explicitly started something with a completion side effect they're waiting on (a download), borrow the document via `withPdfLease` instead — do not cancel it, and do not update the page's own React state after unmount (see below).

**Which tools need a lease:** only `compressPdfWithPreset` (`pdfCompression.ts`) and `renderAllPagesToImages` (`pdfToImages.ts`) read the live pdf.js document (`pdf.doc.getPage(...)`) across their operation, so only `CompressionToolPage` and `PdfToImagesPage` use `withPdfLease`. `extractPagesFromLoadedPdf`/`splitPdfByChunkSize` (`pdfSplit.ts`) and `applyPageEdits` (`pdfEdit.ts`) only ever read `pdf.data` — the already-loaded bytes, unaffected by the live document's lifecycle — so `SplitToolPage` and `PageEditorPage` don't need one. All four pages still track an `isMountedRef` and check it before updating their own success/error/busy state after an operation's `await` resolves, so a page that's gone by then doesn't bother touching state nobody will read; the download and activity-log side effects themselves still run either way, since those are real effects the user asked for, not UI.

---

## Thumbnail Rendering (`pdfThumbnails.ts`)

`src/lib/pdfThumbnails.ts` exports `renderThumbnails(pdf, { scale, signal })`, an async generator that renders each page of a loaded PDF to a PNG data URL and yields them one at a time as they finish, so callers can update their UI progressively instead of waiting for the whole document. Passing an `AbortSignal` stops it silently (no further yields, no thrown "cancelled" error) once aborted — mid-page work already in flight still finishes and is cleaned up, it's just not yielded.

It owns only the pdf.js mechanics common to every page: fetching each page, building its thumbnail viewport, creating a temporary canvas, running the render task, and releasing the page afterward (including on a failed render). It does not own the PDF document itself — `useLoadedPdf()` remains solely responsible for that lifecycle — nor does it decide how a page stores or displays the results.

**Used by:** `PdfViewerPage`, `SplitToolPage`, `PageEditorPage` — each keeps its own thumbnail state shape (an ordered array for the first two, an id-keyed record for the page editor, since thumbnails there are addressed by a stable page identity rather than position) and passes `useLoadedPdf()`'s own `pdfLifecycle` signal straight through as `renderThumbnails`'s `signal` — no page owns a separate `AbortController` for this (see Document Ownership & Lifetime below for why that signal is the right one to cancel thumbnails with, but not enough on its own to protect a long-running export).

**Not used by:** the signature/page-editing canvases, PDF → Images export, or PDF compression preview — each renders pdf.js pages to canvas for a genuinely different output contract (an interactive single-page surface, exported image files, or a re-encoded document) rather than a thumbnail rail.

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
