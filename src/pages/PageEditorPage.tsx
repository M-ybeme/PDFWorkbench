import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import clsx from "clsx";

import PasswordPromptModal from "../components/PasswordPromptModal";
import { triggerBlobDownload } from "../lib/downloads";
import { getFriendlyPdfError } from "../lib/pdfErrors";
import type { LoadedPdf, PdfPasswordReason } from "../lib/pdfLoader";
import { configurePdfWorker } from "../lib/pdfWorker";
import { buildEditedPdfFileName } from "../lib/fileNames";
import {
  applyPageEdits,
  buildEditablePageId,
  buildEditablePages,
  type EditablePage,
} from "../lib/pdfEdit";
import { useActivityLog } from "../state/activityLog";

const THUMBNAIL_SCALE = 0.22;
const HISTORY_LIMIT = 20;

const snapshotPages = (pages: EditablePage[]) => pages.map((page) => ({ ...page }));

const cloneBytesToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const pagesChanged = (a: EditablePage[], b: EditablePage[]) => {
  if (a.length !== b.length) {
    return true;
  }

  for (let index = 0; index < a.length; index += 1) {
    const first = a[index]!;
    const second = b[index];
    if (!second) {
      return true;
    }

    if (
      first.id !== second.id ||
      first.originalIndex !== second.originalIndex ||
      first.rotation !== second.rotation ||
      first.isDeleted !== second.isDeleted
    ) {
      return true;
    }
  }

  return false;
};

const dragContainsFiles = (event: DragEvent<HTMLElement>) =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

