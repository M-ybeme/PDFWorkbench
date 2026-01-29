const sanitize = (value) => value
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
const fallbackStem = (prefix) => `${prefix}-${new Date().toISOString().slice(0, 10)}`;
const timestampToken = () => new Date().toISOString().replace(/[:.]/g, "-");
export const sanitizeFileStem = (value, fallbackPrefix = "document") => {
    const sanitized = sanitize(value);
    return sanitized || fallbackStem(fallbackPrefix);
};
export const buildMergedFileName = (items) => {
    const firstItem = items[0];
    const stem = firstItem ? sanitizeFileStem(firstItem.fileName, "merged") : fallbackStem("merged");
    return `${stem}-${items.length}files-${timestampToken()}.pdf`;
};
export const buildSplitSelectionFileName = (sourceName, descriptor) => {
    const stem = sanitizeFileStem(sourceName, "split");
    const descriptorStem = sanitizeFileStem(descriptor, "selection");
    return `${stem}-${descriptorStem}-${timestampToken()}.pdf`;
};
export const buildSplitSliceFileName = (sourceName, startPage, endPage, index) => {
    const stem = sanitizeFileStem(sourceName, "split");
    const safeStart = Math.max(1, Math.min(startPage, endPage));
    const safeEnd = Math.max(safeStart, Math.max(startPage, endPage));
    return `${stem}-part-${index + 1}-${safeStart}to${safeEnd}.pdf`;
};
export const buildSplitZipFileName = (sourceName) => {
    const stem = sanitizeFileStem(sourceName, "split");
    return `${stem}-bundle-${timestampToken()}.zip`;
};
export const buildEditedPdfFileName = (sourceName) => {
    const stem = sanitizeFileStem(sourceName, "edited");
    return `${stem}-page-editor-${timestampToken()}.pdf`;
};
export const buildImagesPdfFileName = (primaryName, imageCount) => {
    const stem = primaryName
        ? sanitizeFileStem(primaryName, "images")
        : fallbackStem("images-to-pdf");
    return `${stem}-${Math.max(1, imageCount)}images-${timestampToken()}.pdf`;
};
