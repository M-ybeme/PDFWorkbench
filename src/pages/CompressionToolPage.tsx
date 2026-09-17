import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

import Alert from "../components/Alert";
import PasswordPromptModal from "../components/PasswordPromptModal";
import { triggerBlobDownload } from "../lib/downloads";
import { getFriendlyPdfError } from "../lib/pdfErrors";
import {
  COMPRESSION_PRESETS,
  compressPdfWithPreset,
  estimateCompressedSize,
  type CompressionPresetId,
  type CompressionResult,
} from "../lib/pdfCompression";
import { formatBytes, formatTimestamp } from "../lib/format";
import { useDragDrop } from "../hooks/useDragDrop";
import { useLoadedPdf } from "../hooks/useLoadedPdf";
import { logExportResult } from "../state/activityLog";
import type { LoadedPdf } from "../lib/pdfLoader";

const baseGuardrails = [
  "Files never leave your device—compression happens entirely in this tab.",
  "Pages are rasterized to JPEG; text/vector content loses native sharpness.",
  "Projected size estimates shown before running; actual results displayed after.",
  "Best suited for image-heavy scanned documents where rasterization is acceptable.",
];

const formatPageSize = (pageSize: LoadedPdf["metadata"]["pageSize"]) => {
  if (!pageSize) {
    return "—";
  }

  const widthIn = pageSize.widthPt / 72;
  const heightIn = pageSize.heightPt / 72;
  return `${widthIn.toFixed(2)}" × ${heightIn.toFixed(2)}"`;
};

const CompressionToolPage = () => {
  const {
    pdf,
    status,
    error: loadError,
    passwordPrompt,
    loadFile,
    reset: resetPdf,
    clearError: clearLoadError,
    submitPassword,
    cancelPassword,
    withPdfLease,
  } = useLoadedPdf();
  const [compressionError, setCompressionError] = useState<string | null>(null);
  const [compressionSuccess, setCompressionSuccess] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CompressionResult | null>(null);
  const [presetId, setPresetId] = useState<CompressionPresetId>("balanced");
  const [isCompressing, setCompressing] = useState(false);

  // Compression keeps reading pages from the document across many `await`
  // points (see compressPdfWithPreset). If the user navigates away mid-run,
  // this page unmounts — withPdfLease keeps the document itself alive until
  // the operation finishes, but this page's own state has nothing left to
  // update, so the finally/catch blocks below check this before touching
  // React state.
  const isMountedRef = useRef(true);
  useEffect(() => {
    // Explicitly re-arm on setup, not just tear down on cleanup — React 18
    // StrictMode double-invokes effects in development (mount, cleanup,
    // mount again), and without this the cleanup-only version would leave
    // isMountedRef permanently false after that first cycle even though
    // the component is still genuinely mounted.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // A new load (including a replace) clears this tool's own result/error
  // banners the moment it starts, matching the timing of the old inline
  // clearing at the top of loadFile.
  useEffect(() => {
    if (status === "loading") {
      setCompressionError(null);
      setCompressionSuccess(null);
      setLastResult(null);
    }
  }, [status]);

  const resetWorkspace = useCallback(() => {
    if (isCompressing) {
      // Compression is still reading pages from the active document —
      // destroying it now would fail the in-flight operation with a
      // misleading error instead of the real cause.
      return;
    }
    resetPdf();
    setCompressionError(null);
    setCompressionSuccess(null);
    setLastResult(null);
  }, [isCompressing, resetPdf]);

  const handleFilesSelected = useCallback(
    (files: FileList) => {
      if (isCompressing) {
        // Replacing the file (picker, drag-drop, or Ctrl+O) destroys the
        // current document the same way Reset does — block it for the
        // same reason while compression is in flight.
        return;
      }
      void loadFile(files[0]);
    },
    [isCompressing, loadFile],
  );

  const { isDragActive, inputProps, dropZoneProps } = useDragDrop({
    accept: "application/pdf",
    onFiles: handleFilesSelected,
  });

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
      const result = await withPdfLease((leasedPdf) =>
        compressPdfWithPreset(leasedPdf, presetId, { startedAt: Date.now() }),
      );

      // The download and activity log entry are real side effects the user
      // asked for — they still happen even if this page is gone by now.
      triggerBlobDownload(result.blob, result.downloadName);
      logExportResult(result);

      if (!isMountedRef.current) {
        return;
      }

      setLastResult(result);

      const savingsMsg =
        result.savings > 0
          ? `Reduced from ${formatBytes(result.originalSize)} to ${formatBytes(result.compressedSize)} (${Math.round(result.savingsPercent)}% savings)`
          : `Output size: ${formatBytes(result.compressedSize)} (no reduction achieved)`;

      setCompressionSuccess(`Saved as ${result.downloadName}. ${savingsMsg}`);
    } catch (compressionProblem) {
      // Diagnostics are useful even if the page is gone; the error banner
      // itself has nowhere left to render.
      console.error("Failed to run compression", compressionProblem);
      if (isMountedRef.current) {
        setCompressionError(getFriendlyPdfError(compressionProblem));
      }
    } finally {
      if (isMountedRef.current) {
        setCompressing(false);
      }
    }
  }, [pdf, presetId, withPdfLease]);

  const canCompress = Boolean(pdf) && !isCompressing && status === "ready";

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
            {pdf ? "Ready to compress" : "Compress image-heavy PDFs"}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {pdf
              ? "Choose a preset, review projected savings, then compress and download the result."
              : "Drop a PDF or select one manually to unlock the compression workspace. Presets focus on raster layers while text and vector content stay untouched."}
          </p>
          <div className="flex flex-col items-center gap-2">
            <label
              htmlFor="compression-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:bg-white dark:text-slate-900"
            >
              {pdf ? "Replace PDF" : "Choose a PDF"}
            </label>
            <input id="compression-upload" {...inputProps} disabled={isCompressing} />
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
        <Alert variant="error" onDismiss={clearLoadError}>
          {loadError}
        </Alert>
      ) : null}

      {compressionError ? (
        <Alert variant="error" onDismiss={() => setCompressionError(null)}>
          {compressionError}
        </Alert>
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
                className="text-xs font-semibold uppercase tracking-widest text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline dark:text-slate-300"
                onClick={resetWorkspace}
                disabled={isCompressing}
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
                <li>Created: {formatTimestamp(pdf.metadata.creationDate ?? pdf.lastModified)}</li>
                <li>Modified: {formatTimestamp(pdf.metadata.modificationDate)}</li>
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
        onSubmit={submitPassword}
        onCancel={cancelPassword}
      />

      {isCompressing ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="compression-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-white px-10 py-10 shadow-2xl dark:bg-slate-900">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-amber-500 dark:border-slate-700 dark:border-t-amber-400" />
            <div className="text-center">
              <p
                id="compression-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                Compressing your PDF…
              </p>
              <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                This can take a minute for large files. Please keep this tab open.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CompressionToolPage;
