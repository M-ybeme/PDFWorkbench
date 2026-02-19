import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import Alert from "../components/Alert";
import PasswordPromptModal from "../components/PasswordPromptModal";
import { triggerBlobDownload } from "../lib/downloads";
import { buildDownloadName } from "../lib/documentPipeline";
import { getFriendlyPdfError } from "../lib/pdfErrors";
import { configurePdfWorker } from "../lib/pdfWorker";
import { formatBytes, formatTimestamp } from "../lib/format";
import { useDragDrop } from "../hooks/useDragDrop";
import { logExportResult } from "../state/activityLog";
import {
  renderAllPagesToImages,
  bundleImagesAsZip,
  type ImageFormat,
  type ImageScale,
} from "../lib/pdfToImages";
import type { LoadedPdf, PdfPasswordReason } from "../lib/pdfLoader";

const FORMAT_OPTIONS: { id: ImageFormat; label: string }[] = [
  { id: "png", label: "PNG" },
  { id: "jpeg", label: "JPEG" },
];

const SCALE_OPTIONS: { id: ImageScale; label: string; description: string }[] = [
  { id: 1, label: "1x", description: "72 DPI — smallest files" },
  { id: 2, label: "2x", description: "144 DPI — balanced" },
  { id: 3, label: "3x", description: "216 DPI — highest quality" },
];

