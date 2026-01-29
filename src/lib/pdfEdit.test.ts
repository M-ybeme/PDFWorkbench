import { PDFDocument } from "pdf-lib";
import { describe, expect as vitestExpect, it } from "vitest";

import { PdfLoadError } from "./pdfErrors";
import type { LoadedPdf } from "./pdfLoader";
import { applyPageEdits, buildEditablePages } from "./pdfEdit";

const widthForIndex = (index: number) => 400 + index * 25;

const createLoadedPdf = async (pageCount: number): Promise<LoadedPdf> => {
  const doc = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    doc.addPage([widthForIndex(index), 600]);
  }

  const data = await doc.save();
  return {
    id: `test-${pageCount}`,
    name: `sample-${pageCount}.pdf`,
    size: data.length,
    lastModified: Date.now(),
    pageCount,
    pdfVersion: "test",
    data,
    metadata: {},
    doc: null as unknown as LoadedPdf["doc"],
  };
};

describe("pdfEdit", () => {
  it("builds editable page descriptors for a loaded PDF", async () => {
    const loaded = await createLoadedPdf(3);
    const pages = buildEditablePages(loaded);
    vitestExpect(pages).toHaveLength(3);
    vitestExpect(pages[0]).toMatchObject({ originalIndex: 0, rotation: 0, isDeleted: false });
  });

  it("applies reordered, rotated, and pruned pages when exporting", async () => {
    const loaded = await createLoadedPdf(3);
    const pages = buildEditablePages(loaded);
    const third = pages[2]!;
    const first = pages[0]!;
    const edited: typeof pages = [{ ...third }, { ...first, rotation: 90 }];

    const bytes = await applyPageEdits(loaded, edited);
    const parsed = await PDFDocument.load(bytes);

    vitestExpect(parsed.getPageCount()).toBe(2);
    const rotatedPage = parsed.getPage(1);
    vitestExpect(rotatedPage.getRotation().angle).toBe(90);
    const reorderedFirst = parsed.getPage(0);
    vitestExpect(reorderedFirst.getWidth()).toBeCloseTo(widthForIndex(2));
    vitestExpect(rotatedPage.getWidth()).toBeCloseTo(widthForIndex(0));
  });

  it("requires at least one remaining page", async () => {
    const loaded = await createLoadedPdf(2);
    const pages = buildEditablePages(loaded).map((page) => ({ ...page, isDeleted: true }));
    await vitestExpect(applyPageEdits(loaded, pages)).rejects.toThrow(PdfLoadError);
  });
});
