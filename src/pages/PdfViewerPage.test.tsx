import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PdfViewerPage from "./PdfViewerPage";

vi.mock("../lib/pdfWorker", () => ({
  configurePdfWorker: vi.fn(),
}));

vi.mock("../lib/pdfLoader", () => ({
  loadPdfFromFile: vi.fn(),
}));

describe("PdfViewerPage", () => {
  it("renders the upload instructions", () => {
    render(<PdfViewerPage />);
    expect(screen.getByText(/Bring your PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/Drop a file or click to browse/i)).toBeInTheDocument();
  });
});
