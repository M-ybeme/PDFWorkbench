import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { PdfLoadError } from "./pdfErrors";
const cloneToArrayBuffer = (source) => {
    const buffer = new ArrayBuffer(source.byteLength);
    new Uint8Array(buffer).set(source);
    return buffer;
};
const normalizePages = (pageNumbers, pageCount) => {
    const sanitized = Array.from(new Set(pageNumbers
        .map((page) => Math.trunc(page))
        .filter((page) => page >= 1 && page <= pageCount))).sort((a, b) => a - b);
    if (sanitized.length === 0) {
        throw new PdfLoadError("unsupported", "Select at least one valid page before splitting.");
    }
    return sanitized;
};
const loadSourceDocument = async (pdf) => {
    try {
        return await PDFDocument.load(pdf.data);
    }
    catch (error) {
        throw new PdfLoadError("unknown", error instanceof Error ? error.message : undefined);
    }
};
export const extractPagesFromLoadedPdf = async (pdf, pageNumbers) => {
    const selection = normalizePages(pageNumbers, pdf.pageCount);
    const source = await loadSourceDocument(pdf);
    try {
        const output = await PDFDocument.create();
        const copiedPages = await output.copyPages(source, selection.map((page) => page - 1));
        copiedPages.forEach((page) => output.addPage(page));
        return await output.save();
    }
    catch (error) {
        throw new PdfLoadError("unknown", error instanceof Error ? error.message : undefined);
    }
};
export const splitPdfByChunkSize = async (pdf, chunkSize) => {
    if (!Number.isFinite(chunkSize) || chunkSize < 1) {
        throw new PdfLoadError("unsupported", "Chunk size must be at least one page.");
    }
    const source = await loadSourceDocument(pdf);
    try {
        const chunks = [];
        let index = 0;
        for (let start = 0; start < pdf.pageCount; start += chunkSize) {
            const end = Math.min(pdf.pageCount, start + chunkSize);
            const copyingIndices = Array.from({ length: end - start }, (_, offset) => start + offset);
            const chunkDoc = await PDFDocument.create();
            const copiedPages = await chunkDoc.copyPages(source, copyingIndices);
            copiedPages.forEach((page) => chunkDoc.addPage(page));
            const bytes = await chunkDoc.save();
            chunks.push({ index, startPage: start + 1, endPage: end, bytes });
            index += 1;
        }
        return chunks;
    }
    catch (error) {
        throw new PdfLoadError("unknown", error instanceof Error ? error.message : undefined);
    }
};
export const buildZipFromEntries = async (entries) => {
    if (entries.length === 0) {
        throw new PdfLoadError("unsupported", "There are no split documents to bundle.");
    }
    try {
        const zip = new JSZip();
        entries.forEach((entry) => {
            zip.file(entry.fileName, entry.bytes);
        });
        const archive = await zip.generateAsync({ type: "uint8array" });
        // Copy into a standalone ArrayBuffer so Blob never sees a SharedArrayBuffer-backed view.
        return cloneToArrayBuffer(archive);
    }
    catch (error) {
        throw new PdfLoadError("unknown", error instanceof Error ? error.message : undefined);
    }
};
