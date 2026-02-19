# Contributing to PDF Workbench

Thanks for your interest in contributing. This guide covers everything you need to get the project running locally, understand the codebase, and submit quality changes.

---

## Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later (comes with Node)
- A Chromium-based browser (for Playwright E2E tests)

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/M-ybeme/PDFWorkbench.git
cd PDFWorkbench

# 2. Install dependencies
npm install

# 3. Install Playwright browsers (first time only)
npx playwright install chromium

# 4. Start the dev server
npm run dev
# → http://localhost:5173
```

---

## Scripts

| Command              | When to use                                   |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Local development                             |
| `npm run build`      | Verify the production build passes type-check |
| `npm run lint`       | Check ESLint rules (runs in CI)               |
| `npm run test`       | Run unit tests                                |
| `npm run test:watch` | Unit tests in watch mode while developing     |
| `npm run test:e2e`   | Full Playwright E2E suite                     |
| `npm run format`     | Auto-format with Prettier                     |

---

## Code Style

- **TypeScript strict mode** is enforced. No `any`, no implicit returns.
- **ESLint** is configured with `@typescript-eslint/recommended`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `eslint-plugin-jsx-a11y`. Zero warnings policy (`--max-warnings 0`).
- **Prettier** handles all formatting. Run `npm run format` before committing, or configure your editor to format on save.
- Imports are not auto-sorted, but keep them grouped: external packages first, then `../` internal imports.

---

## Architecture Overview

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a full description of the directory structure, data flow, and key modules.

Short version:

- **`src/lib/`** — pure functions for PDF operations (no React)
- **`src/pages/`** — one component per tool, owns local state, calls `lib/`
- **`src/components/`** — shared UI (AppShell, Alert, Button, DropZone, modals)
- **`src/hooks/`** — custom React hooks
- **`src/state/`** — Zustand stores (UI state + activity log)
- **`src/data/`** — static records (tool routes, help modal content)

---

## Adding a New Tool

Follow this checklist to add a tool page cleanly:

1. **`src/data/toolRoutes.ts`** — add an entry with `id`, `label`, `summary`, `version`, `path`, `status: "live"`.
2. **`src/pages/YourToolPage.tsx`** — create the page component. Use `useDragDrop` for file ingest, `Alert` for errors, `ExportResult` + `logExportResult` for downloads.
3. **`src/data/toolHelp.ts`** — add a `ToolHelpContent` entry under the same `id`. This populates the `?` help modal in the sidebar.
4. **`src/router.tsx`** — add a `lazy(() => import(...))` import and wire it into the route map.
5. **`src/lib/yourTool.ts`** — add pure processing functions. Keep React out of `lib/`.
6. **`src/lib/yourTool.test.ts`** — unit tests for the processing logic.
7. **`playwright/yourTool.spec.ts`** — at least one E2E test: upload a file, trigger the operation, verify the download.

---

## Testing Requirements

Every pull request should:

- Keep all existing **unit tests** passing (`npm run test`)
- Keep all existing **E2E tests** passing (`npm run test:e2e`)
- Add unit tests for any new `src/lib/` functions
- Add at least one E2E test for any new tool page or significant new workflow

Writing E2E tests: look at an existing spec (e.g., `playwright/merge.spec.ts`) for the pattern. Tests build real PDFs with `pdf-lib`, upload them via `setInputFiles`, and verify both the UI feedback and the downloaded output bytes.

---

## Accessibility

PDF Workbench targets **WCAG 2.1 AA**. When adding UI:

- All interactive elements must be keyboard-reachable and have a visible focus ring
- Buttons must have a discernible name (`aria-label` if icon-only)
- Form inputs must be associated with a `<label>` via `htmlFor` — do not add `aria-label` to the `<label>` itself
- Modals must use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `useFocusTrap`
- Errors must use `<Alert variant="error">` (which carries `role="alert"`) rather than a plain `<p>`

---

## Pull Request Guidelines

1. **Branch from `main`**, use a short descriptive name (`feat/pdf-watermark`, `fix/split-zip-name`).
2. **Keep PRs focused** — one feature or bug fix per PR.
3. **Write a clear PR description** explaining what changed and why.
4. **All CI checks must pass** before merging (lint, unit tests, build).
5. E2E tests run locally; include a note in the PR if you've verified them.
6. For significant architectural changes, update `docs/ARCHITECTURE.md` alongside the code.

---

## Commit Messages

Use the imperative mood and be specific:

```
Add ZIP bundling for split presets
Fix PNG integrity repair fallback for Safari
Update Compression page to use shared Alert component
```

No need for a formal convention prefix (`feat:`, `fix:`) unless you prefer it.
