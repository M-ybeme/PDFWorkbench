export type ToolRoute = {
  id: string;
  label: string;
  summary: string;
  version: string;
  eta: string;
  path: string;
  status: "live" | "upcoming";
};

export const toolRoutes: ToolRoute[] = [
  {
    id: "viewer",
    label: "PDF Viewer",
    summary:
      "Upload PDFs, navigate pages, zoom, and inspect file metadata with a lightweight canvas renderer.",
    version: "0.2.x",
    eta: "Viewer · Live",
    path: "viewer",
    status: "live",
  },
  {
    id: "merge",
    label: "Merge",
    summary: "Stack, reorder, and download merged PDFs directly in the browser.",
    version: "0.3.x",
    eta: "Merge workspace · Live",
    path: "merge",
    status: "live",
  },
  {
    id: "split",
    label: "Split",
    summary:
      "Preview every page as a tile, build custom selections, and export presets or bundles instantly.",
    version: "0.3.x",
    eta: "Split presets · Live",
    path: "split",
    status: "live",
  },
  {
    id: "editor",
    label: "Page Editor",
    summary: "Reorder, rotate, delete, and undo page edits from a thumbnail-first workspace.",
    version: "0.4.x",
    eta: "Page editor · Live",
    path: "editor",
    status: "live",
  },
  {
    id: "images",
    label: "Images → PDF",
    summary:
      "Drag in image sets, auto-repair PNGs, mix fit modes, and create multi-page PDFs instantly.",
    version: "0.5.x",
    eta: "Images workspace · Live",
    path: "images",
    status: "live",
  },
  {
    id: "compression",
    label: "Compression",
    summary:
      "Canvas-based compression that rasterizes pages at reduced resolution with JPEG re-encoding for smaller files.",
    version: "0.6.x",
    eta: "Compression · Live",
    path: "compression",
    status: "live",
  },
  {
    id: "signatures",
    label: "Signatures",
    summary: "Draw, type, and place signatures with precise coordinate mapping.",
    version: "0.7.x",
    eta: "Signatures · Later",
    path: "signatures",
    status: "upcoming",
  },
];
