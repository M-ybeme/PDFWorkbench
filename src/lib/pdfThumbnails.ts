import type { LoadedPdf } from "./pdfLoader";

export type PdfThumbnail = {
  pageNumber: number;
  dataUrl: string;
};

export type RenderThumbnailsOptions = {
  scale: number;
  signal?: AbortSignal;
};

/**
 * Renders every page of `pdf` to a PNG data URL, yielding each thumbnail as
 * soon as it's ready so callers can update UI progressively instead of
 * waiting for the whole document. Stops silently (without yielding or
 * throwing) once `signal` is aborted, rather than surfacing a "cancelled"
 * error — callers that abort mid-render (a new PDF loaded, or unmount) don't
 * want that treated as a failure.
 */
export async function* renderThumbnails(
  pdf: LoadedPdf,
  { scale, signal }: RenderThumbnailsOptions,
): AsyncGenerator<PdfThumbnail> {
  for (let pageNumber = 1; pageNumber <= pdf.pageCount; pageNumber += 1) {
    if (signal?.aborted) {
      return;
    }

    const page = await pdf.doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      page.cleanup();
      continue;
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    try {
      const renderTask = page.render({ canvas, canvasContext: context, viewport });
      await renderTask.promise;
    } finally {
      // Always release the page's temporary render resources, including on
      // a failed render — the pre-extraction implementations skipped this
      // on failure, leaking the page until GC.
      page.cleanup();
    }

    if (signal?.aborted) {
      return;
    }

    yield { pageNumber, dataUrl: canvas.toDataURL("image/png") };
  }
}
