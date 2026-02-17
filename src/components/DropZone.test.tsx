import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DropZone from "./DropZone";

const mockDropZoneProps = {
  onDrop: vi.fn(),
  onDragOver: vi.fn(),
  onDragLeave: vi.fn(),
};

describe("DropZone", () => {
  it("renders children", () => {
    render(
      <DropZone isDragActive={false} accentColor="indigo" dropZoneProps={mockDropZoneProps}>
        Drop here
      </DropZone>,
    );
    expect(screen.getByText("Drop here")).toBeInTheDocument();
  });

  it("applies inactive styles when not dragging", () => {
    const { container } = render(
      <DropZone isDragActive={false} accentColor="indigo" dropZoneProps={mockDropZoneProps}>
        Content
      </DropZone>,
    );
    const zone = container.firstElementChild!;
    expect(zone.className).toContain("border-slate-300/70");
    expect(zone.className.includes("border-indigo-400")).toBe(false);
  });

  it("applies active accent color when dragging", () => {
    const { container } = render(
      <DropZone isDragActive={true} accentColor="indigo" dropZoneProps={mockDropZoneProps}>
        Content
      </DropZone>,
    );
    const zone = container.firstElementChild!;
    expect(zone.className).toContain("border-indigo-400");
    expect(zone.className.includes("border-slate-300/70")).toBe(false);
  });

  it("applies emerald accent when specified", () => {
    const { container } = render(
      <DropZone isDragActive={true} accentColor="emerald" dropZoneProps={mockDropZoneProps}>
        Content
      </DropZone>,
    );
    const zone = container.firstElementChild!;
    expect(zone.className).toContain("border-emerald-400");
  });

  it("merges additional className", () => {
    const { container } = render(
      <DropZone
        isDragActive={false}
        accentColor="cyan"
        dropZoneProps={mockDropZoneProps}
        className="text-center"
      >
        Content
      </DropZone>,
    );
    const zone = container.firstElementChild!;
    expect(zone.className).toContain("text-center");
  });
});
