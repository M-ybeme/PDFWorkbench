import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont } from "pdf-lib";

import { buildDownloadName, type ExportResult } from "./documentPipeline";
import { PdfLoadError } from "./pdfErrors";
import type { LoadedPdf } from "./pdfLoader";
import {
  dataUrlToUint8Array,
  placementToPdfRect,
  type DrawnStroke,
  type PageDimensions,
  type SignaturePlacement,
  type TextPlacement,
  textPlacementToPdfPosition,
} from "./signaturePlacement";
import type { SignatureEntry } from "../state/signatureLibrary";

const clampPageIndex = (pageNumber: number, pageCount: number) => {
  if (!Number.isFinite(pageNumber)) {
    return -1;
  }

  const index = Math.floor(pageNumber) - 1;
  if (index < 0 || index >= pageCount) {
    return -1;
  }

  return index;
};

type PageSizeCache = Map<number, PageDimensions>;

const getPageSize = (
  cache: PageSizeCache,
  pageIndex: number,
  page: { getWidth: () => number; getHeight: () => number },
): PageDimensions => {
  const existing = cache.get(pageIndex);
  if (existing) {
    return existing;
  }

  const size = { width: page.getWidth(), height: page.getHeight() };
  cache.set(pageIndex, size);
  return size;
};

type StampOptions = {
  pdf: LoadedPdf;
  placements: SignaturePlacement[];
  signatures: SignatureEntry[];
  textPlacements?: TextPlacement[];
  strokes?: DrawnStroke[];
  strokesOnTop?: boolean;
  startedAt?: number;
};

const renderStrokesToPng = (
  strokes: DrawnStroke[],
  pageSize: PageDimensions,
): Uint8Array | null => {
  if (strokes.length === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(pageSize.width);
  canvas.height = Math.round(pageSize.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;

    ctx.save();
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.widthPx * (pageSize.width / 612);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    const first = stroke.points[0]!;
    ctx.moveTo(first.xPct * canvas.width, first.yPct * canvas.height);
    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i]!;
      ctx.lineTo(p.xPct * canvas.width, p.yPct * canvas.height);
    }
    ctx.stroke();
    ctx.restore();
  }

  const dataUrl = canvas.toDataURL("image/png");
  return dataUrlToUint8Array(dataUrl);
};

