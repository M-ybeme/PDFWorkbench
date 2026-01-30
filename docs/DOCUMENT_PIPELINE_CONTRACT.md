# Document Pipeline Contract

This contract describes the shared shapes and lifecycle every workspace must follow when ingesting, transforming, and exporting PDFs. It builds on the `LoadedPdf` type from `src/lib/pdfLoader.ts` and adds two companion types—`PdfSource` and `ExportResult`—so tools can share guardrails, logging, and download naming rules.

## Core Types

```ts
/** Raw file details before pdf.js has parsed anything. */
export type PdfSource = {
  id: string; // mirrors FileSystem handle or upload batch id
  origin: "upload" | "drag-drop" | "generated" | "url";
  name: string;
  size: number; // bytes
  lastModified?: number | null;
  bytes: Uint8Array; // immutable copy stored in IndexedDB/memory
  password?: string | null; // last provided password, if any
};

/** Already parsed PDF with metadata + pdf.js proxy (lives in memory/workers). */
export type LoadedPdf = {
  sourceId: PdfSource["id"];
  id: string; // existing random UUID
  name: string;
  size: number;
  lastModified: number;
  pageCount: number;
  pdfVersion: string;
  data: Uint8Array; // retained bytes
  metadata: PdfDocumentMetadata;
  doc: PDFDocumentProxy;
};

/** Standard export payload returned by any workspace action. */
export type ExportResult = {
  blob: Blob;
  size: number; // bytes
  downloadName: string; // e.g., `${baseName}.compressed.${timestamp}.pdf`
  durationMs: number;
  warnings?: string[]; // oversized, skipped vector compression, etc.
  activity: {
    tool: ToolId; // merge | split | editor | images | compression | signatures
    operation: string; // e.g., "compress-balanced"
    sourceCount: number;
  };
};
```

## Lifecycle

1. **Ingest** — Build a `PdfSource` for each incoming file and enqueue size/page-count checks before loading to pdf.js. Guardrails: block files over the configured cap, queue warnings for borderline cases, and surface password prompts through `PdfPasswordRequest`.
2. **Load** — Pass `PdfSource.bytes` into `loadPdfFromFile` (or equivalent) to yield a `LoadedPdf`. Persist the one-to-one mapping `LoadedPdf.sourceId → PdfSource.id` for logging.
3. **Workspace state** — Workspaces (merge, split, editor, compression, etc.) should operate solely on `LoadedPdf` references and pure derived state (thumbnails, edit instructions). They should never mutate the retained bytes in place.
4. **Export** — When a workflow completes, return an `ExportResult`. Apply consistent naming (`${originalBase}.${operation}.${YYYYMMDD-HHmmss}.pdf` or `.zip`) and push the record into the activity log for the landing-page recap.
5. **Cleanup** — Destroy `PDFDocumentProxy` instances and revoke object URLs after export or when closing a workspace to keep memory predictable.

## Shared Guardrails & Telemetry Hooks

- **Size/Page Caps:** `PdfSource` creation is the single place to enforce limits. Expose user-facing thresholds (e.g., 250MB or 1,000 pages) and provide actionable messages when exceeded.
- **Abort/Cancellation:** Pass an `AbortSignal` through load/merge/split/compress helpers so users can cancel long-running image operations. Export helpers must listen for `signal.aborted` and reject with a typed `PdfOperationAborted` error.
- **Activity Log:** `ExportResult.activity` feeds directly into `useActivityLog`. Always supply a short `operation` code so analytics, telemetry, and the landing page can summarize recent actions consistently.
- **Error Taxonomy:** Map low-level failures into the codes documented in `docs/PDFWORKBENCH_ROADMAP.md` (password-required, corrupt, oversized, unsupported-encryption, render-failed). Surfacing identical codes across tools keeps UI copy and tests reusable.
- **Download Naming:** Derive `downloadName` from `PdfSource.name` (first file for single-source operations, shared prefix + operation for multi-source). Append the operation and UTC timestamp so repeated downloads are unique but predictable.

## Adoption Plan

1. **State Stores:** Update `pdfAssets` Zustand store to track `PdfSource` records alongside `LoadedPdf` entries.
2. **Lib Helpers:** Update merge/split/editor/images/compression helpers to accept `{ sources, abortSignal }` objects and to return `ExportResult` instead of raw `Blob`s.
3. **Activity Log:** Replace ad-hoc calls to `useActivityLog` with a single `logExportResult(result: ExportResult)` helper that formats labels and details consistently.
4. **Tests:** Introduce shared fixtures for `PdfSource`, `LoadedPdf`, and `ExportResult` so unit tests can assert on guardrail behavior (oversized rejections, warning propagation, cancel support).

Documenting the contract up front keeps phase 0.6.0+ work honest about privacy guarantees (“files stay on-device”), performance limits, and download behaviors while shrinking duplicate plumbing across workspaces.
