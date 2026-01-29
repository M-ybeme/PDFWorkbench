import { describe, expect, it } from "vitest";

import { computeImagePlacement } from "./imageLayout";

const LETTER_PAGE = { width: 612, height: 792, margin: 36 } as const;

describe("computeImagePlacement", () => {
  it("centers and fits portrait images", () => {
    const placement = computeImagePlacement(600, 900, LETTER_PAGE, "fit");
    expect(placement.height).toBeCloseTo(720);
    expect(placement.y).toBeCloseTo((LETTER_PAGE.height - placement.height) / 2);
  });

  it("fills the entire page when using fill mode", () => {
    const placement = computeImagePlacement(600, 400, LETTER_PAGE, "fill");
    const usableWidth = LETTER_PAGE.width - LETTER_PAGE.margin * 2;
    const usableHeight = LETTER_PAGE.height - LETTER_PAGE.margin * 2;
    expect(placement.width).toBeGreaterThanOrEqual(usableWidth);
    expect(placement.height).toBeGreaterThanOrEqual(usableHeight);
    expect(placement.x).toBeLessThanOrEqual((LETTER_PAGE.width - usableWidth) / 2);
  });

  it("does not upscale images beyond 100% when using center mode", () => {
    const placement = computeImagePlacement(300, 200, LETTER_PAGE, "center");
    expect(placement.width).toBe(300);
    expect(placement.x).toBeCloseTo((LETTER_PAGE.width - 300) / 2);
  });
});