const PageEditorPage = () => {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<EditablePage[]>([]);
  const [history, setHistory] = useState<EditablePage[][]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [isFileDragActive, setFileDragActive] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [isDownloading, setDownloading] = useState(false);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    fileName: string;
    reason: PdfPasswordReason;
    resolve: (value: string | null) => void;
  } | null>(null);

  const addActivityEntry = useActivityLog((state) => state.addEntry);
  const dragSourceId = useRef<string | null>(null);

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
      setPages([]);
      setHistory([]);
      setThumbnails({});
      return;
    }

    setPages(buildEditablePages(pdf));
    setHistory([]);
    setThumbnails({});
  }, [pdf]);

  useEffect(() => {
    if (!pdf) {
      return;
    }

    let isCancelled = false;

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

          const id = buildEditablePageId(pdf.id, pageNumber - 1);
          const dataUrl = canvas.toDataURL("image/png");
          setThumbnails((current) => {
            if (current[id]) {
              return current;
            }
            return { ...current, [id]: dataUrl };
          });
        } catch (thumbnailError) {
          console.error(thumbnailError);
          if (!isCancelled) {
            setThumbnails((current) => current);
          }
          return;
        }
      }
    };

    void buildThumbnails();

    return () => {
      isCancelled = true;
    };
  }, [pdf]);

  const resetWorkspace = useCallback(() => {
    pdf?.doc.destroy();
    setPdf(null);
    setStatus("idle");
    setError(null);
    setPages([]);
    setThumbnails({});
    setHistory([]);
    setDownloadError(null);
    setDownloadSuccess(null);
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
      setDownloadError(null);
      setDownloadSuccess(null);

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
      if (!dragContainsFiles(event)) {
        return;
      }
      event.preventDefault();
      setFileDragActive(false);
      const nextFile = event.dataTransfer.files?.[0];
      void loadFile(nextFile ?? null);
    },
    [loadFile],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!dragContainsFiles(event)) {
      return;
    }
    event.preventDefault();
    setFileDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!dragContainsFiles(event)) {
      return;
    }
    event.preventDefault();
    setFileDragActive(false);
  }, []);

  const updatePages = useCallback((updater: (pages: EditablePage[]) => EditablePage[]) => {
    setPages((current) => {
      const next = updater(snapshotPages(current));
      if (!pagesChanged(current, next)) {
        return current;
      }
      setHistory((prev) => [snapshotPages(current), ...prev].slice(0, HISTORY_LIMIT));
      return next;
    });
  }, []);

  const handleRotate = useCallback(
    (pageId: string, delta: number) => {
      updatePages((current) =>
        current.map((page) =>
          page.id === pageId ? { ...page, rotation: page.rotation + delta } : page,
        ),
      );
    },
    [updatePages],
  );

  const handleToggleDelete = useCallback(
    (pageId: string) => {
      updatePages((current) =>
        current.map((page) =>
          page.id === pageId ? { ...page, isDeleted: !page.isDeleted } : page,
        ),
      );
    },
    [updatePages],
  );

  const handleReorder = useCallback(
    (targetId: string | null) => {
      const sourceId = dragSourceId.current;
      dragSourceId.current = null;

      if (!sourceId || sourceId === targetId) {
        return;
      }

      updatePages((current) => {
        const next = [...current];
        const fromIndex = next.findIndex((page) => page.id === sourceId);
        const toIndex = targetId ? next.findIndex((page) => page.id === targetId) : next.length;

        if (fromIndex === -1) {
          return current;
        }

        const [moved] = next.splice(fromIndex, 1);
        if (!moved) {
          return current;
        }
        const insertIndex = toIndex === -1 ? next.length : toIndex;
        next.splice(insertIndex, 0, moved);
        return next;
      });
    },
    [updatePages],
  );

  const handlePageDragStart = useCallback((event: DragEvent<HTMLDivElement>, pageId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", pageId);
    dragSourceId.current = pageId;
  }, []);

  const handlePageDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handlePageDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, targetId: string | null) => {
      event.preventDefault();
      const transferId = event.dataTransfer.getData("text/plain");
      if (transferId) {
        dragSourceId.current = transferId;
      }
      handleReorder(targetId);
    },
    [handleReorder],
  );

  const handleUndo = useCallback(() => {
    setHistory((current) => {
      if (current.length === 0) {
        return current;
      }
      const [latest, ...rest] = current;
      if (latest) {
        setPages(snapshotPages(latest));
      }
      return rest;
    });
  }, []);

  const handleApplyDownload = useCallback(async () => {
    if (!pdf || pages.length === 0) {
      return;
    }

    setDownloadError(null);
    setDownloadSuccess(null);
    setDownloading(true);

    try {
      const bytes = await applyPageEdits(pdf, pages);
      const blob = new Blob([cloneBytesToArrayBuffer(bytes)], { type: "application/pdf" });
      const fileName = buildEditedPdfFileName(pdf.name);
      triggerBlobDownload(blob, fileName);
      const kept = pages.filter((page) => !page.isDeleted).length;
      const deleted = pages.length - kept;
      const rotated = pages.filter((page) => ((page.rotation % 360) + 360) % 360 !== 0).length;
      setDownloadSuccess(`Exported ${kept} page${kept === 1 ? "" : "s"}.`);
      addActivityEntry({
        type: "page-edit",
        label: `Edited ${kept} page${kept === 1 ? "" : "s"}`,
        detail: `${pdf.name} · ${deleted} deleted · ${rotated} rotated`,
      });
    } catch (downloadProblem) {
      console.error(downloadProblem);
      setDownloadError(getFriendlyPdfError(downloadProblem));
    } finally {
      setDownloading(false);
    }
  }, [addActivityEntry, pages, pdf]);

  const totalPages = pages.length;
  const activePages = useMemo(() => pages.filter((page) => !page.isDeleted), [pages]);
  const canDownload = Boolean(pdf) && activePages.length > 0 && !isDownloading;
  const canUndo = history.length > 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-10">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={clsx(
          "rounded-[32px] border-2 border-dashed p-10 transition-colors",
          isFileDragActive
            ? "border-violet-400 bg-violet-50/70 dark:border-violet-300 dark:bg-violet-500/10"
            : "border-slate-300/70 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950",
        )}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center">
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">
            {pdf ? "Page editor ready" : "Reorder, rotate, and curate"}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            {pdf
              ? "Drag thumbnails to reorder, rotate pages inline, and mark deletes before exporting a fresh PDF."
              : "Drop a PDF or choose a file to render every page as a draggable tile. Then rotate, delete, undo, and export a clean edit."}
          </p>
          <div className="flex flex-col items-center gap-2">
            <label
              htmlFor="editor-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:bg-white dark:text-slate-900"
            >
              {pdf ? "Replace PDF" : "Choose a PDF"}
            </label>
            <input
              id="editor-upload"
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
        <>
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-900/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900 dark:text-white">{pdf.name}</p>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {activePages.length} active / {totalPages} total
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-300/80 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 dark:border-white/20 dark:text-slate-200 dark:hover:border-white/40 dark:hover:text-white"
                  onClick={handleUndo}
                  disabled={!canUndo}
                >
                  Undo last change
                </button>
                <button
                  type="button"
                  className="rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 disabled:translate-y-0 disabled:bg-slate-400 disabled:text-white/70 dark:bg-white dark:text-slate-900 dark:focus-visible:ring-white"
                  onClick={handleApplyDownload}
                  disabled={!canDownload}
                >
                  Apply & Download
                </button>
              </div>
            </div>
            {downloadError ? (
              <p className="mt-3 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-2 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-100">
                {downloadError}
              </p>
            ) : null}
            {downloadSuccess ? (
              <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-100">
                {downloadSuccess}
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-900/70">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Drag to reorder · Rotate · Delete
              </p>
              <p className="text-xs text-slate-400">
                Thumbnails render locally; no uploads leave your device.
              </p>
            </div>
            {pages.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Loading pages...</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pages.map((page, index) => (
                    <div
                      key={page.id}
                      role="group"
                      aria-label={`Editor page ${index + 1}`}
                      data-page-card="true"
                      draggable
                      onDragStart={(event) => handlePageDragStart(event, page.id)}
                      onDragEnd={() => {
                        dragSourceId.current = null;
                      }}
                      onDragOver={handlePageDragOver}
                      onDrop={(event) => handlePageDrop(event, page.id)}
                      className={clsx(
                        "flex flex-col gap-3 rounded-2xl border px-4 py-4 text-left transition",
                        page.isDeleted
                          ? "border-rose-200/70 bg-rose-50/60 text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/10 dark:text-rose-100"
                          : "border-slate-200/70 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200",
                      )}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                        <span>Page {index + 1}</span>
                        {page.isDeleted ? <span className="text-rose-500">Deleted</span> : null}
                      </div>
                      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 dark:border-white/10 dark:bg-slate-900/40">
                        {thumbnails[page.id] ? (
                          <img
                            src={thumbnails[page.id]}
                            alt={`Page ${index + 1}`}
                            className="h-full w-full object-contain"
                            style={{
                              transform: `rotate(${((page.rotation % 360) + 360) % 360}deg)`,
                            }}
                          />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                            Rendering…
                          </span>
                        )}
                        {page.isDeleted ? (
                          <span
                            className="absolute inset-0 bg-rose-500/10"
                            aria-hidden="true"
                          ></span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        <button
                          type="button"
                          className="flex-1 rounded-full border border-slate-200/80 px-2 py-1 text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-white/20 dark:text-slate-200 dark:hover:border-white/40 dark:hover:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRotate(page.id, -90);
                          }}
                        >
                          Rotate -90°
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-full border border-slate-200/80 px-2 py-1 text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-white/20 dark:text-slate-200 dark:hover:border-white/40 dark:hover:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRotate(page.id, 90);
                          }}
                        >
                          Rotate +90°
                        </button>
                        <button
                          type="button"
                          className={clsx(
                            "flex-1 rounded-full border px-2 py-1",
                            page.isDeleted
                              ? "border-emerald-200/80 text-emerald-700 hover:border-emerald-400 hover:text-emerald-900 dark:border-emerald-900/30 dark:text-emerald-200 dark:hover:border-emerald-600 dark:hover:text-emerald-100"
                              : "border-rose-200/80 text-rose-600 hover:border-rose-400 hover:text-rose-900 dark:border-rose-900/30 dark:text-rose-200 dark:hover:border-rose-600 dark:hover:text-rose-100",
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleDelete(page.id);
                          }}
                        >
                          {page.isDeleted ? "Restore" : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className="mt-4 rounded-2xl border border-dashed border-slate-300/70 px-4 py-2 text-center text-xs text-slate-400 dark:border-white/20"
                  role="button"
                  aria-label="Move page to end"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleReorder(null);
                    }
                  }}
                  onDragOver={handlePageDragOver}
                  onDrop={(event) => handlePageDrop(event, null)}
                >
                  Drag here to move a page to the end
                </div>
              </>
            )}
          </div>
        </>
      ) : null}

      {passwordPrompt ? (
        <PasswordPromptModal
          open={Boolean(passwordPrompt)}
          fileName={passwordPrompt.fileName}
          reason={passwordPrompt.reason}
          onSubmit={handlePasswordSubmit}
          onCancel={handlePasswordCancel}
        />
      ) : null}
    </div>
  );
};

export default PageEditorPage;
