import { PDFDocument } from "pdf-lib";
import { describe, expect as vitestExpect, it } from "vitest";

import { PdfLoadError } from "./pdfErrors";
import type { LoadedPdf } from "./pdfLoader";
import { mergeLoadedPdfs } from "./pdfMerge";

const createLoadedPdf = async (pageCount: number, name: string): Promise<LoadedPdf> => {
  const doc = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    doc.addPage();
  }

  const data = await doc.save();
  return {
    id: `test-${name}`,
    name: `${name}.pdf`,
    size: data.length,
    lastModified: Date.now(),
    pageCount,
    pdfVersion: "test",
    data,
    metadata: {},
    doc: null as unknown as LoadedPdf["doc"],
  };
};

describe("pdfMerge", () => {
  it("merges multiple PDFs and preserves the total page count", async () => {
    const first = await createLoadedPdf(2, "alpha");
    const second = await createLoadedPdf(3, "beta");

    const mergedBytes = await mergeLoadedPdfs([first, second]);
    const parsed = await PDFDocument.load(mergedBytes);

    vitestExpect(parsed.getPageCount()).toBe(5);
  });

  it("requires at least two PDFs", async () => {
    const only = await createLoadedPdf(1, "solo");
    await vitestExpect(mergeLoadedPdfs([only])).rejects.toThrow(PdfLoadError);
  });
});
