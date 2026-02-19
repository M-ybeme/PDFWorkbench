import { sanitizeFileStem } from "./fileNames";
const createId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `pdf-source-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
const timestampToken = () => new Date().toISOString().replace(/[:.]/g, "-");
export const createPdfSourceFromFile = async (file, origin = "upload") => {
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
const normalizeExtension = (extension) => {
    if (!extension) {
        return "pdf";
    }
    return extension.replace(/^\./, "").toLowerCase();
};
const safeOperationStem = (operation) => {
    const stem = sanitizeFileStem(operation, "export");
    return stem || "export";
};
export const buildDownloadName = (baseName, operation, extension = "pdf") => {
    const stem = sanitizeFileStem(baseName || "document", "document");
    const opStem = safeOperationStem(operation);
    const ext = normalizeExtension(extension);
    return `${stem}.${opStem}.${timestampToken()}.${ext}`;
};
export const buildDownloadNameFromSources = (sources, operation, extension = "pdf") => {
    const firstName = sources[0]?.name ?? "document.pdf";
    return buildDownloadName(firstName, operation, extension);
};
