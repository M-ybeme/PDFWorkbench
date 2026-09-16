import { useCallback, useEffect, useRef, useState } from "react";

import { getFriendlyPdfError } from "../lib/pdfErrors";
import type { LoadedPdf } from "../lib/pdfLoader";
import { configurePdfWorker } from "../lib/pdfWorker";
import { getPdfLoaderModule } from "./pdfLoaderModule";
import { usePasswordPrompt } from "./usePasswordPrompt";

export type LoadedPdfStatus = "idle" | "loading" | "ready" | "error";

const destroySafely = (doc: LoadedPdf["doc"]) => {
  try {
    doc.destroy();
  } catch (cleanupError) {
    console.warn("Failed to release PDF document", cleanupError);
  }
};

/**
 * Owns the single-document PDF loading lifecycle shared by the tool pages:
 * loading a file (with password retry), replacing it with a new one,
 * resetting, and destroying the pdf.js document exactly once at each of
 * those transitions plus on unmount.
 *
 * Not for Merge — it holds a list of documents via the `pdfAssets` store,
 * a genuinely different shape. It reuses `usePasswordPrompt` directly
 * instead (see docs/ARCHITECTURE.md).
 */
export function useLoadedPdf() {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [status, setStatus] = useState<LoadedPdfStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const { passwordPrompt, requestPassword, submitPassword, cancelPassword } = usePasswordPrompt();

  // Mirrors `pdf` outside React's render cycle so cleanup always acts on
  // the true current document rather than a stale closure — this is what
  // lets concurrent loads and unmount cleanup each destroy exactly once.
  const pdfRef = useRef<LoadedPdf | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    configurePdfWorker();
  }, []);

  // Destroy whatever's left on unmount only. Deliberately not keyed on
  // [pdf] — replacement already destroys the previous doc itself (see
  // loadFile below), so an effect keyed on [pdf] would destroy the same
  // document a second time on every replacement instead of once on
  // unmount. Also bumps the token so a load still resolving after unmount
  // can't call any state setters, and cancels a pending password prompt so
  // that load's suspended requestPassword promise doesn't hang forever.
  useEffect(() => {
    return () => {
      tokenRef.current += 1;
      cancelPassword();
      if (pdfRef.current) {
        destroySafely(pdfRef.current.doc);
        pdfRef.current = null;
      }
    };
  }, [cancelPassword]);

  const commitPdf = useCallback((next: LoadedPdf | null) => {
    pdfRef.current = next;
    setPdf(next);
  }, []);

  const loadFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) {
        return;
      }

      // A new selection supersedes any password prompt left over from a
      // previous, now-abandoned load — otherwise a stale modal for the old
      // file could stay open on top of the newly loaded one.
      cancelPassword();

      const myToken = ++tokenRef.current;

      const previous = pdfRef.current;
      if (previous) {
        destroySafely(previous.doc);
        pdfRef.current = null;
      }

      setStatus("loading");
      setError(null);

      try {
        const { loadPdfFromFile } = await getPdfLoaderModule();
        const loaded = await loadPdfFromFile(file, {
          requestPassword: requestPassword(file.name),
        });

        if (myToken !== tokenRef.current) {
          // A newer selection (or reset/unmount) superseded this one while
          // it was in flight — discard it and free what it just loaded.
          destroySafely(loaded.doc);
          return;
        }

        commitPdf(loaded);
        setStatus("ready");
      } catch (loadProblem) {
        if (myToken !== tokenRef.current) {
          return;
        }

        console.error("Failed to load PDF", loadProblem);
        commitPdf(null);
        setStatus("error");
        setError(getFriendlyPdfError(loadProblem));
      }
    },
    [cancelPassword, commitPdf, requestPassword],
  );

  const reset = useCallback(() => {
    cancelPassword();
    tokenRef.current += 1; // invalidate any load still in flight

    if (pdfRef.current) {
      destroySafely(pdfRef.current.doc);
      pdfRef.current = null;
    }

    setPdf(null);
    setStatus("idle");
    setError(null);
  }, [cancelPassword]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    pdf,
    status,
    error,
    passwordPrompt,
    loadFile,
    reset,
    clearError,
    submitPassword,
    cancelPassword,
  };
}
