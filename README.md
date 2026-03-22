# PDF Workbench

A complete client-side PDF toolkit built with React + TypeScript. View, merge, split, edit pages, convert images to PDF, compress, sign, and export pages as images — all without uploading files to a server. **Files are processed locally in your browser and are not uploaded by this application.**

> Current release: **v0.9.0** · See [CHANGELOG.md](CHANGELOG.md) for what's new.

---

## Tools

| Tool             | Version | What it does                                                                                                                   |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **PDF Viewer**   | 0.2.x   | Drag/drop loader, thumbnail rail, zoom controls, text search (Ctrl+F), metadata inspector, password-prompt support             |
| **Merge**        | 0.3.x   | Stack any number of PDFs, drag to reorder, download the merged result in one click                                             |
| **Split**        | 0.3.x   | Select individual pages or use presets (every N, odd/even), export as a single PDF or ZIP bundle                               |
| **Page Editor**  | 0.4.x   | Drag-to-reorder, rotate ±90°, delete pages, undo history, then export                                                          |
| **Images → PDF** | 0.5.x   | Convert image sets (JPEG/PNG/WebP/GIF/BMP) to a multi-page PDF with layout presets and automatic PNG repair                    |
| **Compression**  | 0.6.x   | Reduce file size with three quality presets (High/Balanced/Smallest) via canvas rasterisation + JPEG re-encoding               |
| **Signatures**   | 0.7.x   | Draw, type, or upload a signature; drag/resize onto any page; add text blocks and freehand pen strokes; export a flattened PDF |
| **PDF → Images** | 0.8.x   | Export each page as PNG or JPEG at 1×/2×/3× scale, download individually or as a ZIP archive                                   |

---

## Privacy

All processing runs entirely in your browser using [pdf.js](https://mozilla.github.io/pdf.js/) and [pdf-lib](https://pdf-lib.js.org/). Files are processed locally and are not uploaded by this application. Security depends on the user's browser, device, and installed extensions. This is a core design principle of PDF Workbench.

---

## Getting Started

```bash
npm install
npm run dev        # http://localhost:5173
```

---

## Scripts

| Command              | Description                                 |
| -------------------- | ------------------------------------------- |
| `npm run dev`        | Start Vite dev server                       |
| `npm run build`      | Type-check + build production bundle        |
| `npm run preview`    | Preview the production build locally        |
| `npm run lint`       | ESLint with TypeScript + React + a11y rules |
| `npm run test`       | Vitest unit test suite                      |
| `npm run test:watch` | Vitest in watch mode                        |
| `npm run test:e2e`   | Playwright end-to-end tests                 |
| `npm run format`     | Prettier over all supported files           |

---

## Tech Stack

- **React 18** + **React Router 6** (lazy-loaded tool routes)
- **TypeScript 5** strict mode + **Vite 5**
- **pdf.js** (pdfjs-dist) for PDF rendering
- **pdf-lib** for PDF creation and manipulation
- **JSZip** for ZIP bundling
- **Zustand** for lightweight global UI state (theme, nav, activity log)
- **Tailwind CSS 3** with a custom dual-theme design system
- **Vitest** + **React Testing Library** for unit/component tests
- **Playwright** for end-to-end browser tests
- **ESLint** (TypeScript + React + jsx-a11y) + **Prettier**
- **GitHub Actions** CI + **Netlify** deployment

---

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — version history
- [CONTRIBUTING.md](CONTRIBUTING.md) — development guide and contribution workflow
- [NOTICE](NOTICE) — required attribution notices (Apache 2.0 compliance)
- [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) — full open-source license texts (pdf.js, pdf-lib, JSZip, React, React Router, Zustand, Tailwind, Vite)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — codebase structure and design decisions
- [docs/PDFWORKBENCH_ROADMAP.md](docs/PDFWORKBENCH_ROADMAP.md) — full development plan through v1.0
- [docs/DOCUMENT_PIPELINE_CONTRACT.md](docs/DOCUMENT_PIPELINE_CONTRACT.md) — shared ingest/export type contract

---

## Legal

- **Signatures** — Signatures produced by this tool are visual annotations only. They are not cryptographically secured, identity-verified, or compliant with electronic signature laws such as the ESIGN Act or UETA.
- **Privacy** — Files are processed locally in your browser and are not uploaded by this application. Files may persist in browser memory or your downloads folder depending on user actions. Security depends on the user's browser, device, and installed extensions. Netlify hosting may collect anonymous access logs.
- **Liability** — Users are responsible for the content they process. PDF Workbench does not store or review files. To the maximum extent permitted by law, this application is provided without liability for any damages arising from its use.
- **Standards** — PDF Workbench operates on the ISO 32000 PDF standard using open-source libraries. It is not affiliated with or endorsed by Adobe Inc.
