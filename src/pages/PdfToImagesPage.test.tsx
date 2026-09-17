import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("../lib/pdfWorker", () => ({
  configurePdfWorker: vi.fn(),
}));

vi.mock("../lib/downloads", () => ({
  triggerBlobDownload: vi.fn(),
}));

vi.mock("../lib/pdfToImages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/pdfToImages")>();
  return {
    ...actual,
    renderAllPagesToImages: vi.fn(),
  };
});

vi.mock("../hooks/useLoadedPdf", () => ({
  useLoadedPdf: () => mockUseLoadedPdfState,
}));

import PdfToImagesPage from "./PdfToImagesPage";
import { renderAllPagesToImages, type RenderedPageImage } from "../lib/pdfToImages";
import { triggerBlobDownload } from "../lib/downloads";
import type { LoadedPdfStatus } from "../hooks/useLoadedPdf";
import type { LoadedPdf } from "../lib/pdfLoader";

const mockRenderAllPagesToImages = vi.mocked(renderAllPagesToImages);
const mockTriggerBlobDownload = vi.mocked(triggerBlobDownload);

type MockUseLoadedPdfState = {
  pdf: LoadedPdf | null;
  status: LoadedPdfStatus;
  error: string | null;
  passwordPrompt: null;
  loadFile: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  clearError: ReturnType<typeof vi.fn>;
  submitPassword: ReturnType<typeof vi.fn>;
  cancelPassword: ReturnType<typeof vi.fn>;
  withPdfLease: (fn: (pdf: LoadedPdf) => Promise<unknown>) => Promise<unknown>;
};

// Declared before idleHookState (and given an explicit type) so
// idleHookState's withPdfLease can reference it without a circular
// inference — it isn't actually read until a test calls withPdfLease,
// long after this module finishes initializing.
let mockUseLoadedPdfState: MockUseLoadedPdfState;

const idleHookState: MockUseLoadedPdfState = {
  pdf: null,
  status: "idle",
  error: null,
  passwordPrompt: null,
  loadFile: vi.fn(),
  reset: vi.fn(),
  clearError: vi.fn(),
  submitPassword: vi.fn(),
  cancelPassword: vi.fn(),
  // Mirrors the real hook's contract closely enough for these tests: runs
  // `fn` against whatever `pdf` the mock currently holds. Lease/deferred-
  // destruction behavior itself is covered directly in useLoadedPdf.test.ts.
  withPdfLease: vi.fn(async (fn: (pdf: LoadedPdf) => Promise<unknown>) => {
    if (!mockUseLoadedPdfState.pdf) {
      throw new Error("withPdfLease() called with no loaded PDF.");
    }
    return fn(mockUseLoadedPdfState.pdf);
  }),
};

mockUseLoadedPdfState = idleHookState;

const createFakeLoadedPdf = (): LoadedPdf =>
  ({
    id: "pdf-1",
    name: "sample.pdf",
    size: 1024,
    lastModified: Date.now(),
    pageCount: 1,
    pdfVersion: "test",
    data: new Uint8Array(),
    metadata: {},
    doc: {} as LoadedPdf["doc"],
  }) as LoadedPdf;

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const renderPage = () => {
  return render(
    <MemoryRouter>
      <PdfToImagesPage />
    </MemoryRouter>,
  );
};

describe("PdfToImagesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoadedPdfState = idleHookState;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the upload prompt when no PDF is loaded", () => {
    renderPage();
    expect(screen.getByText("Export PDF pages as images")).toBeInTheDocument();
  });

  describe("Reset workspace while exporting", () => {
    beforeEach(() => {
      mockUseLoadedPdfState = {
        ...idleHookState,
        pdf: createFakeLoadedPdf(),
        status: "ready",
        reset: vi.fn(),
      };
    });

    it("disables Reset workspace and the file input while export is in flight, and re-enables both when it finishes", async () => {
      const deferred = createDeferred<RenderedPageImage[]>();
      mockRenderAllPagesToImages.mockReturnValue(deferred.promise);

      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /export images/i }));

      const resetButton = await screen.findByRole("button", { name: /reset workspace/i });
      await waitFor(() => expect(resetButton).toBeDisabled());
      const fileInput = document.querySelector<HTMLInputElement>("#pdf-to-images-upload")!;
      expect(fileInput.disabled).toBe(true);

      fireEvent.click(resetButton);
      expect(mockUseLoadedPdfState.reset).toHaveBeenCalledTimes(0);

      deferred.resolve([
        {
          pageNumber: 1,
          blob: new Blob(["x"], { type: "image/png" }),
          width: 10,
          height: 10,
          format: "png",
          fileName: "page-1.png",
        },
      ]);

      await waitFor(() => expect((resetButton as HTMLButtonElement).disabled).toBe(false));
      expect(fileInput.disabled).toBe(false);
    });

    it("resetWorkspace guard prevents reset() from running while exporting, independent of the disabled attribute", async () => {
      const deferred = createDeferred<RenderedPageImage[]>();
      mockRenderAllPagesToImages.mockReturnValue(deferred.promise);

      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /export images/i }));
      const resetButton = await screen.findByRole("button", { name: /reset workspace/i });
      await waitFor(() => expect(resetButton).toBeDisabled());

      resetButton.removeAttribute("disabled");
      fireEvent.click(resetButton);

      expect(mockUseLoadedPdfState.reset).toHaveBeenCalledTimes(0);
    });

    it("re-enables Reset workspace after a failed export", async () => {
      const deferred = createDeferred<RenderedPageImage[]>();
      mockRenderAllPagesToImages.mockReturnValue(deferred.promise);

      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /export images/i }));
      const resetButton = await screen.findByRole("button", { name: /reset workspace/i });
      await waitFor(() => expect(resetButton).toBeDisabled());

      deferred.reject(new Error("boom"));

      await waitFor(() => expect((resetButton as HTMLButtonElement).disabled).toBe(false));
    });

    it("lets export finish safely after the page unmounts, without updating any state", async () => {
      const deferred = createDeferred<RenderedPageImage[]>();
      mockRenderAllPagesToImages.mockReturnValue(deferred.promise);

      const { unmount } = renderPage();
      fireEvent.click(screen.getByRole("button", { name: /export images/i }));
      await waitFor(() => expect(mockUseLoadedPdfState.withPdfLease).toHaveBeenCalledTimes(1));

      unmount();

      // The operation (borrowing the document via withPdfLease) still
      // completes, still downloads and logs — it's only this page's own
      // state that has nothing left to update.
      deferred.resolve([
        {
          pageNumber: 1,
          blob: new Blob(["x"], { type: "image/png" }),
          width: 10,
          height: 10,
          format: "png",
          fileName: "page-1.png",
        },
      ]);

      // handleExport's own continuation (download + activity log) still
      // runs after withPdfLease's promise settles, even with no page left
      // to update.
      await waitFor(() => expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1));
    });
  });
});
