import type { LoadedPdf } from "./pdfLoader";

export type PdfThumbnail = {
  pageNumber: number;
  dataUrl: string;
};

export type RenderThumbnailsOptions = {
  scale: number;
  signal?: AbortSignal;
};

// Races `promise` against `signal` so a pdf.js call that may never settle on
// its own — getPage() can abandon its promise capability outright if the
// document's worker is terminated mid-request — can't hang the generator
// forever. The rejection reason is never inspected by callers; they only
// check `signal.aborted` afterward, so it doesn't need to carry information.
const withAbort = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) {
    return promise;
  }

  // If `promise` loses the race and later settles on its own, swallow a
  // rejection so it doesn't surface as an unhandled promise rejection.
  promise.catch(() => {});

  if (signal.aborted) {
    return Promise.reject(new Error("Aborted"));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("Aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
};

/**
 * Renders every page of `pdf` to a PNG data URL, yielding each thumbnail as
 * soon as it's ready so callers can update UI progressively instead of
 * waiting for the whole document. Stops silently (without yielding or
 * throwing) once `signal` is aborted, rather than surfacing a "cancelled"
 * error — callers that abort mid-render (a new PDF loaded, or unmount) don't
 * want that treated as a failure.
 *
 * `signal` is expected to come from the document's own lifecycle (e.g.
 * `useLoadedPdf()`'s `pdfLifecycle`) rather than a signal scoped only to the
 * caller's own effect — it must abort no later than the moment `pdf.doc`
 * itself becomes invalid, since a page or render task obtained after that
 * point may hang or throw in ways this function can't distinguish from a
 * genuine failure.
 */
export async function* renderThumbnails(
  pdf: LoadedPdf,
  { scale, signal }: RenderThumbnailsOptions,
): AsyncGenerator<PdfThumbnail> {
  for (let pageNumber = 1; pageNumber <= pdf.pageCount; pageNumber += 1) {
    if (signal?.aborted) {
      return;
    }

    let page;
    try {
      page = await withAbort(pdf.doc.getPage(pageNumber), signal);
    } catch (getPageError) {
      if (signal?.aborted) {
        return;
      }
      throw getPageError;
    }

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      page.cleanup();
      continue;
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderTask = page.render({ canvas, canvasContext: context, viewport });
    // A cancelled render task rejects renderTask.promise — proactively
    // cancelling rather than waiting on the document's own teardown to
    // eventually reject it keeps "the document was replaced" from racing
    // against "the render genuinely failed".
    const cancelOnAbort = () => renderTask.cancel();
    signal?.addEventListener("abort", cancelOnAbort, { once: true });

    try {
      await renderTask.promise;
    } catch (renderError) {
      if (signal?.aborted) {
        return;
      }
      throw renderError;
    } finally {
      signal?.removeEventListener("abort", cancelOnAbort);
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