export const stampSignaturesToExportResult = async ({
  pdf,
  placements,
  signatures,
  textPlacements = [],
  strokes = [],
  strokesOnTop = true,
  startedAt = Date.now(),
}: StampOptions): Promise<ExportResult> => {
  if (placements.length === 0 && textPlacements.length === 0 && strokes.length === 0) {
    throw new PdfLoadError("unsupported", "Add at least one placement.");
  }

  const doc = await PDFDocument.load(pdf.data);
  const signatureMap = new Map(signatures.map((entry) => [entry.id, entry]));
  const embedCache = new Map<string, PDFImage>();
  const sizeCache: PageSizeCache = new Map();
  const warnings: string[] = [];
  let appliedPlacements = 0;
  let appliedTextPlacements = 0;
  let appliedStrokes = 0;

  const drawStrokes = async () => {
    if (strokes.length === 0) return;
    const strokesByPage = new Map<number, DrawnStroke[]>();
    for (const stroke of strokes) {
      const pageIndex = clampPageIndex(stroke.pageNumber, doc.getPageCount());
      if (pageIndex === -1) {
        warnings.push(`Skipped stroke on invalid page ${stroke.pageNumber}`);
        continue;
      }
      const existing = strokesByPage.get(pageIndex) ?? [];
      existing.push(stroke);
      strokesByPage.set(pageIndex, existing);
    }
    for (const [pageIndex, pageStrokes] of strokesByPage) {
      const page = doc.getPage(pageIndex);
      const pageSize = getPageSize(sizeCache, pageIndex, page);
      const pngBytes = renderStrokesToPng(pageStrokes, pageSize);
      if (!pngBytes) continue;
      const image = await doc.embedPng(pngBytes);
      page.drawImage(image, { x: 0, y: 0, width: pageSize.width, height: pageSize.height });
      appliedStrokes += pageStrokes.length;
    }
  };

  if (!strokesOnTop) {
    await drawStrokes();
  }

  for (const placement of placements) {
    const signature = signatureMap.get(placement.signatureId);
    if (!signature) {
      warnings.push(`Skipped missing signature ${placement.signatureId}`);
      continue;
    }

    const pageIndex = clampPageIndex(placement.pageNumber, doc.getPageCount());
    if (pageIndex === -1) {
      warnings.push(`Skipped invalid page ${placement.pageNumber}`);
      continue;
    }

    const page = doc.getPage(pageIndex);
    const pageSize = getPageSize(sizeCache, pageIndex, page);
    const rect = placementToPdfRect(placement, pageSize);

    let image = embedCache.get(signature.id);
    if (!image) {
      image = await doc.embedPng(dataUrlToUint8Array(signature.dataUrl));
      embedCache.set(signature.id, image);
    }

    page.drawImage(image, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
    appliedPlacements += 1;
  }

  let textFont: PDFFont | null = null;
  if (textPlacements.length > 0) {
    textFont = await doc.embedFont(StandardFonts.Helvetica);
  }

  for (const placement of textPlacements) {
    const pageIndex = clampPageIndex(placement.pageNumber, doc.getPageCount());
    if (pageIndex === -1) {
      warnings.push(`Skipped invalid page ${placement.pageNumber}`);
      continue;
    }

    const page = doc.getPage(pageIndex);
    const pageSize = getPageSize(sizeCache, pageIndex, page);
    const position = textPlacementToPdfPosition(placement, pageSize);
    const [r, g, b] = hexToRgb(placement.color);

    page.drawText(placement.text, {
      x: position.x,
      y: position.y,
      size: placement.fontSizePt,
      lineHeight: placement.fontSizePt * 1.2,
      maxWidth: position.maxWidth,
      color: rgb(r, g, b),
      font: textFont ?? undefined,
    });
    appliedTextPlacements += 1;
  }

  if (strokesOnTop) {
    await drawStrokes();
  }

  if (appliedPlacements === 0 && appliedTextPlacements === 0 && appliedStrokes === 0) {
    throw new PdfLoadError("unsupported", "No valid placements could be applied.");
  }

  const bytes = await doc.save();
  const ownedBytes = new Uint8Array(bytes.length);
  ownedBytes.set(bytes);
  const blob = new Blob([ownedBytes], { type: "application/pdf" });
  const downloadName = buildDownloadName(pdf.name, "signatures");

  const detailParts: string[] = [];
  if (appliedPlacements > 0) {
    detailParts.push(`${appliedPlacements} signature${appliedPlacements === 1 ? "" : "s"}`);
  }
  if (appliedTextPlacements > 0) {
    detailParts.push(
      `${appliedTextPlacements} text block${appliedTextPlacements === 1 ? "" : "s"}`,
    );
  }
  if (appliedStrokes > 0) {
    detailParts.push(`${appliedStrokes} stroke${appliedStrokes === 1 ? "" : "s"}`);
  }
  detailParts.push(pdf.name);

  const operationParts = [];
  if (appliedPlacements > 0) {
    operationParts.push(`signatures-${appliedPlacements}`);
  }
  if (appliedTextPlacements > 0) {
    operationParts.push(`fill-${appliedTextPlacements}`);
  }
  if (appliedStrokes > 0) {
    operationParts.push(`strokes-${appliedStrokes}`);
  }
  const operation = operationParts.length ? operationParts.join("-") : "signatures";

  return {
    blob,
    size: blob.size,
    downloadName,
    durationMs: Math.max(0, Date.now() - startedAt),
    warnings: warnings.length ? warnings : undefined,
    activity: {
      tool: "signatures",
      operation,
      sourceCount: 1,
      detail: detailParts.join(" · "),
    },
  };
};

const hexToRgb = (value: string): [number, number, number] => {
  const hex = value.replace("#", "").slice(0, 6);
  const normalized = hex.padEnd(6, "0");
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return [17 / 255, 23 / 255, 42 / 255];
  }
  return [r, g, b];
};
