import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { describe, expect as vitestExpect, it } from "vitest";

import { PdfLoadError } from "./pdfErrors";
import type { LoadedPdf } from "./pdfLoader";
import { buildZipFromEntries, extractPagesFromLoadedPdf, splitPdfByChunkSize } from "./pdfSplit";

const createLoadedPdf = async (pageCount: number): Promise<LoadedPdf> => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    doc.addPage();
  }

  const data = await doc.save();
  return {
    id: "test",
    name: "sample.pdf",
    size: data.length,
    lastModified: Date.now(),
    pageCount,
    pdfVersion: "test",
    data,
    metadata: {},
    doc: null as unknown as LoadedPdf["doc"],
  };
};

describe("pdfSplit", () => {
  it("extracts sorted unique page selections into a new PDF", async () => {
    const loaded = await createLoadedPdf(5);
    const result = await extractPagesFromLoadedPdf(loaded, [4, 2, 2, 99]);
    const extracted = await PDFDocument.load(result);
    vitestExpect(extracted.getPageCount()).toBe(2);
  });

  it("throws when no valid pages are provided", async () => {
    const loaded = await createLoadedPdf(3);
    await vitestExpect(extractPagesFromLoadedPdf(loaded, [])).rejects.toThrow(PdfLoadError);
  });

  it("splits a document into evenly sized chunks", async () => {
    const loaded = await createLoadedPdf(5);
    const chunks = await splitPdfByChunkSize(loaded, 2);
    vitestExpect(chunks).toHaveLength(3);
    vitestExpect(chunks.map((chunk) => [chunk.startPage, chunk.endPage])).toEqual([
      [1, 2],
      [3, 4],
      [5, 5],
    ]);

    const finalChunk = chunks[2];
    vitestExpect(finalChunk).toBeDefined();
    const finalChunkDoc = await PDFDocument.load(finalChunk!.bytes);
    vitestExpect(finalChunkDoc.getPageCount()).toBe(1);
  });

  it("rejects invalid chunk sizes", async () => {
    const loaded = await createLoadedPdf(2);
    await vitestExpect(splitPdfByChunkSize(loaded, 0)).rejects.toThrow(PdfLoadError);
  });

  it("builds a zip archive from split entries", async () => {
    const loaded = await createLoadedPdf(3);
    const chunks = await splitPdfByChunkSize(loaded, 2);
    const entries = chunks.map((chunk, index) => ({
      fileName: `slice-${index + 1}.pdf`,
      bytes: chunk.bytes,
    }));

    const zipBytes = await buildZipFromEntries(entries);
    const parsed = await JSZip.loadAsync(zipBytes);
    const extractedFileNames = Object.entries(parsed.files)
      .filter(([, file]) => !file.dir)
      .map(([name]) => name)
      .sort();
    const expectedNames = entries.map((entry) => entry.fileName).sort();
    vitestExpect(extractedFileNames).toEqual(expectedNames);
  });
});
