import { PDFDateString, PasswordResponses, getDocument, version as pdfjsVersion } from "pdfjs-dist";
import { PdfLoadError } from "./pdfErrors";
const createId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `pdf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
const normalizePdfDate = (value) => {
    if (!value || typeof value !== "string") {
        return null;
    }
    const date = PDFDateString.toDateObject(value);
    return date ? date.toISOString() : null;
};
const toOptionalString = (value) => {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};
const mapPdfJsError = (reason) => {
    if (reason instanceof PdfLoadError) {
        return reason;
    }
    const name = reason?.name;
    const code = reason?.code;
    if (name === "PasswordException") {
        if (code === PasswordResponses.NEED_PASSWORD) {
            return new PdfLoadError("password-required");
        }
        if (code === PasswordResponses.INCORRECT_PASSWORD) {
            return new PdfLoadError("password-incorrect");
        }
    }
    if (name === "InvalidPDFException" || name === "FormatError") {
        return new PdfLoadError("corrupt");
    }
    if (name === "MissingPDFException") {
        return new PdfLoadError("not-found");
    }
    if (name === "UnexpectedResponseException") {
        return new PdfLoadError("missing-data");
    }
    return new PdfLoadError("unknown", reason instanceof Error ? reason.message : undefined);
};
export const loadPdfFromFile = async (file, options) => {
    const retainedData = new Uint8Array(await file.arrayBuffer());
    let password;
    // Re-attempt loading if the user provides a password after an initial failure.
    for (;;) {
        let doc = null;
        // pdf.js transfers the provided buffer into its worker, which neuters the source array.
        // Clone the retained bytes before each attempt so we can safely reuse the originals later.
        const pdfJsBytes = retainedData.slice();
        try {
            const loadingTask = getDocument({ data: pdfJsBytes, password });
            doc = await loadingTask.promise;
            let info = {};
            try {
                const metadataResult = await doc.getMetadata();
                info = metadataResult?.info ?? {};
            }
            catch (metadataError) {
                console.warn("Failed to read PDF metadata", metadataError);
            }
            let permissions = null;
            try {
                permissions = await doc.getPermissions();
            }
            catch (permissionsError) {
                console.warn("Failed to read PDF permissions", permissionsError);
            }
            let pageSize = null;
            try {
                const firstPage = await doc.getPage(1);
                const viewport = firstPage.getViewport({ scale: 1 });
                pageSize = { widthPt: viewport.width, heightPt: viewport.height };
                firstPage.cleanup();
            }
            catch (pageError) {
                console.warn("Failed to sample first page size", pageError);
            }
            const metadata = {
                title: toOptionalString(info.Title),
                author: toOptionalString(info.Author),
                subject: toOptionalString(info.Subject),
                keywords: toOptionalString(info.Keywords),
                creator: toOptionalString(info.Creator),
                producer: toOptionalString(info.Producer),
                creationDate: normalizePdfDate(info.CreationDate ?? info.Creationdate),
                modificationDate: normalizePdfDate(info.ModDate ?? info.ModificationDate),
                permissions,
                pageSize,
            };
            return {
                id: createId(),
                name: file.name,
                size: retainedData.byteLength,
                lastModified: file.lastModified,
                pageCount: doc.numPages,
                pdfVersion: pdfjsVersion,
                data: retainedData,
                metadata,
                doc,
            };
        }
        catch (error) {
            if (doc) {
                try {
                    doc.destroy();
                }
                catch (cleanupError) {
                    console.warn("Failed to cleanup PDF after error", cleanupError);
                }
            }
            const mapped = mapPdfJsError(error);
            const reason = mapped.code === "password-required" || mapped.code === "password-incorrect"
                ? mapped.code
                : null;
            if (reason && options?.requestPassword) {
                const nextPassword = await options.requestPassword(reason);
                if (nextPassword && nextPassword.trim().length > 0) {
                    password = nextPassword;
                    continue;
                }
            }
            throw mapped;
        }
    }
};
