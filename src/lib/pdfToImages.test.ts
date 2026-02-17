import { describe, expect as vitestExpect, it } from "vitest";

import type { ImageFormat, ImageScale, RenderOptions } from "./pdfToImages";

describe("pdfToImages", () => {
  describe("types and constants", () => {
    it("ImageFormat accepts png and jpeg", () => {
      const formats: ImageFormat[] = ["png", "jpeg"];
      vitestExpect(formats).toHaveLength(2);
    });

    it("ImageScale accepts 1, 2, and 3", () => {
      const scales: ImageScale[] = [1, 2, 3];
      vitestExpect(scales).toHaveLength(3);
    });

    it("RenderOptions has expected shape", () => {
      const options: RenderOptions = { format: "png", scale: 2 };
      vitestExpect(options.format).toBe("png");
      vitestExpect(options.scale).toBe(2);
      vitestExpect(options.jpegQuality).toBeUndefined();
    });

    it("RenderOptions accepts optional jpegQuality", () => {
      const options: RenderOptions = { format: "jpeg", scale: 1, jpegQuality: 0.8 };
      vitestExpect(options.jpegQuality).toBe(0.8);
    });
  });

  describe("renderPageToImage / bundleImagesAsZip (integration)", () => {
    it("should be tested with a real PDF in Playwright E2E tests", () => {
      // Canvas rendering requires browser environment.
      // See playwright/pdf-to-images.spec.ts for E2E coverage.
      vitestExpect(true).toBe(true);
    });
  });
});
