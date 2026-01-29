import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import clsx from "clsx";

import PasswordPromptModal from "../components/PasswordPromptModal";
import { configurePdfWorker } from "../lib/pdfWorker";
import { loadPdfFromFile, type LoadedPdf, type PdfPasswordReason } from "../lib/pdfLoader";
import { getFriendlyPdfError } from "../lib/pdfErrors";

const formatBytes = (size: number) => {
  if (size === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const power = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / 1024 ** power).toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
};

const formatDate = (timestamp: number) => {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
};

const isPdf = (file: File) => {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
};

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const THUMBNAIL_SCALE = 0.25;
const MAX_CACHE_ENTRIES = 12;
const POINTS_PER_INCH = 72;
const PERMISSION_LABELS: Record<number, string> = {
  0x04: "Print",
  0x08: "Modify",
  0x10: "Copy",
  0x20: "Edit annotations",
  0x100: "Fill forms",
  0x200: "Copy for accessibility",
  0x400: "Assemble",
  0x800: "High-quality print",
};

const formatIsoDate = (iso?: string | null) => {
  if (!iso) {
    return "Not available";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatPageSize = (
  size?: {
    widthPt: number;
    heightPt: number;
  } | null,
) => {
  if (!size) {
    return "Not available";
  }

  const widthIn = size.widthPt / POINTS_PER_INCH;
  const heightIn = size.heightPt / POINTS_PER_INCH;
  const orientation = widthIn >= heightIn ? "Landscape" : "Portrait";
  return `${widthIn.toFixed(2)}" x ${heightIn.toFixed(2)}" (${orientation})`;
};

const formatPermissions = (permissions?: number[] | null) => {
  if (!permissions || permissions.length === 0) {
    return "All actions allowed";
  }

  const labels = permissions
    .map((flag) => PERMISSION_LABELS[flag])
    .filter((label): label is string => Boolean(label));

  if (labels.length === 0) {
    return `${permissions.length} permission flag(s)`;
  }

  return `Allowed: ${labels.join(", ")}`;
};

type ViewerStatus = "idle" | "loading" | "ready" | "error";
type ThumbnailStatus = "idle" | "rendering" | "ready";

type Thumbnail = {
  pageNumber: number;
  url: string;
};

type CachedRender = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

const PdfViewerPage = () => {
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isDragActive, setDragActive] = useState(false);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [thumbnailStatus, setThumbnailStatus] = useState<ThumbnailStatus>("idle");
  const [passwordPrompt, setPasswordPrompt] = useState<{
    fileName: string;
    reason: PdfPasswordReason;
    resolve: (value: string | null) => void;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageCacheRef = useRef<Map<string, CachedRender>>(new Map());

  useEffect(() => {
    configurePdfWorker();
  }, []);

  useEffect(() => {
    const cache = pageCacheRef.current;
    cache.clear();
    return () => {
      cache.clear();
    };
  }, [pdf?.id]);

  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      if (!pdf || !canvasRef.current) {
        return;
      }

      try {
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context) {
          return;
        }

        const cacheKey = `${pdf.id}-${currentPage}-${zoom.toFixed(2)}`;
        const cached = pageCacheRef.current.get(cacheKey);

        const drawFromCache = (entry: CachedRender) => {
          canvas.width = entry.canvas.width;
          canvas.height = entry.canvas.height;
          canvas.style.width = `${entry.width}px`;
          canvas.style.height = `${entry.height}px`;
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(entry.canvas, 0, 0);
        };

        if (cached) {
          drawFromCache(cached);
          return;
        }

        const page = await pdf.doc.getPage(currentPage);
        if (isCancelled) {
          page.cleanup();
          return;
        }

        const viewport = page.getViewport({ scale: zoom });
        const displayWidth = viewport.width;
        const displayHeight = viewport.height;
        const outputScale = window.devicePixelRatio || 1;

        const tempCanvas = document.createElement("canvas");
        const tempContext = tempCanvas.getContext("2d");

        if (!tempContext) {
          page.cleanup();
          return;
        }

        tempCanvas.width = displayWidth * outputScale;
        tempCanvas.height = displayHeight * outputScale;

        const renderContext = {
          canvas: tempCanvas,
          canvasContext: tempContext,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
          viewport,
        };

        const renderTask = page.render(renderContext);
        await renderTask.promise;
        page.cleanup();

        if (isCancelled) {
          return;
        }

        const cachedEntry: CachedRender = {
          canvas: tempCanvas,
          width: displayWidth,
          height: displayHeight,
        };

        if (pageCacheRef.current.size >= MAX_CACHE_ENTRIES) {
          const firstKey = pageCacheRef.current.keys().next().value;
          if (firstKey) {
            pageCacheRef.current.delete(firstKey);
          }
        }

        pageCacheRef.current.set(cacheKey, cachedEntry);
        drawFromCache(cachedEntry);
      } catch (renderError) {
        console.error(renderError);
        if (!isCancelled) {
          setError("Unable to render this page. Try another file.");
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [pdf, currentPage, zoom]);

  useEffect(() => {
    if (pdf && currentPage > pdf.pageCount) {
      setCurrentPage(pdf.pageCount);
    }
  }, [pdf, currentPage]);

  useEffect(() => {
    if (!pdf) {
      setThumbnails([]);
      setThumbnailStatus("idle");
      return;
    }

    let isCancelled = false;
    const nextThumbnails: Thumbnail[] = [];
    setThumbnails([]);
    setThumbnailStatus("rendering");

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

          const renderTask = page.render({
            canvas,
            canvasContext: context,
            viewport,
          });

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

  const reset = useCallback(() => {
    pdf?.doc.destroy();
    setPdf(null);
    setCurrentPage(1);
    setZoom(1);
    setStatus("idle");
    setError(null);
    setThumbnails([]);
    setThumbnailStatus("idle");
    pageCacheRef.current.clear();
  }, [pdf]);

  const loadFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      if (!isPdf(file)) {
        setStatus("error");
        setError("Please choose a valid PDF file.");
        return;
      }

      setStatus("loading");
      setError(null);

      try {
        pdf?.doc.destroy();
        const loaded = await loadPdfFromFile(file, {
          requestPassword: (reason) =>
            new Promise<string | null>((resolve) => {
              setPasswordPrompt({ fileName: file.name, reason, resolve });
            }),
        });
        setPdf(loaded);
        setCurrentPage(1);
        setZoom(1);
        setStatus("ready");
      } catch (loadError) {
        console.error(loadError);
        setStatus("error");
        setPdf(null);
        setError(getFriendlyPdfError(loadError));
      }
    },
    [pdf],
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

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      void loadFile(file);
      event.target.value = "";
    },
    [loadFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      const file = event.dataTransfer.files?.[0];
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

  const handleThumbnailSelect = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
  }, []);

  const pageDetail = useMemo(() => {
    if (!pdf) return null;
    return {
      size: formatBytes(pdf.size),
      updatedAt: formatDate(pdf.lastModified),
      creationDate: pdf.metadata.creationDate,
      modificationDate: pdf.metadata.modificationDate,
      title: pdf.metadata.title,
      author: pdf.metadata.author,
      pageSize: pdf.metadata.pageSize,
      permissions: pdf.metadata.permissions,
    };
  }, [pdf]);

  const docInfo = useMemo(() => {
    if (!pageDetail) return null;
    return {
      title: pageDetail.title ?? "Untitled",
      author: pageDetail.author ?? "Unknown",
      created: formatIsoDate(pageDetail.creationDate),
      modified: formatIsoDate(pageDetail.modificationDate),
      pageSizeLabel: formatPageSize(pageDetail.pageSize),
      permissions: formatPermissions(pageDetail.permissions),
    };
  }, [pageDetail]);

  const canGoPrev = pdf ? currentPage > 1 : false;
  const canGoNext = pdf ? currentPage < pdf.pageCount : false;

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-lg dark:border-white/10 dark:bg-slate-900/70">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
          0.2.0
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-slate-900 dark:text-white">
          PDF Viewer MVP
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300">
          Load a PDF entirely in your browser, render crisp pages via pdf.js, and prime the layout
          for thumbnails, metadata, and downstream editing flows.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-md dark:border-white/10 dark:bg-slate-900/70">
          <div
            className={clsx(
              "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition",
              isDragActive
                ? "border-emerald-400 bg-emerald-50/40 text-emerald-600"
                : "border-slate-300/80 bg-slate-50/40 text-slate-500 dark:border-white/15 dark:bg-slate-800/40 dark:text-slate-300",
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              id="viewer-upload"
              onChange={handleInputChange}
            />
            <label htmlFor="viewer-upload" className="flex flex-col items-center gap-1">
              <span className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200">
                Bring your PDF
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Drop a file or click to browse. Everything stays on-device.
              </span>
            </label>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              {status === "loading" ? "Loading…" : "Idle"}
            </p>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-200">
              {error}
            </p>
          )}

          {pdf && pageDetail && (
            <dl className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-2xl bg-slate-100/60 p-3 dark:bg-slate-800/60">
                <dt className="text-xs uppercase tracking-[0.3em] text-slate-500">File</dt>
                <dd className="text-base font-semibold text-slate-900 dark:text-white">
                  {pdf.name}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-100/60 p-3 dark:bg-slate-800/60">
                <dt className="text-xs uppercase tracking-[0.3em] text-slate-500">Pages</dt>
                <dd className="text-base font-semibold text-slate-900 dark:text-white">
                  {pdf.pageCount}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-100/60 p-3 dark:bg-slate-800/60">
                <dt className="text-xs uppercase tracking-[0.3em] text-slate-500">Size</dt>
                <dd className="text-base font-semibold text-slate-900 dark:text-white">
                  {pageDetail.size}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-100/60 p-3 dark:bg-slate-800/60">
                <dt className="text-xs uppercase tracking-[0.3em] text-slate-500">Updated</dt>
                <dd className="text-base font-semibold text-slate-900 dark:text-white">
                  {pageDetail.updatedAt}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-100/60 p-3 dark:bg-slate-800/60">
                <dt className="text-xs uppercase tracking-[0.3em] text-slate-500">pdf.js</dt>
                <dd className="text-base font-semibold text-slate-900 dark:text-white">
                  v{pdf.pdfVersion}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-100/60 p-3 dark:bg-slate-800/60">
                <dt className="text-xs uppercase tracking-[0.3em] text-slate-500">Created</dt>
                <dd className="text-base font-semibold text-slate-900 dark:text-white">
                  {docInfo?.created ?? "Not available"}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-100/60 p-3 dark:bg-slate-800/60">
                <dt className="text-xs uppercase tracking-[0.3em] text-slate-500">Modified</dt>
                <dd className="text-base font-semibold text-slate-900 dark:text-white">
                  {docInfo?.modified ?? "Not available"}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-100/60 p-3 dark:bg-slate-800/60">
                <dt className="text-xs uppercase tracking-[0.3em] text-slate-500">Page Size</dt>
                <dd className="text-base font-semibold text-slate-900 dark:text-white">
                  {docInfo?.pageSizeLabel ?? "Not available"}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-100/60 p-3 dark:bg-slate-800/60">
                <dt className="text-xs uppercase tracking-[0.3em] text-slate-500">Permissions</dt>
                <dd className="text-base font-semibold text-slate-900 dark:text-white">
                  {docInfo?.permissions ?? "Not available"}
                </dd>
              </div>
              <button
                type="button"
                className="w-full rounded-2xl border border-slate-300/60 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-white/20 dark:text-slate-200"
                onClick={reset}
              >
                Clear file
              </button>
            </dl>
          )}
        </div>

        <div className="flex flex-col rounded-3xl border border-slate-200/70 bg-slate-900/5 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
          {pdf ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm dark:bg-slate-900/70 dark:text-slate-200">
                <div>
                  Page {currentPage} / {pdf.pageCount}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-white/20"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={!canGoPrev}
                  >
                    ← Prev
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={pdf.pageCount}
                    value={currentPage}
                    onChange={(event) => setCurrentPage(Number(event.target.value))}
                  />
                  <button
                    type="button"
                    className="rounded-full border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-white/20"
                    onClick={() => setCurrentPage((prev) => Math.min(pdf.pageCount, prev + 1))}
                    disabled={!canGoNext}
                  >
                    Next →
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-slate-300 px-2 py-1 text-lg leading-none disabled:opacity-40 dark:border-white/20"
                    onClick={() =>
                      setZoom((prev) => Math.max(MIN_ZOOM, Number((prev - ZOOM_STEP).toFixed(2))))
                    }
                    disabled={zoom <= MIN_ZOOM}
                  >
                    −
                  </button>
                  <span className="w-20 text-center text-xs uppercase tracking-[0.3em] text-slate-500">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    className="rounded-full border border-slate-300 px-2 py-1 text-lg leading-none disabled:opacity-40 dark:border-white/20"
                    onClick={() =>
                      setZoom((prev) => Math.min(MAX_ZOOM, Number((prev + ZOOM_STEP).toFixed(2))))
                    }
                    disabled={zoom >= MAX_ZOOM}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-1 flex-col gap-4 lg:flex-row">
                <aside className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-sm shadow-sm dark:border-white/10 dark:bg-slate-900/70 lg:w-60">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
                      Thumbnails
                    </p>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                      {thumbnailStatus === "rendering"
                        ? "Rendering"
                        : `${thumbnails.length}/${pdf.pageCount}`}
                    </span>
                  </div>
                  <div className="mt-3 max-h-[420px] overflow-y-auto pr-2">
                    {thumbnails.length > 0 ? (
                      <ol className="space-y-3">
                        {thumbnails.map((thumb) => (
                          <li key={thumb.pageNumber}>
                            <button
                              type="button"
                              onClick={() => handleThumbnailSelect(thumb.pageNumber)}
                              className={clsx(
                                "group w-full rounded-2xl border px-2 pb-2 pt-2 transition",
                                thumb.pageNumber === currentPage
                                  ? "border-emerald-400 bg-emerald-50/60 text-emerald-700 dark:border-emerald-300/60 dark:bg-emerald-900/30 dark:text-emerald-100"
                                  : "border-slate-200 bg-white/70 text-slate-600 hover:border-slate-400 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-300",
                              )}
                            >
                              <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-slate-100 dark:border-white/10 dark:bg-slate-900/40">
                                <img
                                  src={thumb.url}
                                  alt={`Page ${thumb.pageNumber} thumbnail`}
                                  loading="lazy"
                                  className="mx-auto block"
                                />
                              </div>
                              <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.3em]">
                                Page {thumb.pageNumber}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {thumbnailStatus === "rendering"
                          ? "Rendering previews…"
                          : "Load a PDF to see previews."}
                      </p>
                    )}
                  </div>
                </aside>

                <div className="flex-1 overflow-auto rounded-2xl border border-dashed border-slate-300/70 bg-white/90 p-4 shadow-inner dark:border-white/10 dark:bg-slate-950/40">
                  <canvas ref={canvasRef} className="mx-auto shadow-2xl shadow-slate-900/10" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/70 bg-white/70 p-10 text-center text-slate-500 dark:border-white/20 dark:bg-slate-900/40 dark:text-slate-300">
              <p className="text-sm uppercase tracking-[0.4em]">Awaiting file</p>
              <p className="mt-2 font-display text-2xl text-slate-800 dark:text-white">
                Drop a PDF to preview the first page.
              </p>
              <p className="mt-3 max-w-lg text-sm text-slate-500 dark:text-slate-400">
                Once the viewer solidifies, this pane will host thumbnails, metadata, and editing
                affordances for the rest of the toolchain.
              </p>
            </div>
          )}
        </div>
      </section>
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

export default PdfViewerPage;