const PdfToImagesPage = () => {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [scale, setScale] = useState<ImageScale>(2);
  const [jpegQuality, setJpegQuality] = useState(0.92);
  const [isExporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [passwordPrompt, setPasswordPrompt] = useState<{
    fileName: string;
    reason: PdfPasswordReason;
    resolve: (value: string | null) => void;
  } | null>(null);

  useEffect(() => {
    configurePdfWorker();
  }, []);

  useEffect(() => {
    return () => {
      pdf?.doc.destroy();
    };
  }, [pdf]);

  const resetWorkspace = useCallback(() => {
    pdf?.doc.destroy();
    setPdf(null);
    setStatus("idle");
    setLoadError(null);
    setExportError(null);
    setExportSuccess(null);
    setProgress({ done: 0, total: 0 });
  }, [pdf]);

  const requestPassword = useCallback(
    (fileName: string) => (reason: PdfPasswordReason) =>
      new Promise<string | null>((resolve) => {
        setPasswordPrompt({ fileName, reason, resolve });
      }),
    [],
  );

  const handlePasswordSubmit = useCallback(
    (password: string) => {
      passwordPrompt?.resolve(password);
      setPasswordPrompt(null);
    },
    [passwordPrompt],
  );

  const handlePasswordCancel = useCallback(() => {
    passwordPrompt?.resolve(null);
    setPasswordPrompt(null);
  }, [passwordPrompt]);

  const loadFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) {
        return;
      }

      setStatus("loading");
      setLoadError(null);
      setExportError(null);
      setExportSuccess(null);

      try {
        pdf?.doc.destroy();
        const { loadPdfFromFile } = await import("../lib/pdfLoader");
        const loaded = await loadPdfFromFile(file, {
          requestPassword: requestPassword(file.name),
        });
        setPdf(loaded);
        setStatus("ready");
      } catch (loadProblem) {
        console.error("Failed to load PDF for image export", loadProblem);
        setPdf(null);
        setStatus("error");
        setLoadError(getFriendlyPdfError(loadProblem));
      }
    },
    [pdf, requestPassword],
  );

  const handleFilesSelected = useCallback(
    (files: FileList) => {
      void loadFile(files[0]);
    },
    [loadFile],
  );

  const { isDragActive, inputProps, dropZoneProps } = useDragDrop({
    accept: "application/pdf",
    onFiles: handleFilesSelected,
  });

  const handleExport = useCallback(async () => {
    if (!pdf) {
      return;
    }

    setExportError(null);
    setExportSuccess(null);
    setExporting(true);
    setProgress({ done: 0, total: pdf.pageCount });

    const startedAt = Date.now();

    try {
      const images = await renderAllPagesToImages(
        pdf,
        { format, scale, jpegQuality },
        undefined,
        (done, total) => setProgress({ done, total }),
      );

      let blob: Blob;
      let downloadName: string;

      if (images.length === 1 && images[0]) {
        blob = images[0].blob;
        downloadName = images[0].fileName;
      } else {
        blob = await bundleImagesAsZip(images);
        downloadName = buildDownloadName(pdf.name, `pages-${format}-${scale}x`, "zip");
      }

      triggerBlobDownload(blob, downloadName);

      logExportResult({
        blob,
        size: blob.size,
        downloadName,
        durationMs: Math.max(0, Date.now() - startedAt),
        activity: {
          tool: "pdf-to-images",
          operation: `export-${format}-${scale}x`,
          sourceCount: images.length,
          detail: `${images.length} page${images.length === 1 ? "" : "s"} as ${format.toUpperCase()} @ ${scale}x`,
        },
      });

      setExportSuccess(
        `Exported ${images.length} page${images.length === 1 ? "" : "s"} as ${format.toUpperCase()} — ${formatBytes(blob.size)}`,
      );
    } catch (exportProblem) {
      console.error("Failed to export images", exportProblem);
      setExportError(exportProblem instanceof Error ? exportProblem.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }, [pdf, format, scale, jpegQuality]);

  const canExport = Boolean(pdf) && !isExporting && status === "ready";

  const progressPercent = useMemo(() => {
    if (progress.total === 0) return 0;
    return Math.round((progress.done / progress.total) * 100);
  }, [progress]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-10">
      <div
        {...dropZoneProps}
        className={clsx(
          "rounded-[32px] border-2 border-dashed p-10 transition-colors",
          isDragActive
            ? "border-amber-400 bg-amber-50/80 dark:border-amber-300 dark:bg-amber-500/10"
            : "border-slate-300/70 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950",
        )}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center">
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">
            {pdf ? "Ready to export images" : "Export PDF pages as images"}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {pdf
              ? "Choose format, scale, and export. Single pages download directly; multiple pages bundle as a ZIP."
              : "Drop a PDF or select one to convert pages into PNG or JPEG images."}
          </p>
          <div className="flex flex-col items-center gap-2">
            <label
              htmlFor="pdf-to-images-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:bg-white dark:text-slate-900"
            >
              {pdf ? "Replace PDF" : "Choose a PDF"}
            </label>
            <input id="pdf-to-images-upload" {...inputProps} />
            <span className="text-xs uppercase tracking-[0.4em] text-slate-400">
              or drag files anywhere in this panel
            </span>
          </div>
        </div>
      </div>

      {status === "loading" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-50">
          Loading PDF details...
        </div>
      ) : null}

      {loadError ? (
        <Alert variant="error" onDismiss={() => setLoadError(null)}>
          {loadError}
        </Alert>
      ) : null}

      {exportError ? (
        <Alert variant="error" onDismiss={() => setExportError(null)}>
          {exportError}
        </Alert>
      ) : null}

      {exportSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50">
          <div className="flex items-center justify-between gap-4">
            <p>{exportSuccess}</p>
            <button
              className="text-xs font-semibold uppercase"
              onClick={() => setExportSuccess(null)}
            >
              Hide
            </button>
          </div>
        </div>
      ) : null}

      {pdf ? (
        <div className="grid gap-6 lg:grid-cols-[1.75fr,1fr]">
          <section className="space-y-6 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
                  Export settings
                </p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                  Configure image output
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-widest text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300"
                onClick={resetWorkspace}
              >
                Reset workspace
              </button>
            </div>

            {/* Format selector */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Format
              </p>
              <div className="flex gap-3">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={clsx(
                      "rounded-2xl border px-5 py-2.5 text-sm font-semibold transition",
                      format === opt.id
                        ? "border-amber-500 bg-amber-500/10 text-amber-900 shadow-halo dark:text-amber-100"
                        : "border-slate-200/70 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300",
                    )}
                    onClick={() => setFormat(opt.id)}
                    aria-pressed={format === opt.id}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scale selector */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Scale
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {SCALE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={clsx(
                      "rounded-2xl border px-4 py-3 text-left transition",
                      scale === opt.id
                        ? "border-amber-500 bg-amber-500/10 text-amber-900 shadow-halo dark:text-amber-100"
                        : "border-slate-200/70 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300",
                    )}
                    onClick={() => setScale(opt.id)}
                    aria-pressed={scale === opt.id}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {opt.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* JPEG quality slider */}
            {format === "jpeg" ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  JPEG quality — {Math.round(jpegQuality * 100)}%
                </p>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.01}
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(Number(e.target.value))}
                  className="w-full accent-amber-500"
                  aria-label="JPEG quality"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                  <span>Smallest</span>
                  <span>Highest</span>
                </div>
              </div>
            ) : null}

            {/* Progress bar */}
            {isExporting ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Rendering page {progress.done} of {progress.total}...
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : null}

            {/* Export button */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-900/60">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  Export as {format.toUpperCase()}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {pdf.pageCount === 1
                    ? "Downloads the page directly."
                    : `Bundles ${pdf.pageCount} pages into a ZIP archive.`}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-40 dark:bg-white dark:text-slate-900"
                onClick={handleExport}
                disabled={!canExport}
              >
                {isExporting ? "Exporting..." : "Export Images"}
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 text-sm text-slate-600 shadow-xl shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">PDF details</p>
              <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                {pdf.name}
              </p>
              <ul className="mt-3 space-y-1">
                <li>Size: {formatBytes(pdf.size)}</li>
                <li>Pages: {pdf.pageCount}</li>
                <li>PDF version: {pdf.pdfVersion}</li>
                <li>Title: {pdf.metadata.title ?? "—"}</li>
                <li>Author: {pdf.metadata.author ?? "—"}</li>
                <li>Created: {formatTimestamp(pdf.metadata.creationDate ?? pdf.lastModified)}</li>
                <li>Modified: {formatTimestamp(pdf.metadata.modificationDate)}</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 text-sm text-slate-600 shadow-xl shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">How it works</p>
              <ul className="mt-3 list-disc space-y-2 pl-4">
                <li>Each page is rendered to an off-screen canvas at the chosen scale.</li>
                <li>
                  The canvas is exported as PNG (lossless) or JPEG (lossy, adjustable quality).
                </li>
                <li>Multiple pages are bundled into a ZIP; single pages download directly.</li>
                <li>All processing happens in your browser — files never leave your device.</li>
              </ul>
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
          Load a PDF to choose format, scale, and export pages as images.
        </div>
      )}

      <PasswordPromptModal
        open={Boolean(passwordPrompt)}
        fileName={passwordPrompt?.fileName ?? ""}
        reason={passwordPrompt?.reason ?? "password-required"}
        onSubmit={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
      />
    </div>
  );
};

export default PdfToImagesPage;
