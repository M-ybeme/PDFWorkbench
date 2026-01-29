export type PdfErrorCode =
  | "password-required"
  | "password-incorrect"
  | "corrupt"
  | "missing-data"
  | "not-found"
  | "unsupported"
  | "unknown";

const DEFAULT_MESSAGES: Record<PdfErrorCode, string> = {
  "password-required": "This PDF is locked with a password. Unlock it first before uploading.",
  "password-incorrect": "The password provided for this PDF is incorrect.",
  corrupt: "The file appears to be corrupted or is not a valid PDF.",
  "missing-data": "We could not access the PDF data. Try downloading it locally before uploading.",
  "not-found": "We could not locate the PDF file to open it.",
  unsupported: "This PDF uses features we do not support yet.",
  unknown: "We couldn't open that PDF. Please try another file.",
};

export class PdfLoadError extends Error {
  code: PdfErrorCode;

  constructor(code: PdfErrorCode, message?: string) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "PdfLoadError";
    this.code = code;
  }
}

export const getFriendlyPdfError = (reason: unknown): string => {
  if (reason instanceof PdfLoadError) {
    return reason.message;
  }

  if (reason instanceof Error && reason.message) {
    return reason.message;
  }

  return DEFAULT_MESSAGES.unknown;
};

export const wrapPdfLoadError = (reason: unknown, fallback: PdfErrorCode = "unknown") => {
  if (reason instanceof PdfLoadError) {
    return reason;
  }

  return new PdfLoadError(fallback, reason instanceof Error ? reason.message : undefined);
};
