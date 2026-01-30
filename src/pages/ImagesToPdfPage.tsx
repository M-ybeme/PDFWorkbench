import { useCallback, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import clsx from "clsx";
import { PDFDocument } from "pdf-lib";

import { triggerBlobDownload } from "../lib/downloads";
import { buildImagesPdfFileName } from "../lib/fileNames";
import { computeImagePlacement, type FitMode } from "../lib/imageLayout";
import { hasPngSignature, isPngBytesComplete } from "../lib/pngIntegrity";
import { type ExportResult } from "../lib/documentPipeline";
import { logExportResult } from "../state/activityLog";

const PAGE_PRESETS = [
  { id: "letter", label: "Letter · 8.5 × 11 in", width: 612, height: 792 },
  { id: "a4", label: "A4 · 210 × 297 mm", width: 595, height: 842 },
  { id: "square", label: "Square · 8 × 8 in", width: 576, height: 576 },
] as const;

const FIT_OPTIONS: { id: FitMode; label: string; description: string }[] = [
  { id: "fit", label: "Fit", description: "Scale images to fit within the page margins" },
  { id: "fill", label: "Fill", description: "Cover the page, cropping edges if needed" },
  { id: "center", label: "Center", description: "Keep original size and center on the page" },
];

const DEFAULT_MARGIN = 36;
const MAX_IMAGES = 24;

type EmbeddableMimeType = "image/png" | "image/jpeg";

const cloneBytesToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

type ImageAsset = {
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

const isImageFile = (file: File) => file.type.startsWith("image/");

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
    if (canvas.toBlob) {
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
      return;
    }
    try {
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        reject(new Error("Failed to encode image."));
        return;
      }
      const binary = atob(base64);
      const buffer = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        buffer[index] = binary.charCodeAt(index);
      }
      resolve(new Blob([buffer], { type: mimeType }));
    } catch (encodingError) {
      reject(encodingError instanceof Error ? encodingError : new Error("Failed to encode image."));
    }
  });

const blobToUint8Array = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
};

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

const ensureEmbeddableImageBytes = async (
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

  throw new Error("Unsupported image type.");
};

