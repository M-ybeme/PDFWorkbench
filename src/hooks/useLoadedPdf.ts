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

  // Signals the current document's lifecycle to anyone doing async work
  // against it (currently: thumbnail rendering) that outlives a single
  // render. It exists because destroying the pdf.js document below is
  // synchronous, but the consuming page's own effect cleanup for the old
  // `pdf` value doesn't run until React processes the resulting state
  // update — by which time the document (and its worker) may already be
  // gone. Aborting this ref's controller happens in the same synchronous
  // step as destroying the document, so a consumer holding the signal from
  // its own closure sees the abort immediately, with no dependency on
  // React's render/effect timing.
  const lifecycleRef = useRef<AbortController | null>(null);

  const invalidateLifecycle = useCallback(() => {
    lifecycleRef.current?.abort();
    lifecycleRef.current = null;
  }, []);

  // Active-operation leases, keyed by document id — separate from
  // lifecycleRef above. lifecycleRef tells cancel-fast consumers (thumbnail
  // rendering) to stop the instant a document is superseded; a lease is the
  // opposite guarantee, for a long-running operation (compression, page
  // rasterization) that has already started reading pages and must be
  // allowed to finish safely even if the document is reset, replaced, or
  // its page unmounts in the meantime. destroyOrDefer only calls
  // doc.destroy() immediately when the document being torn down has no
  // outstanding leases; otherwise the actual pdf.js document is kept alive
  // and destruction happens once the last lease on that specific id
  // releases (see acquireLease below). Keyed by id (not a single counter)
  // so releasing an old, leased document's lease can never affect whatever
  // document is current by the time that release happens.
  const leaseCountsRef = useRef<Map<string, number>>(new Map());
  const pendingDestroyRef = useRef<Map<string, LoadedPdf["doc"]>>(new Map());

  const destroyOrDefer = useCallback((doc: LoadedPdf) => {
    if ((leaseCountsRef.current.get(doc.id) ?? 0) > 0) {
      pendingDestroyRef.current.set(doc.id, doc.doc);
    } else {
      destroySafely(doc.doc);
    }
  }, []);

  // Returns an idempotent release function scoped to this one acquisition —
  // calling it more than once is a no-op, so a caller can never double-count
  // a release against another, unrelated lease on the same document.
  const acquireLease = useCallback((doc: LoadedPdf): (() => void) => {
    const id = doc.id;
    leaseCountsRef.current.set(id, (leaseCountsRef.current.get(id) ?? 0) + 1);

    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;

      const remaining = (leaseCountsRef.current.get(id) ?? 1) - 1;
      if (remaining > 0) {
        leaseCountsRef.current.set(id, remaining);
        return;
      }

      leaseCountsRef.current.delete(id);
      const pendingDoc = pendingDestroyRef.current.get(id);
      if (pendingDoc) {
        pendingDestroyRef.current.delete(id);
        destroySafely(pendingDoc);
      }
    };
  }, []);

  // The only public way to borrow the current document across an `await` —
  // acquires a lease on whichever document is current at call time, runs
  // `fn`, and releases in `finally` no matter how `fn` settles, so a caller
  // can't forget to release. Use this for any operation that keeps reading
  // `pdf.doc` after the first `await` and must be allowed to finish even if
  // the user navigates away or resets mid-operation.
  const withPdfLease = useCallback(
    async <T>(fn: (pdf: LoadedPdf) => Promise<T>): Promise<T> => {
      const current = pdfRef.current;
      if (!current) {
        throw new Error("withPdfLease() called with no loaded PDF.");
      }

      const release = acquireLease(current);
      try {
        return await fn(current);
      } finally {
        release();
      }
    },
    [acquireLease],
  );

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
      invalidateLifecycle();
      if (pdfRef.current) {
        // Deferred, not skipped, if an operation still holds a lease — see
        // destroyOrDefer above.
        destroyOrDefer(pdfRef.current);
        pdfRef.current = null;
      }
    };
  }, [cancelPassword, destroyOrDefer, invalidateLifecycle]);

  const commitPdf = useCallback((next: LoadedPdf | null) => {
    pdfRef.current = next;
    lifecycleRef.current = next ? new AbortController() : null;
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
        // Cancel dependents before destroying — see lifecycleRef above.
        invalidateLifecycle();
        destroyOrDefer(previous);
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
    [cancelPassword, commitPdf, destroyOrDefer, invalidateLifecycle, requestPassword],
  );

  const reset = useCallback(() => {
    cancelPassword();
    tokenRef.current += 1; // invalidate any load still in flight
    invalidateLifecycle();

    if (pdfRef.current) {
      destroyOrDefer(pdfRef.current);
      pdfRef.current = null;
    }

    setPdf(null);
    setStatus("idle");
    setError(null);
  }, [cancelPassword, destroyOrDefer, invalidateLifecycle]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    pdf,
    // Aborts the instant `pdf` is superseded or destroyed (replace, reset,
    // or unmount) — always in lockstep with `pdf` itself, so a consumer can
    // safely pass it straight to async work scoped to "while this document
    // is current" without its own AbortController. See lifecycleRef above.
    pdfLifecycle: lifecycleRef.current?.signal ?? null,
    status,
    error,
    passwordPrompt,
    loadFile,
    reset,
    clearError,
    submitPassword,
    cancelPassword,
    withPdfLease,
  };
}
