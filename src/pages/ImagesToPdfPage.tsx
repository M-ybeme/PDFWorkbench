import { useCallback, useMemo, useRef, useState } from "react";
import clsx from "clsx";

import { triggerBlobDownload } from "../lib/downloads";
import { type FitMode } from "../lib/imageLayout";
import {
  buildImagesPdfExportResult,
  createImageAsset,
  isSupportedImageFile,
  type ImageAsset,
} from "../lib/imagesToPdf";
import { getFriendlyPdfError } from "../lib/pdfErrors";
import { useDragDrop } from "../hooks/useDragDrop";
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

const getPresetById = (id: string) =>
  PAGE_PRESETS.find((preset) => preset.id === id) ?? PAGE_PRESETS[0];

const ImagesToPdfPage = () => {
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string>(PAGE_PRESETS[0].id);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [fitMode, setFitMode] = useState<FitMode>("fit");
  const [isGenerating, setGenerating] = useState(false);

  // Identifies the current ingest batch. Bumped whenever a new selection
  // starts or the list is cleared, so a batch that's still decoding when
  // superseded can notice (once it finishes) that it's stale and must not
  // touch state — otherwise its results could land after a Clear, or two
  // overlapping batches could both under-count MAX_IMAGES against the same
  // stale `images.length`.
  const ingestRequestRef = useRef(0);

  const preset = getPresetById(presetId);
  const orientedDimensions = useMemo(() => {
    if (orientation === "portrait") {
      return { width: preset.width, height: preset.height };
    }
    return { width: preset.height, height: preset.width };
  }, [orientation, preset.height, preset.width]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    // Claim this as the current batch. Any earlier in-flight batch that
    // later finds ingestRequestRef.current has moved past its own id knows
    // it's been superseded (by this batch, or by Clear) and must discard
    // its results instead of committing them.
    const requestId = ++ingestRequestRef.current;
    setError(null);

    const accepted: ImageAsset[] = [];
    let hadUnsupportedFile = false;
    let hadDecodeFailure = false;

    for (const file of Array.from(files)) {
      if (!isSupportedImageFile(file)) {
        hadUnsupportedFile = true;
        continue;
      }
      try {
        const asset = await createImageAsset(file);
        accepted.push(asset);
      } catch (assetError) {
        console.error(assetError);
        hadDecodeFailure = true;
      }
    }

    if (requestId !== ingestRequestRef.current) {
      // Superseded while decoding — drop this batch's results entirely
      // rather than mutating state (or its success/error banners) after
      // the fact.
      return;
    }

    let addedCount = 0;
    let cappedCount = 0;
    if (accepted.length > 0) {
      setImages((current) => {
        // Enforce MAX_IMAGES against the real current list at commit time,
        // not the stale `images.length` this closure was created with —
        // two overlapping batches can otherwise both under-count the same
        // snapshot and together exceed the cap.
        const capacity = Math.max(0, MAX_IMAGES - current.length);
        const toAdd = accepted.slice(0, capacity);
        addedCount = toAdd.length;
        cappedCount = accepted.length - toAdd.length;
        return toAdd.length > 0 ? [...current, ...toAdd] : current;
      });
    }

    if (cappedCount > 0) {
      setError(`Limit ${MAX_IMAGES} images per export.`);
    } else if (hadUnsupportedFile) {
      setError("Only image files are supported.");
    } else if (hadDecodeFailure) {
      setError("Failed to load one of the images.");
    }

    if (addedCount > 0) {
      setStatus(`${addedCount} image${addedCount === 1 ? "" : "s"} ready.`);
    }
  }, []);

  const onFilesReceived = useCallback(
    (files: FileList) => {
      void handleFiles(files);
    },
    [handleFiles],
  );

  const {
    isDragActive: isDragging,
    inputProps,
    dropZoneProps,
    openFilePicker,
  } = useDragDrop({
    accept: "image/*",
    multiple: true,
    onFiles: onFilesReceived,
  });

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
    ingestRequestRef.current += 1; // invalidate any in-flight ingest batch
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
      const result = await buildImagesPdfExportResult(images, {
        ...orientedDimensions,
        margin: DEFAULT_MARGIN,
        fitMode,
        presetLabel: preset.label,
        startedAt,
      });

      triggerBlobDownload(result.blob, result.downloadName);
      logExportResult(result);
      setStatus(`Created PDF with ${images.length} image${images.length === 1 ? "" : "s"}.`);
    } catch (exportError) {
      console.error("Failed to export images-to-PDF", exportError);
      setError(getFriendlyPdfError(exportError));
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
          {...dropZoneProps}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
            Images → PDF
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
              onClick={() => openFilePicker()}
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
            <input id="images-upload" {...inputProps} />
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
              onClick={() => openFilePicker()}
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
                aria-label={option.label}
                className={clsx(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3",
                  presetId === option.id
                    ? "border-slate-900 bg-slate-900/5 text-slate-900 dark:border-white dark:bg-white/10 dark:text-white"
                    : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300",
                )}
                htmlFor={inputId}
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
                    aria-label={option.label}
                    className={clsx(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3",
                      fitMode === option.id
                        ? "border-emerald-500 bg-emerald-500/5 text-emerald-900 dark:border-emerald-300/70 dark:text-emerald-100"
                        : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300",
                    )}
                    htmlFor={inputId}
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
