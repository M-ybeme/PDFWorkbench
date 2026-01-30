import { sanitizeFileStem } from "./fileNames";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `pdf-source-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const timestampToken = () => new Date().toISOString().replace(/[:.]/g, "-");

export type PdfSourceOrigin = "upload" | "drag-drop" | "generated" | "url";

export type PdfSource = {
  id: string;
  origin: PdfSourceOrigin;
  name: string;
  size: number;
  lastModified: number | null;
  bytes: Uint8Array;
  password?: string | null;
};

export type ToolId =
  | "viewer"
  | "merge"
  | "split"
  | "editor"
  | "images"
  | "compression"
  | "signatures";

export type ExportResult = {
  blob: Blob;
  size: number;
  downloadName: string;
  durationMs: number;
  warnings?: string[];
  activity: {
    tool: ToolId;
    operation: string;
    sourceCount: number;
    detail?: string;
  };
};

export const createPdfSourceFromFile = async (
  file: File,
  origin: PdfSourceOrigin = "upload",
): Promise<PdfSource> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    id: createId(),
    origin,
    name: file.name,
    size: bytes.byteLength,
    lastModified: Number.isFinite(file.lastModified) ? file.lastModified : null,
    bytes,
    password: null,
  };
};

const normalizeExtension = (extension: string) => {
  if (!extension) {
    return "pdf";
  }

  return extension.replace(/^\./, "").toLowerCase();
};

const safeOperationStem = (operation: string) => {
  const stem = sanitizeFileStem(operation, "export");
  return stem || "export";
};

export const buildDownloadName = (baseName: string, operation: string, extension = "pdf") => {
  const stem = sanitizeFileStem(baseName || "document", "document");
  const opStem = safeOperationStem(operation);
  const ext = normalizeExtension(extension);
  return `${stem}.${opStem}.${timestampToken()}.${ext}`;
};

export const buildDownloadNameFromSources = (
  sources: PdfSource[],
  operation: string,
  extension = "pdf",
) => {
  const firstName = sources[0]?.name ?? "document.pdf";
  return buildDownloadName(firstName, operation, extension);
};
