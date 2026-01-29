# PDF Workbench

Foundational React + TypeScript front-end that will power the PDF Workbench toolkit described in `PDFWORKBENCH_ROADMAP.md`.

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

## Next Steps

Follow the roadmap milestones beginning with 0.2.0 (PDF Viewer MVP) after validating that the 0.1.0 foundation deploys successfully on Netlify.
