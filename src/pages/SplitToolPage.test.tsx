import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/pdfWorker", () => ({
  configurePdfWorker: vi.fn(),
}));

vi.mock("../lib/downloads", () => ({
  triggerBlobDownload: vi.fn(),
}));

vi.mock("../lib/pdfSplit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/pdfSplit")>();
  return {
    ...actual,
    extractPagesFromLoadedPdf: vi.fn(),
  };
});

vi.mock("../hooks/useLoadedPdf", () => ({
  useLoadedPdf: () => mockUseLoadedPdfState,
}));

import SplitToolPage from "./SplitToolPage";
import { extractPagesFromLoadedPdf } from "../lib/pdfSplit";
import { useActivityLog } from "../state/activityLog";
import type { LoadedPdfStatus } from "../hooks/useLoadedPdf";
import type { LoadedPdf } from "../lib/pdfLoader";

const mockExtractPagesFromLoadedPdf = vi.mocked(extractPagesFromLoadedPdf);

const idleHookState = {
  pdf: null as LoadedPdf | null,
  pdfLifecycle: null as AbortSignal | null,
  status: "idle" as LoadedPdfStatus,
  error: null as string | null,
  passwordPrompt: null,
  loadFile: vi.fn(),
  reset: vi.fn(),
  clearError: vi.fn(),
  submitPassword: vi.fn(),
  cancelPassword: vi.fn(),
};

let mockUseLoadedPdfState = idleHookState;

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
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("SplitToolPage", () => {
  beforeEach(() => {
    useActivityLog.getState().clear();
    vi.clearAllMocks();
    mockUseLoadedPdfState = idleHookState;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the split workspace hero messaging before a PDF is loaded", () => {
    render(<SplitToolPage />);
    expect(screen.getByText(/Split PDFs with precision/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Drop a PDF to unlock thumbnail previews, selection controls, and split presets/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Choose a PDF/i)).toBeInTheDocument();
  });

  describe("Reset workspace while downloading a selection", () => {
    beforeEach(() => {
      mockUseLoadedPdfState = {
        ...idleHookState,
        pdf: createFakeLoadedPdf(),
        status: "ready",
        reset: vi.fn(),
      };
    });

    it("disables Reset workspace and the file input while a selection download is in flight, and re-enables both when it finishes", async () => {
      const deferred = createDeferred<Uint8Array>();
      mockExtractPagesFromLoadedPdf.mockReturnValue(deferred.promise);

      render(<SplitToolPage />);

      fireEvent.click(screen.getByRole("button", { name: /select all/i }));
      fireEvent.click(screen.getByRole("button", { name: /download selection/i }));

      const resetButton = await screen.findByRole("button", { name: /reset workspace/i });
      await waitFor(() => expect(resetButton).toBeDisabled());
      const fileInput = document.querySelector<HTMLInputElement>("#split-upload")!;
      expect(fileInput.disabled).toBe(true);

      fireEvent.click(resetButton);
      expect(mockUseLoadedPdfState.reset).toHaveBeenCalledTimes(0);

      deferred.resolve(new Uint8Array([1, 2, 3]));

      await waitFor(() => expect((resetButton as HTMLButtonElement).disabled).toBe(false));
      expect(fileInput.disabled).toBe(false);
    });

    it("resetWorkspace guard prevents reset() from running while downloading, independent of the disabled attribute", async () => {
      const deferred = createDeferred<Uint8Array>();
      mockExtractPagesFromLoadedPdf.mockReturnValue(deferred.promise);

      render(<SplitToolPage />);

      fireEvent.click(screen.getByRole("button", { name: /select all/i }));
      fireEvent.click(screen.getByRole("button", { name: /download selection/i }));
      const resetButton = await screen.findByRole("button", { name: /reset workspace/i });
      await waitFor(() => expect(resetButton).toBeDisabled());

      resetButton.removeAttribute("disabled");
      fireEvent.click(resetButton);

      expect(mockUseLoadedPdfState.reset).toHaveBeenCalledTimes(0);
    });

    it("re-enables Reset workspace after a failed selection download", async () => {
      const deferred = createDeferred<Uint8Array>();
      mockExtractPagesFromLoadedPdf.mockReturnValue(deferred.promise);

      render(<SplitToolPage />);

      fireEvent.click(screen.getByRole("button", { name: /select all/i }));
      fireEvent.click(screen.getByRole("button", { name: /download selection/i }));
      const resetButton = await screen.findByRole("button", { name: /reset workspace/i });
      await waitFor(() => expect(resetButton).toBeDisabled());

      deferred.reject(new Error("boom"));

      await waitFor(() => expect((resetButton as HTMLButtonElement).disabled).toBe(false));
    });
  });
});
