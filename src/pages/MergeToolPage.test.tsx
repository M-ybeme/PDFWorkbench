import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/pdfWorker", () => ({
  configurePdfWorker: vi.fn(),
}));

vi.mock("../lib/pdfLoader", () => ({
  loadPdfFromFile: vi.fn(),
}));

vi.mock("../lib/pdfMerge", () => ({
  mergeLoadedPdfsToExportResult: vi.fn(),
}));

import MergeToolPage from "./MergeToolPage";
import { usePdfAssets } from "../state/pdfAssets";
import { useActivityLog } from "../state/activityLog";
import { mergeLoadedPdfsToExportResult } from "../lib/pdfMerge";
import type { LoadedPdf } from "../lib/pdfLoader";

describe("MergeToolPage", () => {
  beforeEach(() => {
    usePdfAssets.getState().reset();
    useActivityLog.getState().reset();
  });

  it("renders the merge instructions", () => {
    render(<MergeToolPage />);
    expect(screen.getByText(/Start stacking PDFs/i)).toBeInTheDocument();
    expect(screen.getByText(/No PDFs yet/i)).toBeInTheDocument();
  });

  it("merges stacked PDFs when requested", async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" });
    const mergeSpy = vi.mocked(mergeLoadedPdfsToExportResult);
    mergeSpy.mockResolvedValue({
      blob: mockBlob,
      size: mockBlob.size,
      downloadName: "alpha.merge.20260129.pdf",
      durationMs: 25,
      activity: { tool: "merge", operation: "merge-2-files", sourceCount: 2 },
    });

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    const createObjectURLMock = vi.fn(() => "blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    const anchorClickMock = vi.fn();

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });

    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });

    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      writable: true,
      value: anchorClickMock,
    });

    const createLoadedPdf = (name: string): LoadedPdf => ({
      id: `${name}-id`,
      name,
      size: 1024,
      lastModified: Date.now(),
      pageCount: 1,
      pdfVersion: "1.7",
      data: new Uint8Array([1]),
      metadata: {},
      doc: { destroy: vi.fn() } as unknown as LoadedPdf["doc"],
    });

    const createSource = (name: string) => ({
      id: `source-${name}`,
      origin: "upload" as const,
      name,
      size: 1024,
      lastModified: Date.now(),
      bytes: new Uint8Array([1, 2, 3]),
      password: null,
    });

    const assets = [
      {
        id: "asset-a",
        fileName: "alpha.pdf",
        source: createSource("alpha.pdf"),
        loaded: createLoadedPdf("alpha.pdf"),
        addedAt: Date.now(),
      },
      {
        id: "asset-b",
        fileName: "beta.pdf",
        source: createSource("beta.pdf"),
        loaded: createLoadedPdf("beta.pdf"),
        addedAt: Date.now(),
      },
    ];

    usePdfAssets.setState({ assets });
    render(<MergeToolPage />);

    const button = screen.getByRole("button", { name: /Merge & Download/i });
    await act(async () => {
      await user.click(button);
    });

    await waitFor(() => {
      expect(mergeSpy).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(/Merged stack downloaded/i)).toBeInTheDocument();
    });

    expect(mergeSpy).toHaveBeenCalledWith(
      assets.map((asset) => asset.loaded),
      {
        sources: assets.map((asset) => asset.source),
        startedAt: expect.any(Number),
      },
    );
    expect(createObjectURLMock).toHaveBeenCalledWith(mockBlob);
    expect(revokeObjectURLMock).toHaveBeenCalled();
    expect(anchorClickMock).toHaveBeenCalled();

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });

    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });

    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      writable: true,
      value: originalAnchorClick,
    });
  });
});
