import { PDFDocument } from "pdf-lib";

import { type ExportResult } from "./documentPipeline";
import { buildImagesPdfFileName } from "./fileNames";
import { createLocalId } from "./ids";
import { computeImagePlacement, type FitMode, type PageDimensions } from "./imageLayout";
import { PdfLoadError } from "./pdfErrors";
import { hasPngSignature, isPngBytesComplete } from "./pngIntegrity";

export type EmbeddableMimeType = "image/png" | "image/jpeg";

export type ImageAsset = {
  id: string;
  name: string;
  size: number;
  type: string;
  embedType: EmbeddableMimeType;
  dataUrl: string;
  width: number;
  height: number;
  bytes: Uint8Array;
};

export type ImagesToPdfLayout = PageDimensions & { fitMode: FitMode };

export type ImagesToPdfExportOptions = ImagesToPdfLayout & {
  presetLabel: string;
  startedAt?: number;
};

export const isSupportedImageFile = (file: File) => file.type.startsWith("image/");

/**
 * Rejects a decoded image whose dimensions can't be placed on a page —
 * e.g. a corrupt-but-decodable file, or an SVG with no intrinsic size.
 * Left unchecked, computeImagePlacement silently returns a zero-size
 * placement for these, producing a blank page with no error anywhere.
 * Called both where an asset is first created and again in buildImagesPdf,
 * so a malformed ImageAsset built some other way still can't reach layout.
 */
export const ensureValidImageDimensions = (
  width: number,
  height: number,
  fileName: string,
): void => {
  if (width > 0 && height > 0) {
    return;
  }

  console.warn(`Decoded image "${fileName}" has invalid dimensions: ${width}x${height}`);
  throw new PdfLoadError(
    "unsupported",
    `"${fileName}" could not be read as an image — it may be corrupted or in an unsupported format.`,
  );
};

const cloneBytesToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const loadDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const loadImageElement = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = dataUrl;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: EmbeddableMimeType) =>
  new Promise<Blob>((resolve, reject) => {
    const quality = mimeType === "image/jpeg" ? 0.92 : undefined;
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to encode image."));
        }
      },
      mimeType,
      quality,
    );
  });

const blobToUint8Array = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
};

// Re-decodes an already-loaded <img> through a canvas to produce embeddable
// bytes — the shared fallback for both a malformed PNG (see
// ensureEmbeddableImageBytes) and any format pdf-lib can't embed directly
// (WebP, GIF, BMP, ...).
const reencodeImageElement = async (image: HTMLImageElement, mimeType: EmbeddableMimeType) => {
  const canvas = document.createElement("canvas");
  const width = image.naturalWidth || image.width || 1;
  const height = image.naturalHeight || image.height || 1;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas rendering context unavailable.");
  }
  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, mimeType);
  return blobToUint8Array(blob);
};

/**
 * Decides how a source image should be embedded into the PDF, repairing or
 * re-encoding it first when pdf-lib can't take the bytes as-is:
 *
 * - A PNG with a truncated/malformed IEND chunk (a known cause of pdf-lib's
 *   PNG parser hanging) is re-encoded through canvas; if that still doesn't
 *   produce complete PNG bytes, it falls back to JPEG.
 * - A JPEG is passed through unchanged.
 * - Anything else browser-decodable (WebP, GIF, BMP, ...) is re-encoded to
 *   JPEG, since pdf-lib only embeds PNG or JPEG directly.
 */
