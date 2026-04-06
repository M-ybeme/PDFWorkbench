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
    version: "",
    eta: "Viewer · Live",
    path: "viewer",
    status: "live",
  },
  {
    id: "merge",
    label: "Merge",
    summary: "Stack, reorder, and download merged PDFs directly in the browser.",
    version: "",
    eta: "Merge workspace · Live",
    path: "merge",
    status: "live",
  },
  {
    id: "split",
    label: "Split",
    summary:
      "Preview every page as a tile, build custom selections, and export presets or bundles instantly.",
    version: "",
    eta: "Split presets · Live",
    path: "split",
    status: "live",
  },
  {
    id: "editor",
    label: "Page Editor",
    summary: "Reorder, rotate, delete, and undo page edits from a thumbnail-first workspace.",
    version: "",
    eta: "Page editor · Live",
    path: "editor",
    status: "live",
  },
  {
    id: "images",
    label: "Images → PDF",
    summary:
      "Drag in image sets, auto-repair PNGs, mix fit modes, and create multi-page PDFs instantly.",
    version: "",
    eta: "Images workspace · Live",
    path: "images",
    status: "live",
  },
  {
    id: "compression",
    label: "Compression",
    summary:
      "Canvas-based compression that rasterizes pages at reduced resolution with JPEG re-encoding for smaller files.",
    version: "",
    eta: "Compression · Live",
    path: "compression",
    status: "live",
  },
  {
    id: "signatures",
    label: "Signatures",
    summary: "Draw, type, upload, then drag precise visual signatures onto any page.",
    version: "",
    eta: "Signatures · Live",
    path: "signatures",
    status: "live",
  },
  {
    id: "pdf-to-images",
    label: "PDF → Images",
    summary: "Export PDF pages as PNG or JPEG images, individually or bundled as a ZIP.",
    version: "",
    eta: "PDF to Images · Live",
    path: "pdf-to-images",
    status: "live",
  },
];
