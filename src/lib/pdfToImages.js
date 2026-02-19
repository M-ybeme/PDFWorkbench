import JSZip from "jszip";
const canvasToBlob = (canvas, format, quality) =>
  new Promise((resolve, reject) => {
    const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Canvas toBlob returned null for ${mimeType}.`));
        }
      },
      mimeType,
      format === "jpeg" ? quality : undefined,
    );
  });
const buildFileName = (baseName, pageNumber, format) => {
  const stem = baseName.replace(/\.pdf$/i, "");
  const ext = format === "jpeg" ? "jpg" : "png";
  return `${stem}-page-${String(pageNumber).padStart(3, "0")}.${ext}`;
};
export const renderPageToImage = async (pdf, pageNumber, options) => {
  const page = await pdf.doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: options.scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context unavailable.");
  }
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const blob = await canvasToBlob(canvas, options.format, options.jpegQuality ?? 0.92);
  page.cleanup();
  return {
    pageNumber,
    blob,
    width: canvas.width,
    height: canvas.height,
    format: options.format,
    fileName: buildFileName(pdf.name, pageNumber, options.format),
  };
};
export const renderAllPagesToImages = async (pdf, options, pageNumbers, onProgress) => {
  const pages = pageNumbers ?? Array.from({ length: pdf.pageCount }, (_, i) => i + 1);
  const images = [];
  for (const pageNum of pages) {
    const image = await renderPageToImage(pdf, pageNum, options);
    images.push(image);
    onProgress?.(images.length, pages.length);
  }
  return images;
};
const cloneToArrayBuffer = (source) => {
  const buffer = new ArrayBuffer(source.byteLength);
  new Uint8Array(buffer).set(source);
  return buffer;
};
export const bundleImagesAsZip = async (images) => {
  if (images.length === 0) {
    throw new Error("No images to bundle.");
  }
  const zip = new JSZip();
  for (const image of images) {
    const bytes = new Uint8Array(await image.blob.arrayBuffer());
    zip.file(image.fileName, bytes);
  }
  const archive = await zip.generateAsync({ type: "uint8array" });
  return new Blob([cloneToArrayBuffer(archive)], { type: "application/zip" });
};
