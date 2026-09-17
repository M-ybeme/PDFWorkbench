import { Buffer } from "node:buffer";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildImagesPdf,
  buildImagesPdfExportResult,
  ensureEmbeddableImageBytes,
  isSupportedImageFile,
} from "./imagesToPdf";
import { PdfLoadError } from "./pdfErrors";
import type { ImageAsset } from "./imagesToPdf";

const decodeBase64 = (input: string) => Uint8Array.from(Buffer.from(input, "base64"));

// Same tiny fixtures pngIntegrity.test.ts uses: a genuinely complete 1x1 PNG,
// and that same PNG with its tail cut off (missing IEND).
const VALID_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
const TRUNCATED_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABcklEQVR4nO2aMW7DMAxFj4XBjoBF4ApqgAlYgJugEliAbqACTEHbAEGpM+2STb/HBKiITnH9t1Z2TnJykUURaX7+H4BTN0iuCKUhzjkM62S2gNGCfH8TyxoIDcABmCRLHcGEbQC7ANoJI92gSyBij0Ay6SS/GG4bL6AXyE2cS2M+YvgBzJBtB/jiEgtWdOH1PjBGHbzuSCZ8ktViXEl8m2dr0HnhSqV1AlyXfQnQw5I+Ol75saSFK5DyFWqCuYXwybKEu+XQ+yUKLj6AhsZ5kWQ8ZQouPkCmxnmROduUOEPOsix/MtDQrUirGSZLmBETUEWpGpOIRNwRQkal4hE3Ba6xaVUYgsN4Dhk9dUwdZboLO4pfDoQY6lckfoHjBjKVyR+6oBczh9Z17Kvt07Xtf0/Gtnd6X7dazIooU7OWog+d1m7h2iMpw4fSfHJwN/Mxe6RCbRQpAAAAAElFTkSuQmCC";

// Minimal header-only JPEG (SOI + SOF0 declaring a 1x1 image, no scan data) —
// pdf-lib's JpegEmbedder only reads these header fields, so this is enough to
// exercise real embedding without a real encoded photo. Same fixture used by
// pdfCompression.test.ts.
const FAKE_JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x03,
]);

const createFakeImage = (width = 10, height = 10) =>
  ({ naturalWidth: width, naturalHeight: height, width, height }) as unknown as HTMLImageElement;

const createFakeAsset = (overrides: Partial<ImageAsset> = {}): ImageAsset => ({
  id: "image-1",
  name: "photo.png",
  size: 1024,
  type: "image/png",
  embedType: "image/png",
  dataUrl: "data:image/png;base64,",
  width: 100,
  height: 100,
  bytes: decodeBase64(VALID_PNG),
  ...overrides,
});

describe("isSupportedImageFile", () => {
  it("accepts any image/* MIME type", () => {
    expect(isSupportedImageFile(new File([], "a.png", { type: "image/png" }))).toBe(true);
    expect(isSupportedImageFile(new File([], "a.webp", { type: "image/webp" }))).toBe(true);
  });

  it("rejects non-image MIME types", () => {
    expect(isSupportedImageFile(new File([], "a.pdf", { type: "application/pdf" }))).toBe(false);
  });
});

