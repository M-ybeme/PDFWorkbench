import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/pdfWorker", () => ({
  configurePdfWorker: vi.fn(),
}));

const mockLoadPdfFromFile = vi.fn();
vi.mock("../lib/pdfLoader", () => ({
  loadPdfFromFile: (...args: unknown[]) => mockLoadPdfFromFile(...args),
}));

import { useLoadedPdf } from "./useLoadedPdf";
import { PdfLoadError } from "../lib/pdfErrors";
import type { LoadedPdf, LoadPdfOptions } from "../lib/pdfLoader";

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const createFakeLoadedPdf = (name: string): LoadedPdf =>
  ({
    id: `${name}-id`,
    name,
    size: 1024,
    lastModified: Date.now(),
    pageCount: 1,
    pdfVersion: "test",
    data: new Uint8Array(),
    metadata: {},
    doc: { destroy: vi.fn() } as unknown as LoadedPdf["doc"],
  }) as LoadedPdf;

const createFile = (name: string) => new File(["%PDF-1.7"], name, { type: "application/pdf" });

describe("useLoadedPdf", () => {
  beforeEach(() => {
    mockLoadPdfFromFile.mockReset();
  });

  it("loads a PDF successfully", async () => {
    const fakePdf = createFakeLoadedPdf("a.pdf");
    mockLoadPdfFromFile.mockResolvedValue(fakePdf);

    const { result } = renderHook(() => useLoadedPdf());

    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.loadFile(createFile("a.pdf"));
    });

    expect(result.current.pdf).toBe(fakePdf);
    expect(result.current.status).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("does nothing when loadFile is called with no file", async () => {
    const { result } = renderHook(() => useLoadedPdf());

    await act(async () => {
      await result.current.loadFile(undefined);
    });

    expect(mockLoadPdfFromFile).toHaveBeenCalledTimes(0);
    expect(result.current.status).toBe("idle");
  });

  it("destroys the previous document when replaced by a new load", async () => {
    const pdfA = createFakeLoadedPdf("a.pdf");
    const pdfB = createFakeLoadedPdf("b.pdf");
    mockLoadPdfFromFile.mockResolvedValueOnce(pdfA).mockResolvedValueOnce(pdfB);

    const { result } = renderHook(() => useLoadedPdf());

    await act(async () => {
      await result.current.loadFile(createFile("a.pdf"));
    });
    expect(result.current.pdf).toBe(pdfA);

    await act(async () => {
      await result.current.loadFile(createFile("b.pdf"));
    });

    expect(pdfA.doc.destroy).toHaveBeenCalledTimes(1);
    expect(result.current.pdf).toBe(pdfB);
    expect(pdfB.doc.destroy).toHaveBeenCalledTimes(0);
  });

  it("destroys the current document on reset", async () => {
    const fakePdf = createFakeLoadedPdf("a.pdf");
    mockLoadPdfFromFile.mockResolvedValue(fakePdf);

    const { result } = renderHook(() => useLoadedPdf());

    await act(async () => {
      await result.current.loadFile(createFile("a.pdf"));
    });

    act(() => {
      result.current.reset();
    });

    expect(fakePdf.doc.destroy).toHaveBeenCalledTimes(1);
    expect(result.current.pdf).toBeNull();
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("destroys the current document on unmount", async () => {
    const fakePdf = createFakeLoadedPdf("a.pdf");
    mockLoadPdfFromFile.mockResolvedValue(fakePdf);

    const { result, unmount } = renderHook(() => useLoadedPdf());

    await act(async () => {
      await result.current.loadFile(createFile("a.pdf"));
    });

    unmount();

    expect(fakePdf.doc.destroy).toHaveBeenCalledTimes(1);
  });

  it("shows the password prompt when a password is required, then loads after the correct password", async () => {
    const fakePdf = createFakeLoadedPdf("locked.pdf");
    mockLoadPdfFromFile.mockImplementation(
      async (_file: File, options?: LoadPdfOptions): Promise<LoadedPdf> => {
        const password = await options!.requestPassword!("password-required");
        if (password === "correct") {
          return fakePdf;
        }
        throw new PdfLoadError("password-incorrect");
      },
    );

    const { result } = renderHook(() => useLoadedPdf());

    act(() => {
      void result.current.loadFile(createFile("locked.pdf"));
    });

    await waitFor(() => {
      expect(result.current.passwordPrompt).toBeTruthy();
    });
    expect(result.current.passwordPrompt?.reason).toBe("password-required");
    expect(result.current.passwordPrompt?.fileName).toBe("locked.pdf");

    await act(async () => {
      result.current.submitPassword("correct");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.pdf).toBe(fakePdf);
    expect(result.current.passwordPrompt).toBeNull();
  });

  it("keeps the user in a recoverable state after a wrong password, then succeeds on retry", async () => {
    const fakePdf = createFakeLoadedPdf("locked.pdf");
    mockLoadPdfFromFile.mockImplementation(
      async (_file: File, options?: LoadPdfOptions): Promise<LoadedPdf> => {
        let reason: "password-required" | "password-incorrect" = "password-required";
        for (;;) {
          const password = await options!.requestPassword!(reason);
          if (password === "correct") {
            return fakePdf;
          }
          if (!password) {
            throw new PdfLoadError(reason);
          }
          reason = "password-incorrect";
        }
      },
    );

    const { result } = renderHook(() => useLoadedPdf());

    act(() => {
      void result.current.loadFile(createFile("locked.pdf"));
    });

    await waitFor(() => expect(result.current.passwordPrompt).toBeTruthy());
    expect(result.current.passwordPrompt?.reason).toBe("password-required");

    // Wrong password: prompt reappears with the incorrect-password reason,
    // and the hook is not left in an error state (the overall load is
    // still in flight, awaiting the retry).
    await act(async () => {
      result.current.submitPassword("wrong");
    });

    await waitFor(() => {
      expect(result.current.passwordPrompt?.reason).toBe("password-incorrect");
    });
    expect(result.current.status).toBe("loading");
    expect(result.current.pdf).toBeNull();

    // Correct password on retry loads the document.
    await act(async () => {
      result.current.submitPassword("correct");
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.pdf).toBe(fakePdf);
  });

  it("clears the pending password prompt and stays idle when reset is called while a prompt is open", async () => {
    const requestedReasons: string[] = [];

    mockLoadPdfFromFile.mockImplementation(
      (_file: File, options?: LoadPdfOptions): Promise<LoadedPdf> => {
        return new Promise((_resolve, reject) => {
          void options!.requestPassword!("password-required").then((password) => {
            requestedReasons.push(String(password));
            reject(new PdfLoadError("password-required"));
          });
        });
      },
    );

    const { result } = renderHook(() => useLoadedPdf());

    act(() => {
      void result.current.loadFile(createFile("locked.pdf"));
    });

    await waitFor(() => expect(result.current.passwordPrompt).toBeTruthy());

    act(() => {
      result.current.reset();
    });

    expect(result.current.passwordPrompt).toBeNull();
    expect(result.current.pdf).toBeNull();
    expect(result.current.status).toBe("idle");

    // The abandoned load's requestPassword promise must have been resolved
    // (with null, as a cancel) rather than left hanging forever.
    await waitFor(() => expect(requestedReasons).toEqual(["null"]));

    // Its eventual rejection must not resurrect an error state after reset.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("cancels a pending password prompt on unmount and frees a document that finishes loading afterward", async () => {
    const requestedReasons: string[] = [];
    const staleDoc = createFakeLoadedPdf("locked.pdf");

    mockLoadPdfFromFile.mockImplementation(
      (_file: File, options?: LoadPdfOptions): Promise<LoadedPdf> => {
        return options!.requestPassword!("password-required").then((password) => {
          requestedReasons.push(String(password));
          // The load "succeeds" some time after unmount regardless — the
          // hook must still discard it rather than install it as current.
          return staleDoc;
        });
      },
    );

    const { result, unmount } = renderHook(() => useLoadedPdf());

    act(() => {
      void result.current.loadFile(createFile("locked.pdf"));
    });

    await waitFor(() => expect(result.current.passwordPrompt).toBeTruthy());

    unmount();

    // The abandoned load's requestPassword promise must have been resolved
    // (with null, as a cancel) rather than left hanging for the rest of the
    // tab's life.
    await waitFor(() => expect(requestedReasons).toEqual(["null"]));

    // No loaded document or pending resource remains: the late-arriving
    // "success" is discarded and its document destroyed, not leaked.
    await waitFor(() => expect(staleDoc.doc.destroy).toHaveBeenCalledTimes(1));
  });

  it("discards a superseded load and frees its document when a second file is selected first", async () => {
    const deferredA = createDeferred<LoadedPdf>();
    const deferredB = createDeferred<LoadedPdf>();
    const pdfA = createFakeLoadedPdf("a.pdf");
    const pdfB = createFakeLoadedPdf("b.pdf");

    mockLoadPdfFromFile.mockImplementation((file: File) => {
      if (file.name === "a.pdf") return deferredA.promise;
      if (file.name === "b.pdf") return deferredB.promise;
      throw new Error(`unexpected file ${file.name}`);
    });

    const { result } = renderHook(() => useLoadedPdf());

    act(() => {
      void result.current.loadFile(createFile("a.pdf"));
    });
    act(() => {
      void result.current.loadFile(createFile("b.pdf"));
    });

    // Let both loadFile calls actually reach the (dynamically imported)
    // loader before resolving either deferred promise, so resolution order
    // below is deterministic regardless of how many microtask hops the
    // mocked dynamic import needs.
    await waitFor(() => {
      expect(mockLoadPdfFromFile).toHaveBeenCalledTimes(2);
    });

    // A (the older, superseded request) resolves after B was already
    // selected — it must not win, and its document must be freed.
    deferredA.resolve(pdfA);
    await waitFor(() => {
      expect(pdfA.doc.destroy).toHaveBeenCalledTimes(1);
    });
    // B hasn't resolved yet, so nothing has been committed as current.
    expect(result.current.pdf).toBeNull();

    deferredB.resolve(pdfB);
    await waitFor(() => {
      expect(result.current.pdf).toBe(pdfB);
    });
    expect(result.current.status).toBe("ready");
    expect(pdfB.doc.destroy).toHaveBeenCalledTimes(0);
  });

  it("produces the friendly error message on a load failure", async () => {
    mockLoadPdfFromFile.mockRejectedValue(new PdfLoadError("corrupt"));

    const { result } = renderHook(() => useLoadedPdf());

    await act(async () => {
      await result.current.loadFile(createFile("broken.pdf"));
    });

    expect(result.current.status).toBe("error");
    expect(result.current.pdf).toBeNull();
    expect(result.current.error).toBe("The file appears to be corrupted or is not a valid PDF.");
  });

  it("clearError resets only the error, leaving pdf/status untouched", async () => {
    mockLoadPdfFromFile.mockRejectedValue(new PdfLoadError("corrupt"));

    const { result } = renderHook(() => useLoadedPdf());

    await act(async () => {
      await result.current.loadFile(createFile("broken.pdf"));
    });
    expect(result.current.error).toBe("The file appears to be corrupted or is not a valid PDF.");

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe("error");
  });
});
