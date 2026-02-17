import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";

import Alert from "../components/Alert";
import PasswordPromptModal from "../components/PasswordPromptModal";
import { triggerBlobDownload } from "../lib/downloads";
import { formatBytes, formatTimestamp } from "../lib/format";
import { getFriendlyPdfError } from "../lib/pdfErrors";
import { mergeLoadedPdfsToExportResult } from "../lib/pdfMerge";
import { type PdfPasswordReason } from "../lib/pdfLoader";
import { useDragDrop } from "../hooks/useDragDrop";
import { logExportResult } from "../state/activityLog";
import { usePdfAssets } from "../state/pdfAssets";

const MergeToolPage = () => {
  const { assets, isBusy, error, addAsset, removeAsset, reorderAssets, clearError } =
    usePdfAssets();
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeSuccess, setMergeSuccess] = useState<string | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    fileName: string;
    reason: PdfPasswordReason;
    resolve: (value: string | null) => void;
  } | null>(null);

  const dismissMergeAlerts = useCallback(() => {
    setMergeError(null);
    setMergeSuccess(null);
  }, []);

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

  const ingestFiles = useCallback(
    (files: FileList) => {
      dismissMergeAlerts();
      for (const file of Array.from(files)) {
        void addAsset(file, { requestPassword: requestPassword(file.name) });
      }
    },
    [addAsset, dismissMergeAlerts, requestPassword],
  );

  const { isDragActive, inputProps, dropZoneProps } = useDragDrop({
    accept: "application/pdf",
    multiple: true,
    onFiles: ingestFiles,
  });

  const handleMerge = useCallback(async () => {
    if (assets.length < 2) {
      return;
    }

    dismissMergeAlerts();
    setIsMerging(true);
    try {
      const result = await mergeLoadedPdfsToExportResult(
        assets.map((asset) => asset.loaded),
        {
          sources: assets.map((asset) => asset.source),
          startedAt: Date.now(),
        },
      );

      triggerBlobDownload(result.blob, result.downloadName);

      setMergeSuccess(`Merged stack downloaded as ${result.downloadName}`);
      logExportResult(result);
    } catch (mergeProblem) {
      console.error("Failed to merge PDFs", mergeProblem);
      setMergeError(getFriendlyPdfError(mergeProblem));
    } finally {
      setIsMerging(false);
    }
  }, [assets, dismissMergeAlerts]);

  const totals = useMemo(() => {
    const totalPages = assets.reduce((sum, asset) => sum + asset.loaded.pageCount, 0);
    const totalBytes = assets.reduce((sum, asset) => sum + asset.loaded.size, 0);
    return { totalPages, totalBytes };
  }, [assets]);

  const canMerge = assets.length >= 2 && !isBusy && !isMerging;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-10">
      <div
        {...dropZoneProps}
        className={clsx(
          "rounded-3xl border-2 border-dashed p-10 text-center transition-colors",
          isDragActive
            ? "border-indigo-400 bg-indigo-50/70 dark:border-indigo-300 dark:bg-indigo-500/10"
            : "border-slate-300/70 bg-white/80 dark:border-white/10 dark:bg-slate-900/60",
        )}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <p className="text-lg font-semibold text-slate-800 dark:text-white">
            Start stacking PDFs
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Drop multiple files or select them manually. We keep the originals in-memory and
            preserve metadata for the future merge engine.
          </p>
          <div className="flex flex-col items-center gap-2">
            <label
              htmlFor="merge-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:bg-white dark:text-slate-900"
            >
              Choose PDFs
            </label>
            <input id="merge-upload" {...inputProps} />
            <span className="text-xs uppercase tracking-wide text-slate-400">
              or drag anywhere in this panel
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <Alert variant="error" onDismiss={clearError}>
          <p>{error}</p>
        </Alert>
      ) : null}

      {mergeError ? (
        <Alert variant="error" onDismiss={dismissMergeAlerts}>
          <p>{mergeError}</p>
        </Alert>
      ) : null}

      {mergeSuccess ? (
        <Alert variant="success" onDismiss={dismissMergeAlerts} dismissLabel="Hide">
          <p>{mergeSuccess}</p>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          {assets.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 text-center text-sm text-slate-500 dark:border-white/5 dark:bg-slate-900/60 dark:text-slate-300">
              No PDFs yet. Add at least two files to unlock the merge workflow preview.
            </div>
          ) : (
            <ul className="space-y-3">
              {assets.map((asset, index) => (
                <li
                  key={asset.id}
                  className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-white/5 dark:bg-slate-900/70"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-slate-900 dark:text-white break-all">
                        {asset.fileName}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-300">
                        {asset.loaded.pageCount} pages · {formatBytes(asset.loaded.size)} · Added{" "}
                        {formatTimestamp(asset.addedAt)}
                      </p>
                      {asset.loaded.metadata.title ? (
                        <p className="text-xs text-slate-400">
                          Title: {asset.loaded.metadata.title}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition hover:border-slate-300 disabled:opacity-40 dark:border-white/10 dark:text-slate-200"
                        onClick={() => {
                          dismissMergeAlerts();
                          reorderAssets(index, Math.max(0, index - 1));
                        }}
                        disabled={index === 0}
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition hover:border-slate-300 disabled:opacity-40 dark:border-white/10 dark:text-slate-200"
                        onClick={() => {
                          dismissMergeAlerts();
                          reorderAssets(index, Math.min(assets.length - 1, index + 1));
                        }}
                        disabled={index === assets.length - 1}
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-rose-100 px-3 py-1 text-rose-600 transition hover:border-rose-200 dark:border-red-900/50 dark:text-red-200"
                        onClick={() => {
                          dismissMergeAlerts();
                          removeAsset(asset.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/5 dark:bg-slate-900/60">
          <div>
            <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide dark:text-slate-300">
              Summary
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-200">
              <li>Total files: {assets.length}</li>
              <li>Total pages: {totals.totalPages}</li>
              <li>Total size: {formatBytes(totals.totalBytes)}</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
            Merge output is live. Stack PDFs, reorder them, then download the compiled file in a
            single click. Large files may take a few seconds.
          </div>
          <button
            type="button"
            className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40 dark:bg-white dark:text-slate-900"
            disabled={!canMerge}
            onClick={handleMerge}
          >
            {isMerging ? "Merging..." : "Merge & Download"}
          </button>
        </aside>
      </div>
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

export default MergeToolPage;
