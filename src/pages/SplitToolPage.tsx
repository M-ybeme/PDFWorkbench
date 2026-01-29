import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import clsx from "clsx";

import PasswordPromptModal from "../components/PasswordPromptModal";
import { triggerBlobDownload } from "../lib/downloads";
import { getFriendlyPdfError } from "../lib/pdfErrors";
import {
  buildSplitSelectionFileName,
  buildSplitSliceFileName,
  buildSplitZipFileName,
} from "../lib/fileNames";
import {
  buildZipFromEntries,
  extractPagesFromLoadedPdf,
  splitPdfByChunkSize,
} from "../lib/pdfSplit";
import type { LoadedPdf, PdfPasswordReason } from "../lib/pdfLoader";
import { useActivityLog } from "../state/activityLog";
import { configurePdfWorker } from "../lib/pdfWorker";

const THUMBNAIL_SCALE = 0.22;

type ThumbnailStatus = "idle" | "rendering" | "ready";

type Thumbnail = {
  pageNumber: number;
  url: string;
};

const formatBytes = (size: number) => {
  if (size === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const power = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / 1024 ** power).toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
};

const cloneBytesToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const SplitToolPage = () => {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setDragActive] = useState(false);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [thumbnailStatus, setThumbnailStatus] = useState<ThumbnailStatus>("idle");
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [splitSize, setSplitSize] = useState(5);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectionSuccess, setSelectionSuccess] = useState<string | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [bundleSuccess, setBundleSuccess] = useState<string | null>(null);
  const [isSelectionDownloading, setSelectionDownloading] = useState(false);
  const [isBundleDownloading, setBundleDownloading] = useState(false);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    fileName: string;
    reason: PdfPasswordReason;
    resolve: (value: string | null) => void;
  } | null>(null);
  const addActivityEntry = useActivityLog((state) => state.addEntry);

  useEffect(() => {
    configurePdfWorker();
  }, []);

  useEffect(() => {
    return () => {
      pdf?.doc.destroy();
    };
  }, [pdf]);

  useEffect(() => {
    if (!pdf) {
      setThumbnails([]);
      setThumbnailStatus("idle");
      return;
    }

    let isCancelled = false;
    setThumbnails([]);
    setThumbnailStatus("rendering");
    const nextThumbnails: Thumbnail[] = [];

    const buildThumbnails = async () => {
      for (let pageNumber = 1; pageNumber <= pdf.pageCount; pageNumber += 1) {
        try {
          const page = await pdf.doc.getPage(pageNumber);
          const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) {
            page.cleanup();
            continue;
          }

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const renderTask = page.render({ canvas, canvasContext: context, viewport });
          await renderTask.promise;
          page.cleanup();

          if (isCancelled) {
            return;
          }

          nextThumbnails.push({ pageNumber, url: canvas.toDataURL("image/png") });
          setThumbnails([...nextThumbnails]);
        } catch (thumbnailError) {
          console.error(thumbnailError);
          if (!isCancelled) {
            setThumbnailStatus("idle");
          }
          return;
        }
      }

      if (!isCancelled) {
        setThumbnailStatus("ready");
      }
    };

    void buildThumbnails();

    return () => {
      isCancelled = true;
    };
  }, [pdf]);

  const allPages = useMemo(() => {
    if (!pdf) {
      return [];
    }

    return Array.from({ length: pdf.pageCount }, (_, index) => index + 1);
  }, [pdf]);

  const resetWorkspace = useCallback(() => {
    pdf?.doc.destroy();
    setPdf(null);
    setStatus("idle");
    setError(null);
    setSelectedPages(new Set());
    setThumbnails([]);
    setThumbnailStatus("idle");
    setSelectionError(null);
    setSelectionSuccess(null);
    setBundleError(null);
    setBundleSuccess(null);
  }, [pdf]);

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
      if (!file) return;
      setStatus("loading");
      setError(null);
      setSelectionError(null);
      setSelectionSuccess(null);
      setBundleError(null);
      setBundleSuccess(null);

      try {
        pdf?.doc.destroy();
        const { loadPdfFromFile } = await import("../lib/pdfLoader");
        const loaded = await loadPdfFromFile(file, {
          requestPassword: (reason) =>
            new Promise<string | null>((resolve) => {
              setPasswordPrompt({ fileName: file.name, reason, resolve });
            }),
        });
        setPdf(loaded);
        setSelectedPages(new Set());
        setStatus("ready");
      } catch (loadError) {
        console.error(loadError);
        setPdf(null);
        setStatus("error");
        setError(getFriendlyPdfError(loadError));
      }
    },
    [pdf],
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
      const nextFile = event.dataTransfer.files?.[0];
      void loadFile(nextFile);
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

  const togglePageSelection = useCallback((pageNumber: number) => {
    setSelectionSuccess(null);
    setSelectionError(null);
    setSelectedPages((current) => {
      const next = new Set(current);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
  }, []);

  const applyQuickSelection = useCallback(
    (mode: "all" | "none" | "odd" | "even") => {
      if (!pdf) {
        return;
      }

      setSelectionSuccess(null);
      setSelectionError(null);

      setSelectedPages(() => {
        switch (mode) {
          case "all":
            return new Set(allPages);
          case "odd":
            return new Set(allPages.filter((page) => page % 2 === 1));
          case "even":
            return new Set(allPages.filter((page) => page % 2 === 0));
          case "none":
          default:
            return new Set();
        }
      });
    },
    [allPages, pdf],
  );

  const handleSelectionDownload = useCallback(async () => {
    if (!pdf || selectedPages.size === 0) {
      return;
    }

    setSelectionError(null);
    setSelectionSuccess(null);
    setSelectionDownloading(true);

    try {
      const selection = Array.from(selectedPages).sort((a, b) => a - b);
      const bytes = await extractPagesFromLoadedPdf(pdf, selection);
      const blob = new Blob([cloneBytesToArrayBuffer(bytes)], { type: "application/pdf" });
      const descriptor = `${selection.length}pages`;
      const fileName = buildSplitSelectionFileName(pdf.name, descriptor);
      triggerBlobDownload(blob, fileName);
      setSelectionSuccess(`Downloaded ${selection.length} page(s).`);
      addActivityEntry({
        type: "split-selection",
        label: `Exported ${selection.length} selected page${selection.length === 1 ? "" : "s"}`,
        detail: pdf.name,
      });
    } catch (selectionProblem) {
      console.error(selectionProblem);
      setSelectionError(getFriendlyPdfError(selectionProblem));
    } finally {
      setSelectionDownloading(false);
    }
  }, [addActivityEntry, pdf, selectedPages]);

  const handlePresetDownload = useCallback(async () => {
    if (!pdf) {
      return;
    }

    setBundleError(null);
    setBundleSuccess(null);
    setBundleDownloading(true);

    try {
      const chunks = await splitPdfByChunkSize(pdf, splitSize);
      const entries = chunks.map((chunk) => ({
        fileName: buildSplitSliceFileName(pdf.name, chunk.startPage, chunk.endPage, chunk.index),
        bytes: chunk.bytes,
      }));
      const zipBytes = await buildZipFromEntries(entries);
      const zipBlob = new Blob([zipBytes], { type: "application/zip" });
      const zipName = buildSplitZipFileName(pdf.name);
      triggerBlobDownload(zipBlob, zipName);
      setBundleSuccess(`Exported ${entries.length} slice(s) with ${splitSize}-page preset.`);
      addActivityEntry({
        type: "split-preset",
        label: `Bundled ${entries.length} slice${entries.length === 1 ? "" : "s"}`,
        detail: `${pdf.name} · every ${splitSize} page${splitSize === 1 ? "" : "s"}`,
      });
    } catch (presetProblem) {
      console.error(presetProblem);
      setBundleError(getFriendlyPdfError(presetProblem));
    } finally {
      setBundleDownloading(false);
    }
  }, [addActivityEntry, pdf, splitSize]);

  const handleSplitSizeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (Number.isNaN(nextValue)) {
      setSplitSize(1);
      return;
    }

    setSplitSize(Math.max(1, Math.min(200, Math.floor(nextValue))));
  }, []);

  const selectionCount = selectedPages.size;
  const canDownloadSelection = Boolean(pdf) && selectionCount > 0 && !isSelectionDownloading;
  const canPresetDownload =
    Boolean(pdf) && !isBundleDownloading && splitSize >= 1 && (pdf?.pageCount ?? 0) > 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-10">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={clsx(
          "rounded-[32px] border-2 border-dashed p-10 transition-colors",
          isDragActive
            ? "border-cyan-400 bg-cyan-50/70 dark:border-cyan-300 dark:bg-cyan-500/10"
            : "border-slate-300/70 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950",
        )}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center">
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">
            {pdf ? "Ready to split" : "Split PDFs with precision"}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            {pdf
              ? "Select pages, preview slices, and export either the highlighted set or a complete bundle every N pages."
              : "Drop a PDF or choose a file to render every page as a selectable tile. Build slices manually or generate presets before exporting."}
          </p>
          <div className="flex flex-col items-center gap-2">
            <label
              htmlFor="split-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:bg-white dark:text-slate-900"
            >
              {pdf ? "Replace PDF" : "Choose a PDF"}
            </label>
            <input
              id="split-upload"
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={handleInputChange}
            />
            <span className="text-xs uppercase tracking-wide text-slate-400">
              or drag anywhere in this panel
            </span>
            {pdf ? (
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500 underline-offset-2 hover:underline dark:text-slate-300"
                onClick={resetWorkspace}
              >
                Reset workspace
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
          {error}
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
          Loading PDF...
        </div>
      ) : null}

      {pdf ? (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-900/70">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900 dark:text-white">{pdf.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    {pdf.pageCount} pages - {formatBytes(pdf.size)}
                  </p>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-300">PDF v{pdf.pdfVersion}</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-1 text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:text-slate-200"
                  onClick={() => applyQuickSelection("all")}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-1 text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:text-slate-200"
                  onClick={() => applyQuickSelection("none")}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-1 text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:text-slate-200"
                  onClick={() => applyQuickSelection("odd")}
                >
                  Odd pages
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-1 text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:text-slate-200"
                  onClick={() => applyQuickSelection("even")}
                >
                  Even pages
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
                Selection: <span className="font-semibold text-slate-900 dark:text-white">{selectionCount}</span> page(s)
              </p>
            </section>

            <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-900/70">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Export selection
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Downloads a single PDF containing the highlighted pages.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-40 dark:bg-white dark:text-slate-900"
                  disabled={!canDownloadSelection}
                  onClick={handleSelectionDownload}
                >
                  {isSelectionDownloading ? "Preparing..." : selectionCount === 0 ? "Select pages" : "Download selection"}
                </button>
              </div>
              {selectionError ? (
                <p className="mt-3 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
                  {selectionError}
                </p>
              ) : null}
              {selectionSuccess ? (
                <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                  {selectionSuccess}
                </p>
              ) : null}
            </section>

            <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-900/70">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Split every N pages
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Auto-generate slices across the full document and download them as a zip bundle.
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-300">
                    Page interval
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={splitSize}
                    onChange={handleSplitSizeChange}
                    className="w-32 rounded-2xl border border-slate-300/70 bg-transparent px-3 py-2 text-sm dark:border-white/20"
                  />
                </div>
                <button
                  type="button"
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-40 dark:bg-white dark:text-slate-900"
                  disabled={!canPresetDownload}
                  onClick={handlePresetDownload}
                >
                  {isBundleDownloading ? "Bundling..." : `Create ${splitSize}-page slices`}
                </button>
              </div>
              {bundleError ? (
                <p className="mt-3 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
                  {bundleError}
                </p>
              ) : null}
              {bundleSuccess ? (
                <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                  {bundleSuccess}
                </p>
              ) : null}
            </section>

            <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-900/70">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Page rail
              </p>
              {thumbnailStatus === "rendering" ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">Rendering thumbnails...</p>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {thumbnails.map((thumb) => {
                  const isSelected = selectedPages.has(thumb.pageNumber);
                  return (
                    <button
                      type="button"
                      key={thumb.pageNumber}
                      onClick={() => togglePageSelection(thumb.pageNumber)}
                      className={clsx(
                        "group relative rounded-2xl border p-3 text-left transition",
                        isSelected
                          ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-400/60 dark:bg-emerald-500/10"
                          : "border-slate-200/80 bg-white/80 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/60",
                      )}
                    >
                      <img
                        src={thumb.url}
                        alt={`Page ${thumb.pageNumber}`}
                        className="h-48 w-full rounded-xl object-cover"
                      />
                      <div className="mt-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                        <span className="text-slate-500 dark:text-slate-300">Page {thumb.pageNumber}</span>
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5",
                            isSelected
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300",
                          )}
                        >
                          {isSelected ? "Selected" : "Tap to add"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {thumbnails.length === 0 && thumbnailStatus !== "rendering" ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                  Drop a PDF to see live thumbnails for selection.
                </p>
              ) : null}
            </section>
          </div>

          <aside className="space-y-4 rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-900/70">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Quick stats
              </p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-200">
                <li>Total pages: {pdf.pageCount}</li>
                <li>Selected pages: {selectionCount}</li>
                <li>Interval preset: every {splitSize} page(s)</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-slate-900/10 bg-slate-900 p-4 text-sm text-white dark:border-white/10">
              <p className="font-semibold uppercase tracking-wide text-white/70">Workflow tips</p>
              <ul className="mt-3 space-y-2 text-white/80">
                <li>Use odd/even shortcuts for alternating pulls.</li>
                <li>Re-run presets with a new interval to replace the previous bundle.</li>
                <li>Selection export keeps thumbnail order even after multiple toggles.</li>
              </ul>
            </div>
          </aside>
        </div>
      ) : (
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
          Drop a PDF to unlock thumbnail previews, selection controls, and split presets.
        </section>
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

export default SplitToolPage;
