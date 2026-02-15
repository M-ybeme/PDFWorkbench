import { describe, expect, it } from "vitest";

import {
  SIGNATURE_DISCLAIMER_COPY,
  createPlacementFromPoint,
  createStrokeFromPoints,
  createTextPlacement,
  dataUrlToUint8Array,
  moveTextPlacement,
  placementToPdfRect,
  resizeTextPlacement,
  strokeToPdfPoints,
  textPlacementToPdfPosition,
  type SignaturePlacement,
  type TextPlacement,
} from "./signaturePlacement";
import type { SignatureEntry } from "../state/signatureLibrary";

const createSignature = (overrides?: Partial<SignatureEntry>): SignatureEntry => ({
  id: overrides?.id ?? "sig-1",
  label: overrides?.label ?? "Test",
  kind: overrides?.kind ?? "drawn",
  dataUrl: overrides?.dataUrl ?? "data:image/png;base64,AAAA",
  width: overrides?.width ?? 600,
  height: overrides?.height ?? 200,
  createdAt: overrides?.createdAt ?? Date.now(),
  lastUsedAt: overrides?.lastUsedAt ?? null,
});

describe("signaturePlacement", () => {
  it("keeps generated placements within the visible canvas", () => {
    const signature = createSignature();
    const placement = createPlacementFromPoint({
      signature,
      pageNumber: 1,
      canvasAspect: 1,
      pointXPct: 0.95,
      pointYPct: 0.05,
    });

    expect(placement.xPct).toBeGreaterThanOrEqual(0);
    expect(placement.yPct).toBeGreaterThanOrEqual(0);
    expect(placement.xPct + placement.widthPct).toBeLessThanOrEqual(1);
    expect(placement.yPct + placement.heightPct).toBeLessThanOrEqual(1);
    expect(placement.pageNumber).toBe(1);
  });

  it("maps placement percentages to PDF coordinates", () => {
    const placement: SignaturePlacement = {
      id: "placement-1",
      signatureId: "sig-1",
      pageNumber: 2,
      xPct: 0.25,
      yPct: 0.1,
      widthPct: 0.2,
      heightPct: 0.05,
      aspectRatio: 4,
    };

    const rect = placementToPdfRect(placement, { width: 612, height: 792 });
    expect(rect.x).toBeCloseTo(153); // 612 * 0.25
    expect(rect.width).toBeCloseTo(122.4);
    expect(rect.height).toBeCloseTo(39.6);
    expect(rect.y).toBeCloseTo(792 - 0.1 * 792 - rect.height);
  });

  it("decodes base64 data URLs into byte arrays", () => {
    const dataUrl = "data:text/plain;base64,SGVsbG8="; // Hello
    const bytes = dataUrlToUint8Array(dataUrl);
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded.startsWith("Hello")).toBe(true);
  });

  it("creates text placements that stay within canvas bounds", () => {
    const placement = createTextPlacement({
      text: "Example Text",
      fontSizePt: 18,
      color: "#111827",
      widthPct: 0.95,
      pageNumber: 1,
      pointXPct: 0.99,
      pointYPct: 0.99,
    });

    expect(placement.xPct + placement.widthPct).toBeLessThanOrEqual(1);
    expect(placement.yPct).toBeLessThanOrEqual(0.98);

    const moved = moveTextPlacement({ placement, deltaXPct: -0.2, deltaYPct: -0.2 });
    expect(moved.xPct).toBeGreaterThanOrEqual(0);
    expect(moved.yPct).toBeGreaterThanOrEqual(0);

    const resized = resizeTextPlacement({ placement, nextWidthPct: 1.2 });
    expect(resized.widthPct).toBeLessThanOrEqual(0.9);
  });

  it("maps text placement percentages to PDF coordinates", () => {
    const placement: TextPlacement = {
      id: "text-1",
      pageNumber: 1,
      xPct: 0.2,
      yPct: 0.1,
      widthPct: 0.4,
      text: "Hello",
      fontSizePt: 16,
      color: "#111827",
    };

    const position = textPlacementToPdfPosition(placement, { width: 612, height: 792 });
    expect(position.x).toBeCloseTo(122.4);
    expect(position.maxWidth).toBeCloseTo(244.8);
    expect(position.y).toBeCloseTo(792 - 0.1 * 792 - placement.fontSizePt);
  });

  it("keeps disclaimer copy focused on visual-only messaging", () => {
    const copy = SIGNATURE_DISCLAIMER_COPY.toLowerCase();
    expect(copy).toContain("visual");
    expect(copy).toContain("cryptographic");
    expect(copy).toContain("signature");
  });

  it("returns null for strokes with fewer than 2 points", () => {
    const result = createStrokeFromPoints({
      pageNumber: 1,
      points: [{ xPct: 0.5, yPct: 0.5 }],
      color: "#000000",
      widthPx: 3,
      tool: "pen",
    });
    expect(result).toBeNull();
  });

  it("clamps stroke points within 0–1 range", () => {
    const stroke = createStrokeFromPoints({
      pageNumber: 2,
      points: [
        { xPct: -0.1, yPct: 1.2 },
        { xPct: 0.5, yPct: 0.5 },
        { xPct: 1.5, yPct: -0.3 },
      ],
      color: "#ff0000",
      widthPx: 5,
      tool: "pen",
    });

    expect(stroke).toBeTruthy();
    expect(stroke!.pageNumber).toBe(2);
    expect(stroke!.opacity).toBe(1);
    for (const p of stroke!.points) {
      expect(p.xPct).toBeGreaterThanOrEqual(0);
      expect(p.xPct).toBeLessThanOrEqual(1);
      expect(p.yPct).toBeGreaterThanOrEqual(0);
      expect(p.yPct).toBeLessThanOrEqual(1);
    }
  });

  it("sets highlighter opacity to 0.3", () => {
    const stroke = createStrokeFromPoints({
      pageNumber: 1,
      points: [
        { xPct: 0.1, yPct: 0.1 },
        { xPct: 0.9, yPct: 0.9 },
      ],
      color: "#ffff00",
      widthPx: 10,
      tool: "highlighter",
    });

    expect(stroke).toBeTruthy();
    expect(stroke!.tool).toBe("highlighter");
    expect(stroke!.opacity).toBe(0.3);
  });

  it("converts stroke points to PDF coordinates with Y inversion", () => {
    const stroke = createStrokeFromPoints({
      pageNumber: 1,
      points: [
        { xPct: 0, yPct: 0 },
        { xPct: 0.5, yPct: 0.5 },
        { xPct: 1, yPct: 1 },
      ],
      color: "#000000",
      widthPx: 2,
      tool: "pen",
    })!;

    const pdfPoints = strokeToPdfPoints(stroke, { width: 612, height: 792 });
    expect(pdfPoints).toHaveLength(3);

    expect(pdfPoints[0]!.x).toBeCloseTo(0);
    expect(pdfPoints[0]!.y).toBeCloseTo(792);

    expect(pdfPoints[1]!.x).toBeCloseTo(306);
    expect(pdfPoints[1]!.y).toBeCloseTo(396);

    expect(pdfPoints[2]!.x).toBeCloseTo(612);
    expect(pdfPoints[2]!.y).toBeCloseTo(0);
  });
});
