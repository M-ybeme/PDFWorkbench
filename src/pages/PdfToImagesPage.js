import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import PasswordPromptModal from "../components/PasswordPromptModal";
import { triggerBlobDownload } from "../lib/downloads";
import { buildDownloadName } from "../lib/documentPipeline";
import { getFriendlyPdfError } from "../lib/pdfErrors";
import { configurePdfWorker } from "../lib/pdfWorker";
import { formatBytes, formatTimestamp } from "../lib/format";
import { useDragDrop } from "../hooks/useDragDrop";
import { logExportResult } from "../state/activityLog";
import { renderAllPagesToImages, bundleImagesAsZip, } from "../lib/pdfToImages";
const FORMAT_OPTIONS = [
    { id: "png", label: "PNG" },
    { id: "jpeg", label: "JPEG" },
];
const SCALE_OPTIONS = [
    { id: 1, label: "1x", description: "72 DPI — smallest files" },
    { id: 2, label: "2x", description: "144 DPI — balanced" },
    { id: 3, label: "3x", description: "216 DPI — highest quality" },
];
const PdfToImagesPage = () => {
    const [pdf, setPdf] = useState(null);
    const [status, setStatus] = useState("idle");
    const [loadError, setLoadError] = useState(null);
    const [exportError, setExportError] = useState(null);
    const [exportSuccess, setExportSuccess] = useState(null);
    const [format, setFormat] = useState("png");
    const [scale, setScale] = useState(2);
    const [jpegQuality, setJpegQuality] = useState(0.92);
    const [isExporting, setExporting] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [passwordPrompt, setPasswordPrompt] = useState(null);
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
    const requestPassword = useCallback((fileName) => (reason) => new Promise((resolve) => {
        setPasswordPrompt({ fileName, reason, resolve });
    }), []);
    const handlePasswordSubmit = useCallback((password) => {
        passwordPrompt?.resolve(password);
        setPasswordPrompt(null);
    }, [passwordPrompt]);
    const handlePasswordCancel = useCallback(() => {
        passwordPrompt?.resolve(null);
        setPasswordPrompt(null);
    }, [passwordPrompt]);
    const loadFile = useCallback(async (file) => {
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
        }
        catch (loadProblem) {
            console.error("Failed to load PDF for image export", loadProblem);
            setPdf(null);
            setStatus("error");
            setLoadError(getFriendlyPdfError(loadProblem));
        }
    }, [pdf, requestPassword]);
    const handleFilesSelected = useCallback((files) => {
        void loadFile(files[0]);
    }, [loadFile]);
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
            const images = await renderAllPagesToImages(pdf, { format, scale, jpegQuality }, undefined, (done, total) => setProgress({ done, total }));
            let blob;
            let downloadName;
            if (images.length === 1 && images[0]) {
                blob = images[0].blob;
                downloadName = images[0].fileName;
            }
            else {
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
            setExportSuccess(`Exported ${images.length} page${images.length === 1 ? "" : "s"} as ${format.toUpperCase()} — ${formatBytes(blob.size)}`);
        }
        catch (exportProblem) {
            console.error("Failed to export images", exportProblem);
            setExportError(exportProblem instanceof Error ? exportProblem.message : "Export failed.");
        }
        finally {
            setExporting(false);
        }
    }, [pdf, format, scale, jpegQuality]);
    const canExport = Boolean(pdf) && !isExporting && status === "ready";
    const progressPercent = useMemo(() => {
        if (progress.total === 0)
            return 0;
        return Math.round((progress.done / progress.total) * 100);
    }, [progress]);
    return (_jsxs("div", { className: "mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-10", children: [_jsx("div", { ...dropZoneProps, className: clsx("rounded-[32px] border-2 border-dashed p-10 transition-colors", isDragActive
                    ? "border-amber-400 bg-amber-50/80 dark:border-amber-300 dark:bg-amber-500/10"
                    : "border-slate-300/70 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950"), children: _jsxs("div", { className: "mx-auto flex max-w-3xl flex-col gap-4 text-center", children: [_jsx("p", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: pdf ? "Ready to export images" : "Export PDF pages as images" }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-300", children: pdf
                                ? "Choose format, scale, and export. Single pages download directly; multiple pages bundle as a ZIP."
                                : "Drop a PDF or select one to convert pages into PNG or JPEG images." }), _jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx("label", { htmlFor: "pdf-to-images-upload", className: "inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:bg-white dark:text-slate-900", children: pdf ? "Replace PDF" : "Choose a PDF" }), _jsx("input", { id: "pdf-to-images-upload", ...inputProps }), _jsx("span", { className: "text-xs uppercase tracking-[0.4em] text-slate-400", children: "or drag files anywhere in this panel" })] })] }) }), status === "loading" ? (_jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-50", children: "Loading PDF details..." })) : null, loadError ? (_jsx("div", { className: "rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100", children: _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("p", { children: loadError }), _jsx("button", { className: "text-xs font-semibold uppercase", onClick: () => setLoadError(null), children: "Dismiss" })] }) })) : null, exportError ? (_jsx("div", { className: "rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100", children: _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("p", { children: exportError }), _jsx("button", { className: "text-xs font-semibold uppercase", onClick: () => setExportError(null), children: "Dismiss" })] }) })) : null, exportSuccess ? (_jsx("div", { className: "rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50", children: _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("p", { children: exportSuccess }), _jsx("button", { className: "text-xs font-semibold uppercase", onClick: () => setExportSuccess(null), children: "Hide" })] }) })) : null, pdf ? (_jsxs("div", { className: "grid gap-6 lg:grid-cols-[1.75fr,1fr]", children: [_jsxs("section", { className: "space-y-6 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400", children: "Export settings" }), _jsx("p", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: "Configure image output" })] }), _jsx("button", { type: "button", className: "text-xs font-semibold uppercase tracking-widest text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300", onClick: resetWorkspace, children: "Reset workspace" })] }), _jsxs("div", { children: [_jsx("p", { className: "mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400", children: "Format" }), _jsx("div", { className: "flex gap-3", children: FORMAT_OPTIONS.map((opt) => (_jsx("button", { type: "button", className: clsx("rounded-2xl border px-5 py-2.5 text-sm font-semibold transition", format === opt.id
                                                ? "border-amber-500 bg-amber-500/10 text-amber-900 shadow-halo dark:text-amber-100"
                                                : "border-slate-200/70 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300"), onClick: () => setFormat(opt.id), "aria-pressed": format === opt.id, children: opt.label }, opt.id))) })] }), _jsxs("div", { children: [_jsx("p", { className: "mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400", children: "Scale" }), _jsx("div", { className: "grid gap-3 md:grid-cols-3", children: SCALE_OPTIONS.map((opt) => (_jsxs("button", { type: "button", className: clsx("rounded-2xl border px-4 py-3 text-left transition", scale === opt.id
                                                ? "border-amber-500 bg-amber-500/10 text-amber-900 shadow-halo dark:text-amber-100"
                                                : "border-slate-200/70 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300"), onClick: () => setScale(opt.id), "aria-pressed": scale === opt.id, children: [_jsx("p", { className: "text-sm font-semibold", children: opt.label }), _jsx("p", { className: "mt-1 text-xs text-slate-500 dark:text-slate-400", children: opt.description })] }, opt.id))) })] }), format === "jpeg" ? (_jsxs("div", { children: [_jsxs("p", { className: "mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400", children: ["JPEG quality \u2014 ", Math.round(jpegQuality * 100), "%"] }), _jsx("input", { type: "range", min: 0.1, max: 1, step: 0.01, value: jpegQuality, onChange: (e) => setJpegQuality(Number(e.target.value)), className: "w-full accent-amber-500", "aria-label": "JPEG quality" }), _jsxs("div", { className: "mt-1 flex justify-between text-xs text-slate-400", children: [_jsx("span", { children: "Smallest" }), _jsx("span", { children: "Highest" })] })] })) : null, isExporting ? (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-xs text-slate-500", children: [_jsxs("span", { children: ["Rendering page ", progress.done, " of ", progress.total, "..."] }), _jsxs("span", { children: [progressPercent, "%"] })] }), _jsx("div", { className: "h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700", children: _jsx("div", { className: "h-full rounded-full bg-amber-500 transition-all", style: { width: `${progressPercent}%` } }) })] })) : null, _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-900/60", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-sm font-semibold text-slate-800 dark:text-white", children: ["Export as ", format.toUpperCase()] }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: pdf.pageCount === 1
                                                    ? "Downloads the page directly."
                                                    : `Bundles ${pdf.pageCount} pages into a ZIP archive.` })] }), _jsx("button", { type: "button", className: "rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-40 dark:bg-white dark:text-slate-900", onClick: handleExport, disabled: !canExport, children: isExporting ? "Exporting..." : "Export Images" })] })] }), _jsxs("aside", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-3xl border border-slate-200/70 bg-white/90 p-5 text-sm text-slate-600 shadow-xl shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.4em] text-slate-400", children: "PDF details" }), _jsx("p", { className: "mt-2 text-base font-semibold text-slate-900 dark:text-white", children: pdf.name }), _jsxs("ul", { className: "mt-3 space-y-1", children: [_jsxs("li", { children: ["Size: ", formatBytes(pdf.size)] }), _jsxs("li", { children: ["Pages: ", pdf.pageCount] }), _jsxs("li", { children: ["PDF version: ", pdf.pdfVersion] }), _jsxs("li", { children: ["Title: ", pdf.metadata.title ?? "—"] }), _jsxs("li", { children: ["Author: ", pdf.metadata.author ?? "—"] }), _jsxs("li", { children: ["Created: ", formatTimestamp(pdf.metadata.creationDate ?? pdf.lastModified)] }), _jsxs("li", { children: ["Modified: ", formatTimestamp(pdf.metadata.modificationDate)] })] })] }), _jsxs("div", { className: "rounded-3xl border border-slate-200/70 bg-white/90 p-5 text-sm text-slate-600 shadow-xl shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.4em] text-slate-400", children: "How it works" }), _jsxs("ul", { className: "mt-3 list-disc space-y-2 pl-4", children: [_jsx("li", { children: "Each page is rendered to an off-screen canvas at the chosen scale." }), _jsx("li", { children: "The canvas is exported as PNG (lossless) or JPEG (lossy, adjustable quality)." }), _jsx("li", { children: "Multiple pages are bundled into a ZIP; single pages download directly." }), _jsx("li", { children: "All processing happens in your browser \u2014 files never leave your device." })] })] })] })] })) : (_jsx("div", { className: "rounded-3xl border border-slate-200/70 bg-white/80 p-6 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300", children: "Load a PDF to choose format, scale, and export pages as images." })), _jsx(PasswordPromptModal, { open: Boolean(passwordPrompt), fileName: passwordPrompt?.fileName ?? "", reason: passwordPrompt?.reason ?? "password-required", onSubmit: handlePasswordSubmit, onCancel: handlePasswordCancel })] }));
};
export default PdfToImagesPage;
