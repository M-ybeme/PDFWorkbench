import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import clsx from "clsx";

import PasswordPromptModal from "../components/PasswordPromptModal";
import { triggerBlobDownload } from "../lib/downloads";
import { getFriendlyPdfError } from "../lib/pdfErrors";
import { configurePdfWorker } from "../lib/pdfWorker";
import {
  COMPRESSION_PRESETS,
  compressPdfWithPreset,
  estimateCompressedSize,
  type CompressionPresetId,
  type CompressionResult,
} from "../lib/pdfCompression";
import { logExportResult } from "../state/activityLog";
import type { LoadedPdf, PdfPasswordReason } from "../lib/pdfLoader";

const baseGuardrails = [
  "Files never leave your device—compression happens entirely in this tab.",
  "Pages are rasterized to JPEG; text/vector content loses native sharpness.",
  "Projected size estimates shown before running; actual results displayed after.",
  "Best suited for image-heavy scanned documents where rasterization is acceptable.",
];

const futureTracks = [
  "Offer an optional serverless optimizer for archival-grade compression.",
  "Playwright E2E coverage that asserts on byte savings for representative fixtures.",
];

const formatBytes = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  const power = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** power;
  return `${power === 0 ? Math.round(value) : value.toFixed(1)} ${units[power]}`;
};

