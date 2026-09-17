import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/pdfWorker", () => ({
  configurePdfWorker: vi.fn(),
}));

vi.mock("../lib/downloads", () => ({
  triggerBlobDownload: vi.fn(),
}));

vi.mock("../lib/pdfEdit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/pdfEdit")>();
  return {
    ...actual,
    applyPageEdits: vi.fn(),
  };
});

vi.mock("../hooks/useLoadedPdf", () => ({
  useLoadedPdf: () => mockUseLoadedPdfState,
}));

import PageEditorPage from "./PageEditorPage";
import { applyPageEdits } from "../lib/pdfEdit";
import type { LoadedPdfStatus } from "../hooks/useLoadedPdf";
import type { LoadedPdf } from "../lib/pdfLoader";

const mockApplyPageEdits = vi.mocked(applyPageEdits);

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

describe("PageEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoadedPdfState = idleHookState;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the upload prompt when no PDF is loaded", () => {
    render(<PageEditorPage />);
    expect(screen.getByText(/Reorder, rotate, and curate/i)).toBeInTheDocument();
  });

  describe("Reset workspace while applying edits", () => {
    beforeEach(() => {
      mockUseLoadedPdfState = {
        ...idleHookState,
        pdf: createFakeLoadedPdf(),
        status: "ready",
        reset: vi.fn(),
      };
    });

    it("disables Reset workspace and the file input while the export is in flight, and re-enables both when it finishes", async () => {
      const deferred = createDeferred<Uint8Array>();
      mockApplyPageEdits.mockReturnValue(deferred.promise);

      render(<PageEditorPage />);

      fireEvent.click(await screen.findByRole("button", { name: /apply & download/i }));

      const resetButton = await screen.findByRole("button", { name: /reset workspace/i });
      await waitFor(() => expect(resetButton).toBeDisabled());
      const fileInput = document.querySelector<HTMLInputElement>("#editor-upload")!;
      expect(fileInput.disabled).toBe(true);

      fireEvent.click(resetButton);
      expect(mockUseLoadedPdfState.reset).toHaveBeenCalledTimes(0);

      deferred.resolve(new Uint8Array([1, 2, 3]));

      await waitFor(() => expect((resetButton as HTMLButtonElement).disabled).toBe(false));
      expect(fileInput.disabled).toBe(false);
    });

    it("resetWorkspace guard prevents reset() from running while applying edits, independent of the disabled attribute", async () => {
      const deferred = createDeferred<Uint8Array>();
      mockApplyPageEdits.mockReturnValue(deferred.promise);

      render(<PageEditorPage />);

      fireEvent.click(await screen.findByRole("button", { name: /apply & download/i }));
      const resetButton = await screen.findByRole("button", { name: /reset workspace/i });
      await waitFor(() => expect(resetButton).toBeDisabled());

      resetButton.removeAttribute("disabled");
      fireEvent.click(resetButton);

      expect(mockUseLoadedPdfState.reset).toHaveBeenCalledTimes(0);
    });

    it("re-enables Reset workspace after a failed export", async () => {
      const deferred = createDeferred<Uint8Array>();
      mockApplyPageEdits.mockReturnValue(deferred.promise);

      render(<PageEditorPage />);

      fireEvent.click(await screen.findByRole("button", { name: /apply & download/i }));
      const resetButton = await screen.findByRole("button", { name: /reset workspace/i });
      await waitFor(() => expect(resetButton).toBeDisabled());

      deferred.reject(new Error("boom"));

      await waitFor(() => expect((resetButton as HTMLButtonElement).disabled).toBe(false));
    });
  });
});
