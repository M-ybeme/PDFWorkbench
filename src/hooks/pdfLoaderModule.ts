// pdfLoader.ts pulls in pdf.js, so it's dynamically imported to keep it out
// of each tool page's initial chunk. Cached at module scope (once for the
// whole app, like pdfWorker.ts's own one-time setup) rather than per call,
// so two loads started back to back always share a single import().
//
// createLazyModule is a tiny, generic memoize-with-retry helper, factored
// out so the caching behavior itself — including recovery after a failed
// import (a stale chunk hash, a transient network blip) — is directly
// testable without needing a real dynamic import in tests.
export const createLazyModule = <T>(importer: () => Promise<T>) => {
  let cached: Promise<T> | null = null;

  return (): Promise<T> => {
    if (!cached) {
      cached = importer().catch((error: unknown) => {
        // A failed import must not stay cached forever — clear it so the
        // next call attempts a fresh import instead of replaying the same
        // rejection for the rest of the session.
        cached = null;
        throw error;
      });
    }
    return cached;
  };
};

export const getPdfLoaderModule = createLazyModule(() => import("../lib/pdfLoader"));
