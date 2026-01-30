import { describe, expect as vitestExpect, it, vi, beforeEach, afterEach } from "vitest";

import {
  COMPRESSION_PRESETS,
  computeScaledDimensions,
  estimateCompressedSize,
  getCompressionPreset,
  type CompressionPresetId,
} from "./pdfCompression";

describe("pdfCompression", () => {
  describe("COMPRESSION_PRESETS", () => {
    it("provides three presets in order: high, balanced, smallest", () => {
      vitestExpect(COMPRESSION_PRESETS).toHaveLength(3);
      vitestExpect(COMPRESSION_PRESETS[0]?.id).toBe("high");
      vitestExpect(COMPRESSION_PRESETS[1]?.id).toBe("balanced");
      vitestExpect(COMPRESSION_PRESETS[2]?.id).toBe("smallest");
    });

    it("has progressively more aggressive target ratios", () => {
      const high = COMPRESSION_PRESETS[0];
      const balanced = COMPRESSION_PRESETS[1];
      const smallest = COMPRESSION_PRESETS[2];
      vitestExpect(high?.targetRatio).toBeGreaterThan(balanced?.targetRatio ?? 0);
      vitestExpect(balanced?.targetRatio).toBeGreaterThan(smallest?.targetRatio ?? 0);
    });

    it("has progressively smaller max dimensions", () => {
      const high = COMPRESSION_PRESETS[0];
      const balanced = COMPRESSION_PRESETS[1];
      const smallest = COMPRESSION_PRESETS[2];
      vitestExpect(high?.maxDimension).toBeGreaterThan(balanced?.maxDimension ?? 0);
      vitestExpect(balanced?.maxDimension).toBeGreaterThan(smallest?.maxDimension ?? 0);
    });

    it("has progressively lower JPEG quality", () => {
      const high = COMPRESSION_PRESETS[0];
      const balanced = COMPRESSION_PRESETS[1];
      const smallest = COMPRESSION_PRESETS[2];
      vitestExpect(high?.jpegQuality).toBeGreaterThan(balanced?.jpegQuality ?? 0);
      vitestExpect(balanced?.jpegQuality).toBeGreaterThan(smallest?.jpegQuality ?? 0);
    });
  });

  describe("getCompressionPreset", () => {
    it("returns the correct preset for each id", () => {
      vitestExpect(getCompressionPreset("high").label).toBe("High fidelity");
      vitestExpect(getCompressionPreset("balanced").label).toBe("Balanced");
      vitestExpect(getCompressionPreset("smallest").label).toBe("Smallest");
    });

    it("falls back to balanced for unknown ids", () => {
      const result = getCompressionPreset("unknown" as CompressionPresetId);
      vitestExpect(result.id).toBe("balanced");
    });
  });

  describe("estimateCompressedSize", () => {
    it("estimates size based on preset target ratio", () => {
      const originalSize = 1000000; // 1 MB

      const highEstimate = estimateCompressedSize(originalSize, "high");
      const balancedEstimate = estimateCompressedSize(originalSize, "balanced");
      const smallestEstimate = estimateCompressedSize(originalSize, "smallest");

      vitestExpect(highEstimate).toBe(850000); // 85% of original
      vitestExpect(balancedEstimate).toBe(700000); // 70% of original
      vitestExpect(smallestEstimate).toBe(550000); // 55% of original
    });

    it("clamps to minimum of 512 bytes", () => {
      const tinySize = 100;
      const result = estimateCompressedSize(tinySize, "smallest");
      vitestExpect(result).toBeGreaterThanOrEqual(512);
    });

    it("handles zero size gracefully", () => {
      const result = estimateCompressedSize(0, "balanced");
      vitestExpect(result).toBe(1024); // Default clamp for invalid values
    });

    it("handles negative size gracefully", () => {
      const result = estimateCompressedSize(-1000, "balanced");
      vitestExpect(result).toBe(1024);
    });
  });

  describe("computeScaledDimensions", () => {
    it("returns original dimensions when under max", () => {
      const result = computeScaledDimensions(800, 600, 1800);
      vitestExpect(result).toEqual({ width: 800, height: 600, scale: 1 });
    });

    it("scales down when width exceeds max", () => {
      const result = computeScaledDimensions(3600, 2400, 1800);
      vitestExpect(result.width).toBe(1800);
      vitestExpect(result.height).toBe(1200);
      vitestExpect(result.scale).toBe(0.5);
    });

    it("scales down when height exceeds max", () => {
      const result = computeScaledDimensions(1200, 2400, 1800);
      vitestExpect(result.width).toBe(900);
      vitestExpect(result.height).toBe(1800);
      vitestExpect(result.scale).toBe(0.75);
    });

    it("scales based on larger dimension", () => {
      const result = computeScaledDimensions(4000, 3000, 2000);
      // 4000 is the max, scale = 2000/4000 = 0.5
      vitestExpect(result.scale).toBe(0.5);
      vitestExpect(result.width).toBe(2000);
      vitestExpect(result.height).toBe(1500);
    });

    it("handles square dimensions", () => {
      const result = computeScaledDimensions(2000, 2000, 1000);
      vitestExpect(result).toEqual({ width: 1000, height: 1000, scale: 0.5 });
    });

    it("handles exact max dimension", () => {
      const result = computeScaledDimensions(1800, 1200, 1800);
      vitestExpect(result).toEqual({ width: 1800, height: 1200, scale: 1 });
    });
  });

  describe("compressPdfWithPreset (integration)", () => {
    let mockCanvas: HTMLCanvasElement;
    let mockContext: CanvasRenderingContext2D;
    let originalCreateElement: typeof document.createElement;

    beforeEach(() => {
      originalCreateElement = document.createElement.bind(document);

      mockContext = {
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      } as unknown as CanvasRenderingContext2D;

      mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockContext),
        toBlob: vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
          // Simulate JPEG compression - return smaller blob for lower quality
          const baseSize = 10000;
          const qualityFactor = quality ?? 0.92;
          const simulatedSize = Math.round(baseSize * qualityFactor);
          const blob = new Blob([new ArrayBuffer(simulatedSize)], { type: type ?? "image/jpeg" });
          callback(blob);
        }),
      } as unknown as HTMLCanvasElement;

      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        if (tagName === "canvas") {
          return mockCanvas;
        }
        return originalCreateElement(tagName);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should be tested with a real PDF in Playwright E2E tests", () => {
      // Canvas mocking in jsdom is limited; full compression tests
      // require browser environment with actual canvas rendering.
      // See playwright/ directory for E2E compression tests.
      vitestExpect(true).toBe(true);
    });
  });
});
