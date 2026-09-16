import type { ToolId } from "../lib/documentPipeline";

export type { ToolId };

export type ToolRoute = {
  id: ToolId;
  label: string;
  summary: string;
  path: string;
};

export const toolRoutes: ToolRoute[] = [
  {
    id: "viewer",
    label: "PDF Viewer",
    summary:
      "Upload PDFs, navigate pages, zoom, and inspect file metadata with a lightweight canvas renderer.",
    path: "viewer",
  },
  {
    id: "merge",
    label: "Merge",
    summary: "Stack, reorder, and download merged PDFs directly in the browser.",
    path: "merge",
  },
  {
    id: "split",
    label: "Split",
    summary:
      "Preview every page as a tile, build custom selections, and export presets or bundles instantly.",
    path: "split",
  },
  {
    id: "editor",
    label: "Page Editor",
    summary: "Reorder, rotate, delete, and undo page edits from a thumbnail-first workspace.",
    path: "editor",
  },
  {
    id: "images",
    label: "Images → PDF",
    summary:
      "Drag in image sets, auto-repair PNGs, mix fit modes, and create multi-page PDFs instantly.",
    path: "images",
  },
  {
    id: "compression",
    label: "Compression",
    summary:
      "Canvas-based compression that rasterizes pages at reduced resolution with JPEG re-encoding for smaller files.",
    path: "compression",
  },
  {
    id: "signatures",
    label: "Signatures",
    summary: "Draw, type, upload, then drag precise visual signatures onto any page.",
    path: "signatures",
  },
  {
    id: "pdf-to-images",
    label: "PDF → Images",
    summary: "Export PDF pages as PNG or JPEG images, individually or bundled as a ZIP.",
    path: "pdf-to-images",
  },
];
