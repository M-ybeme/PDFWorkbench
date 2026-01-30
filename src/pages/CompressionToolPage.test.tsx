import { render, screen } from "@testing-library/react";
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import CompressionToolPage from "./CompressionToolPage";

vi.mock("../lib/pdfWorker", () => ({
  configurePdfWorker: vi.fn(),
}));

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
});
