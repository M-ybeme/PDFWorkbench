import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/pdfWorker", () => ({
  configurePdfWorker: vi.fn(),
}));

import SplitToolPage from "./SplitToolPage";
import { useActivityLog } from "../state/activityLog";

describe("SplitToolPage", () => {
  beforeEach(() => {
    useActivityLog.getState().reset();
  });

  it("renders the split workspace hero messaging before a PDF is loaded", () => {
    render(<SplitToolPage />);
    expect(screen.getByText(/Split PDFs with precision/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Drop a PDF to unlock thumbnail previews, selection controls, and split presets/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Choose a PDF/i)).toBeInTheDocument();
  });
});
