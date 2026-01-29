# PDF Workbench

Foundational React + TypeScript front-end that now ships a polished landing experience, a PDF viewer, merge and split workspaces, plus an activity log so you can keep tabs on recent exports. See `docs/PDFWORKBENCH_ROADMAP.md` for the long-term plan.

## Scripts

- `npm install` – install dependencies
- `npm run dev` – start Vite dev server
- `npm run build` – type check and build production bundle
- `npm run preview` – preview production build
- `npm run lint` – run ESLint with TypeScript/React rules
- `npm run test` – execute Vitest test suite
- `npm run format` – format all supported files with Prettier

## Tech Stack

- React 18 + React Router 6
- TypeScript 5 with strict settings and Vite 5
- Zustand for lightweight global UI state (theme, shell toggles)
- Tailwind CSS 3 with a custom dual-theme design system
- Vitest + React Testing Library for fast, component-level tests
- ESLint + Prettier for linting/formatting consistency
- GitHub Actions CI + Netlify deployment scaffold for automation

## Current Tools

- **PDF Viewer** – Drag/drop loader with password prompts, zoom controls, thumbnail rail, metadata browser, and cached canvas renderer.
- **Merge Workspace** – Stack PDFs from memory, reorder them, and download a merged artifact with consistent naming.
- **Split Workspace** – Render interactive thumbnails, toggle selections, and export either the curated set or preset slices (bundled in ZIPs).
- **Activity Log** – Persists the last dozen merge/split exports locally and surfaces them on the landing page for quick reference.

## Next Steps

Follow the roadmap milestones in `docs/PDFWORKBENCH_ROADMAP.md`, starting with the 0.2.x viewer refinements and building toward the editor, compression, and signature flows.
