import { PDFDateString, PasswordResponses, getDocument, version as pdfjsVersion } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

import { createPdfSourceFromFile, type PdfSource } from "./documentPipeline";
import { PdfLoadError, type PdfErrorCode } from "./pdfErrors";

export type PdfDocumentMetadata = {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string | null;
  modificationDate?: string | null;
  permissions?: number[] | null;
  pageSize?: {
    widthPt: number;
    heightPt: number;
  } | null;
};

export type LoadedPdf = {
  sourceId?: string;
  id: string;
  name: string;
  size: number;
  lastModified: number;
  pageCount: number;
  pdfVersion: string;
  data: Uint8Array;
  metadata: PdfDocumentMetadata;
  doc: PDFDocumentProxy;
};

export type PdfPasswordReason = Extract<PdfErrorCode, "password-required" | "password-incorrect">;
export type PdfPasswordRequest = (reason: PdfPasswordReason) => Promise<string | null>;

export type LoadPdfOptions = {
  requestPassword?: PdfPasswordRequest;
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `pdf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizePdfDate = (value: unknown): string | null => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const date = PDFDateString.toDateObject(value);
  return date ? date.toISOString() : null;
};

const toOptionalString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const mapPdfJsError = (reason: unknown): PdfLoadError => {
  if (reason instanceof PdfLoadError) {
    return reason;
  }

  const name = (reason as { name?: string })?.name;
  const code = (reason as { code?: number })?.code;

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

export const loadPdfFromSource = async (
  source: PdfSource,
  options?: LoadPdfOptions,
): Promise<LoadedPdf> => {
  let password = source.password ?? undefined;

  for (;;) {
    let doc: PDFDocumentProxy | null = null;
    const retainedData = source.bytes;
    const pdfJsBytes = retainedData.slice();

    try {
      const loadingTask = getDocument({ data: pdfJsBytes, password });
      doc = await loadingTask.promise;
      let info: Record<string, unknown> = {};
      try {
        const metadataResult = await doc.getMetadata();
        info = (metadataResult?.info as Record<string, unknown>) ?? {};
      } catch (metadataError) {
        console.warn("Failed to read PDF metadata", metadataError);
      }

      let permissions: number[] | null = null;
      try {
        permissions = await doc.getPermissions();
      } catch (permissionsError) {
        console.warn("Failed to read PDF permissions", permissionsError);
      }

      let pageSize: { widthPt: number; heightPt: number } | null = null;
      try {
        const firstPage = await doc.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        pageSize = { widthPt: viewport.width, heightPt: viewport.height };
        firstPage.cleanup();
      } catch (pageError) {
        console.warn("Failed to sample first page size", pageError);
      }

      const metadata: PdfDocumentMetadata = {
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

      source.password = password ?? null;

      return {
        sourceId: source.id,
        id: createId(),
        name: source.name,
        size: retainedData.byteLength,
        lastModified: source.lastModified ?? Date.now(),
        pageCount: doc.numPages,
        pdfVersion: pdfjsVersion,
        data: retainedData,
        metadata,
        doc,
      };
    } catch (error) {
      if (doc) {
        try {
          doc.destroy();
        } catch (cleanupError) {
          console.warn("Failed to cleanup PDF after error", cleanupError);
        }
      }

      const mapped = mapPdfJsError(error);
      const reason =
        mapped.code === "password-required" || mapped.code === "password-incorrect"
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

export const loadPdfFromFile = async (file: File, options?: LoadPdfOptions): Promise<LoadedPdf> => {
  const source = await createPdfSourceFromFile(file);
  return loadPdfFromSource(source, options);
};
