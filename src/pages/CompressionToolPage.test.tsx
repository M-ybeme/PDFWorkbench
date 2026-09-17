import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("../lib/pdfWorker", () => ({
  configurePdfWorker: vi.fn(),
}));

vi.mock("../lib/downloads", () => ({
  triggerBlobDownload: vi.fn(),
}));

vi.mock("../lib/pdfCompression", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/pdfCompression")>();
  return {
    ...actual,
    compressPdfWithPreset: vi.fn(),
  };
});

vi.mock("../hooks/useLoadedPdf", () => ({
  useLoadedPdf: () => mockUseLoadedPdfState,
}));

import CompressionToolPage from "./CompressionToolPage";
import { compressPdfWithPreset, type CompressionResult } from "../lib/pdfCompression";
import { triggerBlobDownload } from "../lib/downloads";
import type { LoadedPdfStatus } from "../hooks/useLoadedPdf";
import type { LoadedPdf } from "../lib/pdfLoader";

const mockCompressPdfWithPreset = vi.mocked(compressPdfWithPreset);
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
    pageCount: 3,
    pdfVersion: "test",
    data: new Uint8Array(),
    metadata: {},
    doc: {} as LoadedPdf["doc"],
  }) as LoadedPdf;

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const renderPage = () => {
  return render(
    <MemoryRouter>
      <CompressionToolPage />
    </MemoryRouter>,
  );
};

describe("CompressionToolPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoadedPdfState = idleHookState;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("renders the upload prompt when no PDF is loaded", () => {
      renderPage();

      expect(screen.getByText("Compress image-heavy PDFs")).toBeInTheDocument();
      expect(screen.getByText("Choose a PDF")).toBeInTheDocument();
    });

    it("shows drag-drop instructions", () => {
      renderPage();

      expect(screen.getByText("or drag files anywhere in this panel")).toBeInTheDocument();
    });

    it("shows placeholder text when no PDF is loaded", () => {
      renderPage();

      expect(
        screen.getByText(
          "Load a PDF to unlock preset controls, projected savings, and preview exports.",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("guardrail warnings logic", () => {
    it("does not show guardrails when no PDF is loaded", () => {
      renderPage();

      // Guardrails section only appears when PDF is loaded
      expect(screen.queryByText(/files never leave your device/i)).not.toBeInTheDocument();
    });
  });

  describe("Reset workspace while compressing", () => {
    beforeEach(() => {
      mockUseLoadedPdfState = {
        ...idleHookState,
        pdf: createFakeLoadedPdf(),
        status: "ready",
        reset: vi.fn(),
      };
    });

    it("disables Reset workspace and the file input while compression is in flight, and re-enables both when it finishes", async () => {
      const deferred = createDeferred<CompressionResult>();
      mockCompressPdfWithPreset.mockReturnValue(deferred.promise);

      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /compress & download/i }));

      const resetButton = await screen.findByRole("button", { name: /reset workspace/i });
      await waitFor(() => expect(resetButton).toBeDisabled());
      const fileInput = document.querySelector<HTMLInputElement>("#compression-upload")!;
      expect(fileInput.disabled).toBe(true);

      // Clicking the (disabled) button must not reach reset() even if
      // something bypasses the DOM disabled attribute.
      fireEvent.click(resetButton);
      expect(mockUseLoadedPdfState.reset).toHaveBeenCalledTimes(0);

      deferred.resolve({
        blob: new Blob(["x"], { type: "application/pdf" }),
        downloadName: "out.pdf",
        originalSize: 100,
        compressedSize: 50,
        savings: 50,
        savingsPercent: 50,
        size: 50,
        durationMs: 1,
        warnings: undefined,
        activity: { tool: "compression", operation: "compress-balanced", sourceCount: 1 },
      });

      await waitFor(() => expect((resetButton as HTMLButtonElement).disabled).toBe(false));
      expect(fileInput.disabled).toBe(false);
    });

    it("resetWorkspace guard prevents reset() from running while compressing, independent of the disabled attribute", async () => {
      const deferred = createDeferred<CompressionResult>();
      mockCompressPdfWithPreset.mockReturnValue(deferred.promise);

      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /compress & download/i }));
      const resetButton = await screen.findByRole("button", { name: /reset workspace/i });
      await waitFor(() => expect(resetButton).toBeDisabled());

      // Simulate a programmatic/stale invocation that bypasses the DOM
      // disabled attribute entirely.
      resetButton.removeAttribute("disabled");
      fireEvent.click(resetButton);

      expect(mockUseLoadedPdfState.reset).toHaveBeenCalledTimes(0);
    });

    it("lets compression finish safely after the page unmounts, without updating any state", async () => {
      const deferred = createDeferred<CompressionResult>();
      mockCompressPdfWithPreset.mockReturnValue(deferred.promise);

      const { unmount } = renderPage();
      fireEvent.click(screen.getByRole("button", { name: /compress & download/i }));
      await waitFor(() => expect(mockUseLoadedPdfState.withPdfLease).toHaveBeenCalledTimes(1));

      unmount();

      // The operation (borrowing the document via withPdfLease) still
      // completes, still downloads and logs — it's only this page's own
      // state that has nothing left to update.
      deferred.resolve({
        blob: new Blob(["x"], { type: "application/pdf" }),
        downloadName: "out.pdf",
        originalSize: 100,
        compressedSize: 50,
        savings: 50,
        savingsPercent: 50,
        size: 50,
        durationMs: 1,
        warnings: undefined,
        activity: { tool: "compression", operation: "compress-balanced", sourceCount: 1 },
      });

      // handleCompress's own continuation (download + activity log) still
      // runs after withPdfLease's promise settles, even with no page left
      // to update.
      await waitFor(() => expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1));
    });
  });
});
