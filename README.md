# PDF Workbench

A complete client-side PDF toolkit built with React + TypeScript. View, merge, split, edit pages, convert images to PDF, and compress documents—all without uploading files to a server. Your files never leave your browser.

See `docs/PDFWORKBENCH_ROADMAP.md` for the full development plan through v1.0.

## Scripts

- `npm install` – install dependencies
- `npm run dev` – start Vite dev server
- `npm run build` – type check and build production bundle
- `npm run preview` – preview production build
- `npm run lint` – run ESLint with TypeScript/React rules
- `npm run test` – execute Vitest unit test suite
- `npm run test:e2e` – run Playwright end-to-end tests
- `npm run format` – format all supported files with Prettier

## Tech Stack

- React 18 + React Router 6
- TypeScript 5 with strict settings and Vite 5
- pdf.js for PDF rendering, pdf-lib for PDF manipulation
- Zustand for lightweight global UI state (theme, nav toggles)
- Tailwind CSS 3 with a custom dual-theme design system
- Vitest + React Testing Library for unit tests
- Playwright for end-to-end browser tests
- ESLint + Prettier for linting/formatting consistency
- GitHub Actions CI + Netlify deployment

## Current Tools (v0.6.0)

- **PDF Viewer** – Drag/drop loader with password prompts, zoom controls, thumbnail rail, metadata browser, and cached canvas renderer.
- **Merge Workspace** – Stack multiple PDFs, reorder them, and download a merged artifact with consistent naming.
- **Split Workspace** – Render interactive thumbnails, toggle selections, and export either curated pages or preset slices (bundled in ZIPs).
- **Page Editor** – Drag-to-reorder, rotate (±90°), delete pages with undo history, then export the edited PDF.
- **Images → PDF** – Convert image sets to multi-page PDFs with layout presets, automatic PNG integrity repair, and fit/fill/center modes.
- **Compression** – Reduce PDF file size with three quality presets (High/Balanced/Smallest) using canvas-based downscaling and JPEG re-encoding.
- **Activity Log** – Persists recent exports locally and surfaces them on the landing page for quick reference.

## Privacy

All processing happens entirely in your browser using pdf.js and pdf-lib. No files are uploaded to any server. This is a core design principle of PDF Workbench.

## Next Steps

v0.7.0 will add visual signature placement: draw, type, or upload signatures and position them on any page before exporting.
