import { PDFDocument, degrees } from "pdf-lib";

import { PdfLoadError } from "./pdfErrors";
import type { LoadedPdf } from "./pdfLoader";

export type EditablePage = {
  id: string;
  originalIndex: number;
  rotation: number;
  isDeleted: boolean;
};

const clampRotation = (value: number) => {
  const normalized = ((value % 360) + 360) % 360;
  return normalized === 360 ? 0 : normalized;
};

export const buildEditablePageId = (pdfId: string, pageIndex: number) =>
  `${pdfId}-page-${pageIndex + 1}`;

export const buildEditablePages = (pdf: LoadedPdf): EditablePage[] =>
  Array.from({ length: pdf.pageCount }, (_, index) => ({
    id: buildEditablePageId(pdf.id, index),
    originalIndex: index,
    rotation: 0,
    isDeleted: false,
  }));

export const applyPageEdits = async (
  pdf: LoadedPdf,
  pages: EditablePage[],
): Promise<Uint8Array> => {
  const keptPages = pages.filter((page) => !page.isDeleted);

  if (keptPages.length === 0) {
    throw new PdfLoadError("unsupported", "Select at least one page before exporting.");
  }

  try {
    const source = await PDFDocument.load(pdf.data);
    const output = await PDFDocument.create();

    for (const pageState of keptPages) {
      const copied = await output.copyPages(source, [pageState.originalIndex]);
      const [page] = copied;
      if (!page) {
        continue;
      }
      const rotation = clampRotation(pageState.rotation);
      if (rotation !== 0) {
        page.setRotation(degrees(rotation));
      }
      output.addPage(page);
    }

    return output.save();
  } catch (error) {
    throw new PdfLoadError("unknown", error instanceof Error ? error.message : undefined);
  }
};