describe("ensureEmbeddableImageBytes", () => {
  // toBlob() calls in these tests go through a mocked <canvas> — jsdom has
  // no real 2D canvas context, and its Blob has no arrayBuffer(), so both
  // are stood in for with plain objects.
  let canvasEncode: (mimeType: string) => Uint8Array | null;

  beforeEach(() => {
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag !== "canvas") {
        return originalCreateElement(tag);
      }
      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage: vi.fn() })),
        toBlob: vi.fn((callback: BlobCallback, mimeType: string) => {
          const bytes = canvasEncode(mimeType);
          if (!bytes) {
            callback(null);
            return;
          }
          callback({ arrayBuffer: () => Promise.resolve(bytes.buffer) } as unknown as Blob);
        }),
      } as unknown as HTMLCanvasElement;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps a complete PNG unchanged", async () => {
    const bytes = decodeBase64(VALID_PNG);
    const result = await ensureEmbeddableImageBytes("image/png", bytes, createFakeImage());
    expect(result).toEqual({ bytes, embedType: "image/png" });
  });

  it("treats an untyped file with a PNG signature as a PNG", async () => {
    const bytes = decodeBase64(VALID_PNG);
    const result = await ensureEmbeddableImageBytes("", bytes, createFakeImage());
    expect(result.embedType).toBe("image/png");
  });

  it("passes JPEG bytes through unchanged", async () => {
    const result = await ensureEmbeddableImageBytes(
      "image/jpeg",
      FAKE_JPEG_BYTES,
      createFakeImage(),
    );
    expect(result).toEqual({ bytes: FAKE_JPEG_BYTES, embedType: "image/jpeg" });
  });

  it("accepts common JPEG MIME aliases", async () => {
    const asJpg = await ensureEmbeddableImageBytes("image/jpg", FAKE_JPEG_BYTES, createFakeImage());
    const asPjpeg = await ensureEmbeddableImageBytes(
      "image/pjpeg",
      FAKE_JPEG_BYTES,
      createFakeImage(),
    );
    expect(asJpg.embedType).toBe("image/jpeg");
    expect(asPjpeg.embedType).toBe("image/jpeg");
  });

  it("re-encodes a non-native format (e.g. WebP) to JPEG", async () => {
    canvasEncode = () => FAKE_JPEG_BYTES;
    const result = await ensureEmbeddableImageBytes(
      "image/webp",
      new Uint8Array([1, 2, 3]),
      createFakeImage(),
    );
    expect(result).toEqual({ bytes: FAKE_JPEG_BYTES, embedType: "image/jpeg" });
  });

  it("repairs a malformed PNG by re-encoding it, when the repair produces complete PNG bytes", async () => {
    canvasEncode = (mimeType) => (mimeType === "image/png" ? decodeBase64(VALID_PNG) : null);
    const truncated = decodeBase64(TRUNCATED_PNG);

    const result = await ensureEmbeddableImageBytes("image/png", truncated, createFakeImage());

    expect(result.embedType).toBe("image/png");
    expect(result.bytes).toEqual(decodeBase64(VALID_PNG));
  });

  it("falls back to JPEG when the PNG repair attempt does not produce complete PNG bytes", async () => {
    // Re-encoding to PNG "succeeds" but is still truncated (simulates a
    // source image canvas can't losslessly round-trip); the JPEG fallback
    // then succeeds.
    canvasEncode = (mimeType) =>
      mimeType === "image/png" ? decodeBase64(TRUNCATED_PNG) : FAKE_JPEG_BYTES;
    const truncated = decodeBase64(TRUNCATED_PNG);

    const result = await ensureEmbeddableImageBytes("image/png", truncated, createFakeImage());

    expect(result).toEqual({ bytes: FAKE_JPEG_BYTES, embedType: "image/jpeg" });
  });

  it("propagates a rejection when both the PNG repair and the JPEG fallback fail", async () => {
    canvasEncode = () => null; // canvas.toBlob() always "fails" to encode
    const truncated = decodeBase64(TRUNCATED_PNG);

    await expect(
      ensureEmbeddableImageBytes("image/png", truncated, createFakeImage()),
    ).rejects.toThrow("Failed to encode image.");
  });

  it("throws a safe, typed error for a genuinely unsupported file type", async () => {
    await expect(
      ensureEmbeddableImageBytes("application/pdf", new Uint8Array([1]), createFakeImage()),
    ).rejects.toThrow(PdfLoadError);
  });
});

describe("buildImagesPdf", () => {
  const layout = { width: 612, height: 792, margin: 36, fitMode: "fit" as const };

  it("creates one page per image, in the given order", async () => {
    const png = createFakeAsset({ id: "a", name: "a.png" });
    const jpeg = createFakeAsset({
      id: "b",
      name: "b.jpg",
      embedType: "image/jpeg",
      bytes: FAKE_JPEG_BYTES,
    });

    const bytes = await buildImagesPdf([png, jpeg], layout);
    const parsed = await PDFDocument.load(bytes);

    expect(parsed.getPageCount()).toBe(2);
  });

  it("sizes every page to the requested layout dimensions", async () => {
    const asset = createFakeAsset();
    const bytes = await buildImagesPdf([asset], { ...layout, width: 300, height: 400 });
    const parsed = await PDFDocument.load(bytes);

    const page = parsed.getPage(0);
    expect(page.getWidth()).toBeCloseTo(300);
    expect(page.getHeight()).toBeCloseTo(400);
  });

  it("wraps an embed failure in a safe, typed error naming the offending file", async () => {
    const badAsset = createFakeAsset({
      name: "corrupt.png",
      embedType: "image/png",
      bytes: new Uint8Array([0, 1, 2, 3]), // not a real PNG — pdf-lib will reject it
    });

    await expect(buildImagesPdf([badAsset], layout)).rejects.toThrow(PdfLoadError);
    await expect(buildImagesPdf([badAsset], layout)).rejects.toThrow(/corrupt\.png/);
  });
});

describe("buildImagesPdfExportResult", () => {
  it("builds a standardized export result", async () => {
    const asset = createFakeAsset({ name: "vacation.png" });
    const layout = { width: 612, height: 792, margin: 36, fitMode: "fit" as const };

    const result = await buildImagesPdfExportResult([asset], {
      ...layout,
      presetLabel: "Letter · 8.5 × 11 in",
      startedAt: Date.now(),
    });

    expect(result.downloadName).toMatch(/vacation/);
    expect(result.size).toBeGreaterThan(0);
    expect(result.activity.tool).toBe("images");
    expect(result.activity.sourceCount).toBe(1);
    expect(result.activity.detail).toBe("Letter · 8.5 × 11 in · FIT");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
