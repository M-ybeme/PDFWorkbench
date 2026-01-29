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

## Status — 2026-01-29

- Completed 0.1.0 "Project Foundations" — Vite app shell, theming, routing, state, linting/testing stack, and Netlify deploy are live.
- 0.2.0 viewer now ships drag/drop ingest, pdf.js rendering, cached page draws, richer metadata, and a scrollable thumbnail rail.
- Merge/split data modeling + workflow outline captured in `docs/MERGE_SPLIT_PLAN.md`.
- Merge workspace now ingests multiple PDFs, reorders them, and streams merged downloads via `pdf-lib`.
- Split workspace now renders selectable thumbnails, per-page exports, and every-N presets bundled into ZIP downloads.
- Password-protected PDFs now prompt for unlock codes directly inside the viewer and merge flow.
- Merge pipeline now has automated coverage that verifies `pdf-lib` is invoked before downloads.
- Next steps: broaden integration tests around the split exports and kick off 0.4.0 page editor work.

---

## Version Series Overview

- **0.1.x — Foundations**: Project setup, navigation, core architecture
- **0.2.x — PDF Viewer Core**: Viewing, navigation, thumbnails
- **0.3.x — Merge & Split**: Core file manipulation workflows
- **0.4.x — Page Editor**: Reorder, rotate, delete
- **0.5.x — Images → PDF**: Build PDFs from image sets
- **0.6.x — Compression**: Optimize/resize PDF output
- **0.7.x — Signatures**: Drawing/placing signatures
- **0.8.x — UX & Accessibility**: Fit & finish, keyboard controls
- **0.9.x — Hardening**: Tests, error handling, docs
- **1.0.0 — Stable Release**: Complete, polished suite

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

- Component tests for viewer interactions
- Basic E2E: load sample PDF and navigate

---

## 0.3.0 — Merge & Split

**Goals:** Multi-file merging and page extraction.

### User-Facing

- **Merge**: drop multiple PDFs, reorder list, merge & download
- **Split**: select pages via thumbnails, extract selected pages
- “Split every N pages” option

### Engineering

- Integrate `pdf-lib` for manipulation
- Add pure functions:
  - `mergePdfs(files)`
  - `extractPages(file, pageIndices)`

- Reuse viewer data when splitting

### Tests

- Unit tests for merging and extraction
- E2E: merge two PDFs, verify page count

---

## 0.4.0 — Page Editor (Reorder/Rotate/Delete)

**Goals:** Page-level manipulation tools.

### User-Facing

- Thumbnail grid editor:
  - Drag-and-drop reordering
  - Rotate left/right
  - Delete pages

- "Apply & Download" button
- Simple “Undo last change”

### Engineering

- Page model: `{ pageIndex, rotation, isDeleted }`
- Rebuild final PDF only on download

### Tests

- Unit tests for reorder/rotate/delete logic
- E2E verifying new page order

---

## 0.5.0 — Images → PDF

**Goals:** Build PDFs from images.

### User-Facing

- Drag/drop multiple images
- Reorder images
- Choose page size, orientation, fit mode (fit/fill/center)
- “Create PDF & Download”

### Engineering

- Read/preview images
- Use `pdf-lib` to embed images
- Layout utility for positioning/scaling

### Tests

- Unit tests for layout math
- E2E: images → PDF → verify page count

---

## 0.6.0 — Compression / Optimization

**Goals:** Reduce PDF size (image-heavy first).

### User-Facing

- Load PDF in “Compress” tool
- Quality presets (High / Balanced / Smallest)
- Display size before/after
- “Compress & Download”

### Engineering

- Downscale images within PDF
- Optional JPEG re-encoding
- Maintain text/vector content

### Tests

- Ensure valid PDF output
- E2E: compress sample and confirm smaller size

---

## 0.7.0 — Signatures

**Goals:** Add signatures visually and embed into PDF.

### User-Facing

- Signature modal:
  - Draw (canvas)
  - Type (script fonts)
  - Upload transparent PNG

- Drag/resize signature placement
- Save signatures in local storage

### Engineering

- Store signature image(s)
- Map viewer coordinates → PDF coordinates
- Embed signature image in chosen location

### Tests

- Unit tests for coordinate mapping
- E2E: place signature and export

---

## 0.8.0 — UX & Accessibility

**Goals:** Finalize usability and polish.

### User-Facing

- Unified layout across all tools
- Keyboard shortcuts:
  - Viewer navigation: arrows, +/- for zoom
  - Ctrl+O: open file

- ARIA roles and proper tab order

### Engineering

- Shared UI components (buttons, modals, drop zones)
- a11y linting and manual keyboard testing

### Tests

- Component tests for keyboard bindings
- E2E keyboard navigation scenario

---

## 0.9.0 — Hardening, Tests & Documentation

**Goals:** Prepare for production-ready v1.0.

### User-Facing

- Help/About modal for each tool
- Version stamp in footer

### Engineering

- Test coverage pass for all core modules
- Critical-path E2E tests:
  - Open → Edit → Download
  - Merge → Download
  - Images → PDF
  - Compress
  - Sign → Download

- Error boundaries for React
- Friendly error messages for corrupt/unsupported PDFs

### Documentation

- Updated README
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`

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