const formatDate = (value: string | number | null | undefined) => {
  if (!value) {
    return "—";
  }

  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatPageSize = (pageSize: LoadedPdf["metadata"]["pageSize"]) => {
  if (!pageSize) {
    return "—";
  }

  const widthIn = pageSize.widthPt / 72;
  const heightIn = pageSize.heightPt / 72;
  return `${widthIn.toFixed(2)}" × ${heightIn.toFixed(2)}"`;
};

const CompressionToolPage = () => {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [compressionError, setCompressionError] = useState<string | null>(null);
  const [compressionSuccess, setCompressionSuccess] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CompressionResult | null>(null);
  const [presetId, setPresetId] = useState<CompressionPresetId>("balanced");
  const [isDragActive, setDragActive] = useState(false);
  const [isCompressing, setCompressing] = useState(false);
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
    setCompressionError(null);
    setCompressionSuccess(null);
    setLastResult(null);
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
      setCompressionError(null);
      setCompressionSuccess(null);

      try {
        pdf?.doc.destroy();
        const { loadPdfFromFile } = await import("../lib/pdfLoader");
        const loaded = await loadPdfFromFile(file, {
          requestPassword: requestPassword(file.name),
        });
        setPdf(loaded);
        setStatus("ready");
      } catch (loadProblem) {
        console.error("Failed to load PDF for compression", loadProblem);
        setPdf(null);
        setStatus("error");
        setLoadError(getFriendlyPdfError(loadProblem));
      }
    },
    [pdf, requestPassword],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { files } = event.target;
      const nextFile = files?.[0];
      void loadFile(nextFile);
      event.target.value = "";
    },
    [loadFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      const file = event.dataTransfer.files?.[0] ?? null;
      void loadFile(file);
    },
    [loadFile],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
  }, []);

  const sizeInsight = useMemo(() => {
    if (!pdf) {
      return null;
    }

    const projected = estimateCompressedSize(pdf.size, presetId);
    const delta = Math.max(0, pdf.size - projected);
    const percent = pdf.size > 0 ? Math.max(0, (delta / pdf.size) * 100) : 0;
    return { projected, delta, percent };
  }, [pdf, presetId]);

  const guardrailMessages = useMemo(() => {
    const messages = [...baseGuardrails];

    if (pdf && pdf.size > 50 * 1024 * 1024) {
      messages.push("Heads-up: PDFs over 50 MB may take longer to process.");
    }

    if (pdf && pdf.pageCount > 200) {
      messages.push("Large page counts can increase memory usage; keep another tab closed.");
    }

    return messages;
  }, [pdf]);

  const handleCompress = useCallback(async () => {
    if (!pdf) {
      return;
    }

    setCompressionError(null);
    setCompressionSuccess(null);
    setLastResult(null);
    setCompressing(true);

    try {
      const result = await compressPdfWithPreset(pdf, presetId, { startedAt: Date.now() });
      triggerBlobDownload(result.blob, result.downloadName);
      logExportResult(result);
      setLastResult(result);

      const savingsMsg =
        result.savings > 0
          ? `Reduced from ${formatBytes(result.originalSize)} to ${formatBytes(result.compressedSize)} (${Math.round(result.savingsPercent)}% savings)`
          : `Output size: ${formatBytes(result.compressedSize)} (no reduction achieved)`;

      setCompressionSuccess(`Saved as ${result.downloadName}. ${savingsMsg}`);
    } catch (compressionProblem) {
      console.error("Failed to run compression", compressionProblem);
      setCompressionError(getFriendlyPdfError(compressionProblem));
    } finally {
      setCompressing(false);
    }
  }, [pdf, presetId]);

  const canCompress = Boolean(pdf) && !isCompressing && status === "ready";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-10">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={clsx(
          "rounded-[32px] border-2 border-dashed p-10 transition-colors",
          isDragActive
            ? "border-amber-400 bg-amber-50/80 dark:border-amber-300 dark:bg-amber-500/10"
            : "border-slate-300/70 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950",
        )}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center">
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">
            {pdf ? "Ready for compression preview" : "Compress image-heavy PDFs"}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {pdf
              ? "Choose a preset, review projected savings, and run the preview export. Actual downscaling lands next, but the ingest/export guardrails are ready."
              : "Drop a PDF or select one manually to unlock the compression workspace. Presets focus on raster layers while text and vector content stay untouched."}
          </p>
          <div className="flex flex-col items-center gap-2">
            <label
              htmlFor="compression-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:bg-white dark:text-slate-900"
            >
              {pdf ? "Replace PDF" : "Choose a PDF"}
            </label>
            <input
              id="compression-upload"
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={handleInputChange}
            />
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
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
          <div className="flex items-center justify-between gap-4">
            <p>{loadError}</p>
            <button className="text-xs font-semibold uppercase" onClick={() => setLoadError(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {compressionError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
          <div className="flex items-center justify-between gap-4">
            <p>{compressionError}</p>
            <button
              className="text-xs font-semibold uppercase"
              onClick={() => setCompressionError(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {compressionSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50">
          <div className="flex items-center justify-between gap-4">
            <p>{compressionSuccess}</p>
            <button
              className="text-xs font-semibold uppercase"
              onClick={() => setCompressionSuccess(null)}
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
                  Quality presets
                </p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                  Choose how aggressive to go
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

            <div className="grid gap-3 md:grid-cols-3">
              {COMPRESSION_PRESETS.map((preset) => {
                const isActive = preset.id === presetId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={clsx(
                      "rounded-2xl border px-4 py-3 text-left transition",
                      isActive
                        ? "border-amber-500 bg-amber-500/10 text-amber-900 shadow-halo"
                        : "border-slate-200/70 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300",
                    )}
                    onClick={() => setPresetId(preset.id)}
                    aria-pressed={isActive}
                  >
                    <p className="text-sm font-semibold uppercase tracking-wide">{preset.label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {preset.description}
                    </p>
                    <p className="mt-3 text-xs font-mono text-slate-400">
                      Target ~{Math.round(preset.targetRatio * 100)}% of original
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-800/40 dark:text-slate-300">
              Each page is rendered to canvas and re-encoded as JPEG at the selected quality
              threshold. Text and vector sharpness may soften since the output is rasterized. Best
              results on image-heavy scanned documents.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Original
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                  {formatBytes(pdf.size)}
                </p>
                <p className="text-xs text-slate-400">{pdf.pageCount} pages</p>
              </div>
              <div
                className={clsx(
                  "rounded-2xl border p-4 text-sm",
                  lastResult
                    ? lastResult.savings > 0
                      ? "border-emerald-200/80 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-50"
                      : "border-amber-200/80 bg-amber-50/70 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50"
                    : "border-emerald-200/80 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-50",
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.3em]">
                  {lastResult ? "Compressed" : "Projected"}
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {lastResult
                    ? formatBytes(lastResult.compressedSize)
                    : sizeInsight
                      ? formatBytes(sizeInsight.projected)
                      : "—"}
                </p>
                <p className="text-xs">
                  {lastResult
                    ? lastResult.savings > 0
                      ? `${Math.round(lastResult.savingsPercent)}% reduction achieved`
                      : "No size reduction (may already be optimized)"
                    : sizeInsight
                      ? `~${Math.round(sizeInsight.percent)}% estimated savings`
                      : "Pending"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-900/60">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  Compress & Download
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Renders pages at reduced resolution and re-encodes as JPEG per preset settings.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-40 dark:bg-white dark:text-slate-900"
                onClick={handleCompress}
                disabled={!canCompress}
              >
                {isCompressing ? "Compressing..." : "Compress & Download"}
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
                <li>PDF.js version: {pdf.pdfVersion}</li>
                <li>Page size: {formatPageSize(pdf.metadata.pageSize)}</li>
                <li>Title: {pdf.metadata.title ?? "—"}</li>
                <li>Author: {pdf.metadata.author ?? "—"}</li>
                <li>Created: {formatDate(pdf.metadata.creationDate ?? pdf.lastModified)}</li>
                <li>Modified: {formatDate(pdf.metadata.modificationDate)}</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 text-sm text-slate-600 shadow-xl shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Guardrails</p>
              <ul className="mt-3 list-disc space-y-2 pl-4">
                {guardrailMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-dashed border-slate-300/70 p-5 text-sm text-slate-500 dark:border-white/20 dark:text-slate-400">
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                Next implementation beats
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-4">
                {futureTracks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
          Load a PDF to unlock preset controls, projected savings, and preview exports.
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

export default CompressionToolPage;
