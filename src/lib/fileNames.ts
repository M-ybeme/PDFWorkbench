export type NamedFile = {
  fileName: string;
};

const sanitize = (value: string) =>
  value
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const fallbackStem = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0, 10)}`;

const timestampToken = () => new Date().toISOString().replace(/[:.]/g, "-");

export const sanitizeFileStem = (value: string, fallbackPrefix = "document") => {
  const sanitized = sanitize(value);
  return sanitized || fallbackStem(fallbackPrefix);
};

export const buildMergedFileName = (items: NamedFile[]) => {
  const firstItem = items[0];
  const stem = firstItem
    ? sanitizeFileStem(firstItem.fileName, "merged")
    : fallbackStem("merged");
  return `${stem}-${items.length}files-${timestampToken()}.pdf`;
};

export const buildSplitSelectionFileName = (sourceName: string, descriptor: string) => {
  const stem = sanitizeFileStem(sourceName, "split");
  const descriptorStem = sanitizeFileStem(descriptor, "selection");
  return `${stem}-${descriptorStem}-${timestampToken()}.pdf`;
};

export const buildSplitSliceFileName = (
  sourceName: string,
  startPage: number,
  endPage: number,
  index: number,
) => {
  const stem = sanitizeFileStem(sourceName, "split");
  const safeStart = Math.max(1, Math.min(startPage, endPage));
  const safeEnd = Math.max(safeStart, Math.max(startPage, endPage));
  return `${stem}-part-${index + 1}-${safeStart}to${safeEnd}.pdf`;
};

export const buildSplitZipFileName = (sourceName: string) => {
  const stem = sanitizeFileStem(sourceName, "split");
  return `${stem}-bundle-${timestampToken()}.zip`;
};
