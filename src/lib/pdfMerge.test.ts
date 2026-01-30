import { PDFDocument } from "pdf-lib";
import { describe, expect as vitestExpect, it } from "vitest";

import { PdfLoadError } from "./pdfErrors";
import type { LoadedPdf } from "./pdfLoader";
import type { PdfSource } from "./documentPipeline";
import { mergeLoadedPdfs, mergeLoadedPdfsToExportResult } from "./pdfMerge";

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

const createPdfSource = (name: string): PdfSource => ({
  id: `source-${name}`,
  origin: "upload",
  name,
  size: 2048,
  lastModified: Date.now(),
  bytes: new Uint8Array(),
  password: null,
});

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

  it("builds a standardized export result", async () => {
    const first = await createLoadedPdf(1, "alpha");
    const second = await createLoadedPdf(2, "beta");
    const sources = [createPdfSource("alpha.pdf"), createPdfSource("beta.pdf")];

    const result = await mergeLoadedPdfsToExportResult([first, second], { sources });

    vitestExpect(result.downloadName).toMatch(/alpha/);
    vitestExpect(result.size).toBeGreaterThan(0);
    vitestExpect(result.activity.tool).toBe("merge");
    vitestExpect(result.activity.sourceCount).toBe(2);
    vitestExpect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
