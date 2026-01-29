import { PDFDocument } from "pdf-lib";
import { PdfLoadError } from "./pdfErrors";
export const mergeLoadedPdfs = async (documents) => {
    if (documents.length < 2) {
        throw new PdfLoadError("unsupported", "Need at least two PDFs to merge.");
    }
    try {
        const output = await PDFDocument.create();
        for (const document of documents) {
            const source = await PDFDocument.load(document.data);
            const copiedPages = await output.copyPages(source, source.getPageIndices());
            copiedPages.forEach((page) => output.addPage(page));
        }
        return output.save();
    }
    catch (error) {
        throw new PdfLoadError("unknown", error instanceof Error ? error.message : undefined);
    }
};
export const mergeLoadedPdfsToBlob = async (documents) => {
    const mergedBytes = await mergeLoadedPdfs(documents);
    return new Blob([mergedBytes], { type: "application/pdf" });
};