const buildAsset = async (file: File): Promise<ImageAsset> => {
  const [buffer, dataUrl] = await Promise.all([file.arrayBuffer(), loadDataUrl(file)]);
  const sourceBytes = new Uint8Array(buffer);
  const imageElement = await loadImageElement(dataUrl);
  const { bytes: preparedBytes, embedType } = await ensureEmbeddableImageBytes(
    file.type,
    sourceBytes,
    imageElement,
  );
  const bytes = new Uint8Array(preparedBytes.byteLength);
  bytes.set(preparedBytes);
  const width = imageElement.naturalWidth || imageElement.width;
  const height = imageElement.naturalHeight || imageElement.height;
  return {
    id: createId(),
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

const getPresetById = (id: string) =>
  PAGE_PRESETS.find((preset) => preset.id === id) ?? PAGE_PRESETS[0];

const ImagesToPdfPage = () => {
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [isDragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string>(PAGE_PRESETS[0].id);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [fitMode, setFitMode] = useState<FitMode>("fit");
  const [isGenerating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const preset = getPresetById(presetId);
  const orientedDimensions = useMemo(() => {
    if (orientation === "portrait") {
      return { width: preset.width, height: preset.height };
    }
    return { width: preset.height, height: preset.width };
  }, [orientation, preset.height, preset.width]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }
      setError(null);
      const accepted: ImageAsset[] = [];
      for (const file of Array.from(files)) {
        if (!isImageFile(file)) {
          setError("Only image files are supported.");
          continue;
        }
        if (images.length + accepted.length >= MAX_IMAGES) {
          setError(`Limit ${MAX_IMAGES} images per export.`);
          break;
        }
        try {
          const asset = await buildAsset(file);
          accepted.push(asset);
        } catch (assetError) {
          console.error(assetError);
          setError("Failed to load one of the images.");
        }
      }
      if (accepted.length > 0) {
        setImages((current) => [...current, ...accepted]);
        setStatus(`${accepted.length} image${accepted.length === 1 ? "" : "s"} ready.`);
      }
    },
    [images.length],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      void handleFiles(event.target.files);
      event.target.value = "";
    },
    [handleFiles],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      void handleFiles(event.dataTransfer?.files ?? null);
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer?.types.includes("Files")) {
      event.preventDefault();
      setDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer?.types.includes("Files")) {
      event.preventDefault();
      setDragging(false);
    }
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((current) => current.filter((image) => image.id !== id));
  }, []);

  const moveImage = useCallback((id: string, direction: -1 | 1) => {
    setImages((current) => {
      const index = current.findIndex((image) => image.id === id);
      if (index === -1) {
        return current;
      }
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      if (!item) {
        return current;
      }
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }, []);

  const clearAll = useCallback(() => {
    setImages([]);
    setStatus(null);
    setError(null);
  }, []);

  const totalSizeMb = useMemo(() => {
    const total = images.reduce((sum, image) => sum + image.size, 0);
    return (total / (1024 * 1024)).toFixed(2);
  }, [images]);

  const handleExport = useCallback(async () => {
    if (images.length === 0 || isGenerating) {
      return;
    }
    setGenerating(true);
    setError(null);
    setStatus(null);
    const startedAt = Date.now();
    try {
      const doc = await PDFDocument.create();
      for (const asset of images) {
        const page = doc.addPage([orientedDimensions.width, orientedDimensions.height]);
        const embedded =
          asset.embedType === "image/png"
            ? await doc.embedPng(asset.bytes)
            : await doc.embedJpg(asset.bytes);
        const placement = computeImagePlacement(
          asset.width,
          asset.height,
          { ...orientedDimensions, margin: DEFAULT_MARGIN },
          fitMode,
        );
        page.drawImage(embedded, {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
        });
      }
      const bytes = await doc.save();
      const blob = new Blob([cloneBytesToArrayBuffer(bytes)], { type: "application/pdf" });
      const fileName = buildImagesPdfFileName(images[0]?.name ?? null, images.length);
      const result: ExportResult = {
        blob,
        size: blob.size,
        downloadName: fileName,
        durationMs: Math.max(0, Date.now() - startedAt),
        warnings: undefined,
        activity: {
          tool: "images",
          operation: `images-to-pdf-${images.length}-pages`,
          sourceCount: images.length,
          detail: `${preset.label} · ${fitMode.toUpperCase()}`,
        },
      };

      triggerBlobDownload(result.blob, result.downloadName);
      logExportResult(result);
      setStatus(`Created PDF with ${images.length} image${images.length === 1 ? "" : "s"}.`);
    } catch (exportError) {
      console.error("handleExport error", exportError);
      setError(exportError instanceof Error ? exportError.message : "Failed to export PDF.");
    } finally {
      setGenerating(false);
    }
  }, [images, isGenerating, orientedDimensions, fitMode, preset.label]);

  const emptyState = images.length === 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:flex-row lg:px-10">
      <div className="flex-1 space-y-6">
        <div
          className={clsx(
            "rounded-3xl border-2 border-dashed p-10 text-center transition",
            isDragging
              ? "border-emerald-400 bg-emerald-50/70 dark:border-emerald-300 dark:bg-emerald-500/10"
              : "border-slate-300/70 bg-white/80 dark:border-white/10 dark:bg-slate-900/60",
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
            0.5.x · Images → PDF
          </p>
          <h1 className="mt-4 font-display text-4xl text-slate-900 dark:text-white">
            Drag in images, tune layout, download a polished PDF.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300">
            Add up to {MAX_IMAGES} images. Reorder them, choose the right page preset, and export a
            perfectly sized PDF without leaving the browser.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              className="inline-flex items-center gap-3 rounded-full bg-slate-900 px-6 py-3 text-white shadow-lg shadow-slate-900/30 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 dark:bg-white dark:text-slate-900"
              onClick={() => fileInputRef.current?.click()}
            >
              Select images ↗
            </button>
            <button
              type="button"
              className="text-sm text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300"
              onClick={clearAll}
              disabled={emptyState}
            >
              Clear list
            </button>
            <input
              ref={fileInputRef}
              id="images-upload"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleInputChange}
            />
          </div>
          {status ? (
            <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-300">{status}</p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 dark:border-white/10 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
                Image queue
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                {images.length} added · {totalSizeMb} MB
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-slate-300/70 px-4 py-2 text-sm text-slate-600 transition hover:border-slate-600 hover:text-slate-900 dark:border-white/10 dark:text-slate-300"
              onClick={() => fileInputRef.current?.click()}
            >
              Add more
            </button>
          </div>

          {emptyState ? (
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              Need inspiration? Drop PNG, JPG, or WEBP files here. We&apos;ll keep them local and
              render lightweight previews before exporting.
            </p>
          ) : (
            <ul className="mt-6 space-y-4" data-image-list="true">
              {images.map((image, index) => (
                <li
                  key={image.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-900/40 sm:flex-row"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <img
                      src={image.dataUrl}
                      alt={image.name}
                      className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white break-all">
                        Page {index + 1}: {image.name}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {Math.round(image.width)} × {Math.round(image.height)} px ·{" "}
                        {(image.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-slate-300/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-900 hover:text-slate-900 disabled:opacity-30 dark:border-white/10 dark:text-slate-300"
                      onClick={() => moveImage(image.id, -1)}
                      disabled={index === 0}
                      data-move-up="true"
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-slate-300/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-900 hover:text-slate-900 disabled:opacity-30 dark:border-white/10 dark:text-slate-300"
                      onClick={() => moveImage(image.id, 1)}
                      disabled={index === images.length - 1}
                      data-move-down="true"
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-rose-200/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:border-rose-500 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-300"
                      onClick={() => removeImage(image.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="w-full rounded-3xl border border-slate-200/70 bg-white/80 p-6 dark:border-white/10 dark:bg-slate-900/60 lg:w-80">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
          Layout presets
        </p>
        <div className="mt-4 space-y-3">
          {PAGE_PRESETS.map((option) => {
            const inputId = `page-preset-${option.id}`;
            return (
              <label
                key={option.id}
                className={clsx(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3",
                  presetId === option.id
                    ? "border-slate-900 bg-slate-900/5 text-slate-900 dark:border-white dark:bg-white/10 dark:text-white"
                    : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300",
                )}
                htmlFor={inputId}
                aria-label={option.label}
              >
                <input
                  type="radio"
                  name="page-preset"
                  className="mt-1"
                  checked={presetId === option.id}
                  onChange={() => setPresetId(option.id)}
                  id={inputId}
                />
                <div>
                  <p className="font-semibold">{option.label}</p>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    {option.width} × {option.height} pt
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
              Orientation
            </p>
            <div className="mt-3 flex gap-3">
              {(["portrait", "landscape"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={clsx(
                    "flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold capitalize",
                    orientation === option
                      ? "border-slate-900 bg-slate-900/5 text-slate-900 dark:border-white dark:bg-white/10 dark:text-white"
                      : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300",
                  )}
                  onClick={() => setOrientation(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
              Fit mode
            </p>
            <div className="mt-3 space-y-2">
              {FIT_OPTIONS.map((option) => {
                const inputId = `fit-mode-${option.id}`;
                return (
                  <label
                    key={option.id}
                    className={clsx(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3",
                      fitMode === option.id
                        ? "border-emerald-500 bg-emerald-500/5 text-emerald-900 dark:border-emerald-300/70 dark:text-emerald-100"
                        : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300",
                    )}
                    htmlFor={inputId}
                    aria-label={option.label}
                  >
                    <input
                      type="radio"
                      name="fit-mode"
                      className="mt-1"
                      checked={fitMode === option.id}
                      onChange={() => setFitMode(option.id)}
                      id={inputId}
                    />
                    <div>
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {option.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3 text-sm text-slate-500 dark:text-slate-300">
          <p>
            Each image becomes its own page. We&apos;ll apply a {DEFAULT_MARGIN / 72}
            &quot; margin.
          </p>
          <p>Everything stays on-device—no uploads or external servers.</p>
        </div>

        <button
          type="button"
          className="mt-6 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-emerald-600/40 transition hover:-translate-y-0.5 disabled:opacity-40"
          onClick={() => void handleExport()}
          disabled={images.length === 0 || isGenerating}
        >
          {isGenerating
            ? "Creating PDF..."
            : images.length === 0
              ? "Add images"
              : `Create ${images.length}-page PDF`}
        </button>
      </aside>
    </div>
  );
};

export default ImagesToPdfPage;