export const ensureEmbeddableImageBytes = async (
  fileType: string,
  bytes: Uint8Array,
  image: HTMLImageElement,
): Promise<{ bytes: Uint8Array; embedType: EmbeddableMimeType }> => {
  const normalizedType = fileType?.toLowerCase() ?? "";
  const treatAsPng = normalizedType === "image/png" || (!normalizedType && hasPngSignature(bytes));

  if (treatAsPng) {
    if (isPngBytesComplete(bytes)) {
      return { bytes, embedType: "image/png" };
    }
    try {
      const repaired = await reencodeImageElement(image, "image/png");
      if (isPngBytesComplete(repaired)) {
        return { bytes: repaired, embedType: "image/png" };
      }
    } catch (repairError) {
      console.warn("Failed to repair PNG before embedding", repairError);
    }
    const jpegFallback = await reencodeImageElement(image, "image/jpeg");
    return { bytes: jpegFallback, embedType: "image/jpeg" };
  }

  const isJpeg =
    normalizedType === "image/jpeg" ||
    normalizedType === "image/jpg" ||
    normalizedType === "image/pjpeg";

  if (isJpeg) {
    return { bytes, embedType: "image/jpeg" };
  }

  if (normalizedType.startsWith("image/") || normalizedType === "") {
    const jpegBytes = await reencodeImageElement(image, "image/jpeg");
    return { bytes: jpegBytes, embedType: "image/jpeg" };
  }

  throw new PdfLoadError("unsupported", "This file type isn't a supported image format.");
};

/** Decodes a source File into a ready-to-embed, page-display-ready asset. */
export const createImageAsset = async (file: File): Promise<ImageAsset> => {
  const [buffer, dataUrl] = await Promise.all([file.arrayBuffer(), loadDataUrl(file)]);
  const sourceBytes = new Uint8Array(buffer);
  const imageElement = await loadImageElement(dataUrl);
  const width = imageElement.naturalWidth || imageElement.width;
  const height = imageElement.naturalHeight || imageElement.height;
  ensureValidImageDimensions(width, height, file.name);

  const { bytes: preparedBytes, embedType } = await ensureEmbeddableImageBytes(
    file.type,
    sourceBytes,
    imageElement,
  );
  const bytes = new Uint8Array(preparedBytes.byteLength);
  bytes.set(preparedBytes);
  return {
    id: createLocalId("image"),
    name: file.name,
    size: file.size,
    type: file.type,
    embedType,
    dataUrl,
    width,
    height,
    bytes,
  };
};

/** Builds the final PDF, one page per image, in the given order. */
export const buildImagesPdf = async (
  images: ImageAsset[],
  layout: ImagesToPdfLayout,
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();

  for (const asset of images) {
    ensureValidImageDimensions(asset.width, asset.height, asset.name);

    const page = doc.addPage([layout.width, layout.height]);
    let embedded;
    try {
      embedded =
        asset.embedType === "image/png"
          ? await doc.embedPng(asset.bytes)
          : await doc.embedJpg(asset.bytes);
    } catch (embedError) {
      console.error(`Failed to embed image "${asset.name}"`, embedError);
      throw new PdfLoadError(
        "unsupported",
        `"${asset.name}" could not be embedded — it may be corrupted or an unsupported image format.`,
      );
    }

    const placement = computeImagePlacement(asset.width, asset.height, layout, layout.fitMode);
    page.drawImage(embedded, {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    });
  }

  return doc.save();
};

export const buildImagesPdfBlob = async (
  images: ImageAsset[],
  layout: ImagesToPdfLayout,
): Promise<Blob> => {
  const bytes = await buildImagesPdf(images, layout);
  return new Blob([cloneBytesToArrayBuffer(bytes)], { type: "application/pdf" });
};

export const buildImagesPdfExportResult = async (
  images: ImageAsset[],
  options: ImagesToPdfExportOptions,
): Promise<ExportResult> => {
  const startedAt = options.startedAt ?? Date.now();
  const blob = await buildImagesPdfBlob(images, options);
  const downloadName = buildImagesPdfFileName(images[0]?.name ?? null, images.length);

  return {
    blob,
    size: blob.size,
    downloadName,
    durationMs: Math.max(0, Date.now() - startedAt),
    warnings: undefined,
    activity: {
      tool: "images",
      operation: `images-to-pdf-${images.length}-pages`,
      sourceCount: images.length,
      detail: `${options.presetLabel} · ${options.fitMode.toUpperCase()}`,
    },
  };
};
