import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState, } from "react";
import clsx from "clsx";
import PasswordPromptModal from "../components/PasswordPromptModal";
import { triggerBlobDownload } from "../lib/downloads";
import { getFriendlyPdfError } from "../lib/pdfErrors";
import { buildSplitSelectionFileName, buildSplitSliceFileName, buildSplitZipFileName, } from "../lib/fileNames";
import { buildZipFromEntries, extractPagesFromLoadedPdf, splitPdfByChunkSize, } from "../lib/pdfSplit";
import { useActivityLog } from "../state/activityLog";
import { configurePdfWorker } from "../lib/pdfWorker";
const THUMBNAIL_SCALE = 0.22;
const formatBytes = (size) => {
    if (size === 0)
        return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const power = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    return `${(size / 1024 ** power).toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
};
const cloneBytesToArrayBuffer = (bytes) => {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
};
const SplitToolPage = () => {
    const [pdf, setPdf] = useState(null);
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState(null);
    const [isDragActive, setDragActive] = useState(false);
    const [thumbnails, setThumbnails] = useState([]);
    const [thumbnailStatus, setThumbnailStatus] = useState("idle");
    const [selectedPages, setSelectedPages] = useState(new Set());
    const [splitSize, setSplitSize] = useState(5);
    const [selectionError, setSelectionError] = useState(null);
    const [selectionSuccess, setSelectionSuccess] = useState(null);
    const [bundleError, setBundleError] = useState(null);
    const [bundleSuccess, setBundleSuccess] = useState(null);
    const [isSelectionDownloading, setSelectionDownloading] = useState(false);
    const [isBundleDownloading, setBundleDownloading] = useState(false);
    const [passwordPrompt, setPasswordPrompt] = useState(null);
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
        const nextThumbnails = [];
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
                }
                catch (thumbnailError) {
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
    const handlePasswordSubmit = useCallback((password) => {
        passwordPrompt?.resolve(password);
        setPasswordPrompt(null);
    }, [passwordPrompt]);
    const handlePasswordCancel = useCallback(() => {
        passwordPrompt?.resolve(null);
        setPasswordPrompt(null);
    }, [passwordPrompt]);
    const loadFile = useCallback(async (file) => {
        if (!file)
            return;
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
                requestPassword: (reason) => new Promise((resolve) => {
                    setPasswordPrompt({ fileName: file.name, reason, resolve });
                }),
            });
            setPdf(loaded);
            setSelectedPages(new Set());
            setStatus("ready");
        }
        catch (loadError) {
            console.error(loadError);
            setPdf(null);
            setStatus("error");
            setError(getFriendlyPdfError(loadError));
        }
    }, [pdf]);
    const handleInputChange = useCallback((event) => {
        const { files } = event.target;
        const nextFile = files?.[0];
        void loadFile(nextFile);
        event.target.value = "";
    }, [loadFile]);
    const handleDrop = useCallback((event) => {
        event.preventDefault();
        setDragActive(false);
        const nextFile = event.dataTransfer.files?.[0];
        void loadFile(nextFile);
    }, [loadFile]);
    const handleDragOver = useCallback((event) => {
        event.preventDefault();
        setDragActive(true);
    }, []);
    const handleDragLeave = useCallback((event) => {
        event.preventDefault();
        setDragActive(false);
    }, []);
    const togglePageSelection = useCallback((pageNumber) => {
        setSelectionSuccess(null);
        setSelectionError(null);
        setSelectedPages((current) => {
            const next = new Set(current);
            if (next.has(pageNumber)) {
                next.delete(pageNumber);
            }
            else {
                next.add(pageNumber);
            }
            return next;
        });
    }, []);
    const applyQuickSelection = useCallback((mode) => {
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
    }, [allPages, pdf]);
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
        }
        catch (selectionProblem) {
            console.error(selectionProblem);
            setSelectionError(getFriendlyPdfError(selectionProblem));
        }
        finally {
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
        }
        catch (presetProblem) {
            console.error(presetProblem);
            setBundleError(getFriendlyPdfError(presetProblem));
        }
        finally {
            setBundleDownloading(false);
        }
    }, [addActivityEntry, pdf, splitSize]);
    const handleSplitSizeChange = useCallback((event) => {
        const nextValue = Number(event.target.value);
        if (Number.isNaN(nextValue)) {
            setSplitSize(1);
            return;
        }
        setSplitSize(Math.max(1, Math.min(200, Math.floor(nextValue))));
    }, []);
    const selectionCount = selectedPages.size;
    const canDownloadSelection = Boolean(pdf) && selectionCount > 0 && !isSelectionDownloading;
    const canPresetDownload = Boolean(pdf) && !isBundleDownloading && splitSize >= 1 && (pdf?.pageCount ?? 0) > 0;
    return (_jsxs("div", { className: "mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-10", children: [_jsx("div", { onDrop: handleDrop, onDragOver: handleDragOver, onDragLeave: handleDragLeave, className: clsx("rounded-[32px] border-2 border-dashed p-10 transition-colors", isDragActive
                    ? "border-cyan-400 bg-cyan-50/70 dark:border-cyan-300 dark:bg-cyan-500/10"
                    : "border-slate-300/70 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950"), children: _jsxs("div", { className: "mx-auto flex max-w-3xl flex-col gap-4 text-center", children: [_jsx("p", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: pdf ? "Ready to split" : "Split PDFs with precision" }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-300", children: pdf
                                ? "Select pages, preview slices, and export either the highlighted set or a complete bundle every N pages."
                                : "Drop a PDF or choose a file to render every page as a selectable tile. Build slices manually or generate presets before exporting." }), _jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx("label", { htmlFor: "split-upload", className: "inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:bg-white dark:text-slate-900", children: pdf ? "Replace PDF" : "Choose a PDF" }), _jsx("input", { id: "split-upload", type: "file", accept: "application/pdf", className: "sr-only", onChange: handleInputChange }), _jsx("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "or drag anywhere in this panel" }), pdf ? (_jsx("button", { type: "button", className: "text-xs font-semibold uppercase tracking-wide text-slate-500 underline-offset-2 hover:underline dark:text-slate-300", onClick: resetWorkspace, children: "Reset workspace" })) : null] })] }) }), error ? (_jsx("div", { className: "rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100", children: error })) : null, status === "loading" ? (_jsx("div", { className: "rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300", children: "Loading PDF..." })) : null, pdf ? (_jsxs("div", { className: "grid gap-6 lg:grid-cols-[2fr,1fr]", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("section", { className: "rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-900/70", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-base font-semibold text-slate-900 dark:text-white", children: pdf.name }), _jsxs("p", { className: "text-sm text-slate-500 dark:text-slate-300", children: [pdf.pageCount, " pages - ", formatBytes(pdf.size)] })] }), _jsxs("div", { className: "text-xs text-slate-400 dark:text-slate-300", children: ["PDF v", pdf.pdfVersion] })] }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-2 text-sm", children: [_jsx("button", { type: "button", className: "rounded-full border border-slate-200 px-4 py-1 text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:text-slate-200", onClick: () => applyQuickSelection("all"), children: "Select all" }), _jsx("button", { type: "button", className: "rounded-full border border-slate-200 px-4 py-1 text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:text-slate-200", onClick: () => applyQuickSelection("none"), children: "Clear" }), _jsx("button", { type: "button", className: "rounded-full border border-slate-200 px-4 py-1 text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:text-slate-200", onClick: () => applyQuickSelection("odd"), children: "Odd pages" }), _jsx("button", { type: "button", className: "rounded-full border border-slate-200 px-4 py-1 text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:text-slate-200", onClick: () => applyQuickSelection("even"), children: "Even pages" })] }), _jsxs("p", { className: "mt-3 text-sm text-slate-500 dark:text-slate-300", children: ["Selection: ", _jsx("span", { className: "font-semibold text-slate-900 dark:text-white", children: selectionCount }), " page(s)"] })] }), _jsxs("section", { className: "rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-900/70", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300", children: "Export selection" }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-300", children: "Downloads a single PDF containing the highlighted pages." })] }), _jsx("button", { type: "button", className: "rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-40 dark:bg-white dark:text-slate-900", disabled: !canDownloadSelection, onClick: handleSelectionDownload, children: isSelectionDownloading ? "Preparing..." : selectionCount === 0 ? "Select pages" : "Download selection" })] }), selectionError ? (_jsx("p", { className: "mt-3 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100", children: selectionError })) : null, selectionSuccess ? (_jsx("p", { className: "mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100", children: selectionSuccess })) : null] }), _jsxs("section", { className: "rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-900/70", children: [_jsxs("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300", children: "Split every N pages" }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-300", children: "Auto-generate slices across the full document and download them as a zip bundle." })] }), _jsxs("div", { className: "flex flex-col gap-2 text-sm", children: [_jsx("label", { className: "text-xs uppercase tracking-wide text-slate-400 dark:text-slate-300", children: "Page interval" }), _jsx("input", { type: "number", min: 1, max: 200, value: splitSize, onChange: handleSplitSizeChange, className: "w-32 rounded-2xl border border-slate-300/70 bg-transparent px-3 py-2 text-sm dark:border-white/20" })] }), _jsx("button", { type: "button", className: "rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-40 dark:bg-white dark:text-slate-900", disabled: !canPresetDownload, onClick: handlePresetDownload, children: isBundleDownloading ? "Bundling..." : `Create ${splitSize}-page slices` })] }), bundleError ? (_jsx("p", { className: "mt-3 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100", children: bundleError })) : null, bundleSuccess ? (_jsx("p", { className: "mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100", children: bundleSuccess })) : null] }), _jsxs("section", { className: "rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-900/70", children: [_jsx("p", { className: "text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300", children: "Page rail" }), thumbnailStatus === "rendering" ? (_jsx("p", { className: "mt-4 text-sm text-slate-500 dark:text-slate-300", children: "Rendering thumbnails..." })) : null, _jsx("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: thumbnails.map((thumb) => {
                                            const isSelected = selectedPages.has(thumb.pageNumber);
                                            return (_jsxs("button", { type: "button", onClick: () => togglePageSelection(thumb.pageNumber), className: clsx("group relative rounded-2xl border p-3 text-left transition", isSelected
                                                    ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-400/60 dark:bg-emerald-500/10"
                                                    : "border-slate-200/80 bg-white/80 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/60"), children: [_jsx("img", { src: thumb.url, alt: `Page ${thumb.pageNumber}`, className: "h-48 w-full rounded-xl object-cover" }), _jsxs("div", { className: "mt-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide", children: [_jsxs("span", { className: "text-slate-500 dark:text-slate-300", children: ["Page ", thumb.pageNumber] }), _jsx("span", { className: clsx("rounded-full px-2 py-0.5", isSelected
                                                                    ? "bg-emerald-600 text-white"
                                                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"), children: isSelected ? "Selected" : "Tap to add" })] })] }, thumb.pageNumber));
                                        }) }), thumbnails.length === 0 && thumbnailStatus !== "rendering" ? (_jsx("p", { className: "mt-4 text-sm text-slate-500 dark:text-slate-300", children: "Drop a PDF to see live thumbnails for selection." })) : null] })] }), _jsxs("aside", { className: "space-y-4 rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-900/70", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300", children: "Quick stats" }), _jsxs("ul", { className: "mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-200", children: [_jsxs("li", { children: ["Total pages: ", pdf.pageCount] }), _jsxs("li", { children: ["Selected pages: ", selectionCount] }), _jsxs("li", { children: ["Interval preset: every ", splitSize, " page(s)"] })] })] }), _jsxs("div", { className: "rounded-3xl border border-slate-900/10 bg-slate-900 p-4 text-sm text-white dark:border-white/10", children: [_jsx("p", { className: "font-semibold uppercase tracking-wide text-white/70", children: "Workflow tips" }), _jsxs("ul", { className: "mt-3 space-y-2 text-white/80", children: [_jsx("li", { children: "Use odd/even shortcuts for alternating pulls." }), _jsx("li", { children: "Re-run presets with a new interval to replace the previous bundle." }), _jsx("li", { children: "Selection export keeps thumbnail order even after multiple toggles." })] })] })] })] })) : (_jsx("section", { className: "rounded-3xl border border-slate-200/80 bg-white/90 p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300", children: "Drop a PDF to unlock thumbnail previews, selection controls, and split presets." })), _jsx(PasswordPromptModal, { open: Boolean(passwordPrompt), fileName: passwordPrompt?.fileName ?? "", reason: passwordPrompt?.reason ?? "password-required", onSubmit: handlePasswordSubmit, onCancel: handlePasswordCancel })] }));
};
export default SplitToolPage;
