import JSZip from "jszip";
import { describe, expect as vitestExpect, it } from "vitest";

import { bundleImagesAsZip, type RenderedPageImage } from "./pdfToImages";

// jsdom's Blob has no arrayBuffer(), which bundleImagesAsZip relies on, so
// reads here go through FileReader instead.
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

const createFakeRenderedImage = (fileName: string, content: string): RenderedPageImage => ({
  pageNumber: 1,
  width: 10,
  height: 10,
  format: "png",
  fileName,
  blob: {
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode(content).buffer),
  } as unknown as Blob,
});

describe("pdfToImages", () => {
  describe("bundleImagesAsZip", () => {
    it("rejects when there are no images to bundle", async () => {
      await vitestExpect(bundleImagesAsZip([])).rejects.toThrow("No images to bundle.");
    });

    it("bundles each rendered page as its own entry in the archive", async () => {
      const images = [
        createFakeRenderedImage("doc-page-001.png", "page one"),
        createFakeRenderedImage("doc-page-002.png", "page two"),
      ];

      const blob = await bundleImagesAsZip(images);
      vitestExpect(blob.type).toBe("application/zip");

      const zip = await JSZip.loadAsync(await blobToArrayBuffer(blob));
      vitestExpect(Object.keys(zip.files).sort()).toEqual(["doc-page-001.png", "doc-page-002.png"]);

      const firstEntry = await zip.file("doc-page-001.png")?.async("string");
      vitestExpect(firstEntry).toBe("page one");
    });
  });

  // renderPageToImage requires an actual pdf.js/canvas pipeline that jsdom
  // cannot provide; covered instead by playwright/pdfToImages.spec.ts.
});
