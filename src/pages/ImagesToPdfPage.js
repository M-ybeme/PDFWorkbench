import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { PDFDocument } from "pdf-lib";
import { triggerBlobDownload } from "../lib/downloads";
import { buildImagesPdfFileName } from "../lib/fileNames";
import { computeImagePlacement } from "../lib/imageLayout";
import { hasPngSignature, isPngBytesComplete } from "../lib/pngIntegrity";
import { logExportResult } from "../state/activityLog";
const PAGE_PRESETS = [
    { id: "letter", label: "Letter · 8.5 × 11 in", width: 612, height: 792 },
    { id: "a4", label: "A4 · 210 × 297 mm", width: 595, height: 842 },
    { id: "square", label: "Square · 8 × 8 in", width: 576, height: 576 },
];
const FIT_OPTIONS = [
    { id: "fit", label: "Fit", description: "Scale images to fit within the page margins" },
    { id: "fill", label: "Fill", description: "Cover the page, cropping edges if needed" },
    { id: "center", label: "Center", description: "Keep original size and center on the page" },
];
const DEFAULT_MARGIN = 36;
const MAX_IMAGES = 24;
const cloneBytesToArrayBuffer = (bytes) => {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
};
const createId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
const isImageFile = (file) => file.type.startsWith("image/");
const loadDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
});
const loadImageElement = (dataUrl) => new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = dataUrl;
});
const canvasToBlob = (canvas, mimeType) => new Promise((resolve, reject) => {
    const quality = mimeType === "image/jpeg" ? 0.92 : undefined;
    if (canvas.toBlob) {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            }
            else {
                reject(new Error("Failed to encode image."));
            }
        }, mimeType, quality);
        return;
    }
    try {
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64 = dataUrl.split(",")[1];
        if (!base64) {
            reject(new Error("Failed to encode image."));
            return;
        }
        const binary = atob(base64);
        const buffer = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            buffer[index] = binary.charCodeAt(index);
        }
        resolve(new Blob([buffer], { type: mimeType }));
    }
    catch (encodingError) {
        reject(encodingError instanceof Error ? encodingError : new Error("Failed to encode image."));
    }
});
const blobToUint8Array = async (blob) => {
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
};
const reencodeImageElement = async (image, mimeType) => {
    const canvas = document.createElement("canvas");
    const width = image.naturalWidth || image.width || 1;
    const height = image.naturalHeight || image.height || 1;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas rendering context unavailable.");
    }
    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, mimeType);
    return blobToUint8Array(blob);
};
const ensureEmbeddableImageBytes = async (fileType, bytes, image) => {
    const normalizedType = fileType?.toLowerCase() ?? "";
    const treatAsPng = normalizedType === "image/png" || (!normalizedType && hasPngSignature(bytes));
    if (treatAsPng) {
        if (isPngBytesComplete(bytes)) {
            return { bytes, embedType: "image/png" };
        }
        try {
            const repaired = await reencodeImageElement(image, "image/png");
            if (isPngBytesComplete(repaired)) {
                return { bytes: repaired, embedType: "image/png" };
            }
        }
        catch (repairError) {
            console.warn("Failed to repair PNG before embedding", repairError);
        }
        const jpegFallback = await reencodeImageElement(image, "image/jpeg");
        return { bytes: jpegFallback, embedType: "image/jpeg" };
    }
    const isJpeg = normalizedType === "image/jpeg" ||
        normalizedType === "image/jpg" ||
        normalizedType === "image/pjpeg";
    if (isJpeg) {
        return { bytes, embedType: "image/jpeg" };
    }
    if (normalizedType.startsWith("image/") || normalizedType === "") {
        const jpegBytes = await reencodeImageElement(image, "image/jpeg");
        return { bytes: jpegBytes, embedType: "image/jpeg" };
    }
    throw new Error("Unsupported image type.");
};
const buildAsset = async (file) => {
    const [buffer, dataUrl] = await Promise.all([file.arrayBuffer(), loadDataUrl(file)]);
    const sourceBytes = new Uint8Array(buffer);
    const imageElement = await loadImageElement(dataUrl);
    const { bytes: preparedBytes, embedType } = await ensureEmbeddableImageBytes(file.type, sourceBytes, imageElement);
    const bytes = new Uint8Array(preparedBytes.byteLength);
    bytes.set(preparedBytes);
    const width = imageElement.naturalWidth || imageElement.width;
    const height = imageElement.naturalHeight || imageElement.height;
    return {
        id: createId(),
        name: file.name,
        size: file.size,
        type: file.type,
        embedType,
        dataUrl,
        width,
        height,
        bytes,
    };
};
const getPresetById = (id) => PAGE_PRESETS.find((preset) => preset.id === id) ?? PAGE_PRESETS[0];
const ImagesToPdfPage = () => {
    const [images, setImages] = useState([]);
    const [isDragging, setDragging] = useState(false);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);
    const [presetId, setPresetId] = useState(PAGE_PRESETS[0].id);
    const [orientation, setOrientation] = useState("portrait");
    const [fitMode, setFitMode] = useState("fit");
    const [isGenerating, setGenerating] = useState(false);
    const fileInputRef = useRef(null);
    const preset = getPresetById(presetId);
    const orientedDimensions = useMemo(() => {
        if (orientation === "portrait") {
            return { width: preset.width, height: preset.height };
        }
        return { width: preset.height, height: preset.width };
    }, [orientation, preset.height, preset.width]);
    const handleFiles = useCallback(async (files) => {
        if (!files || files.length === 0) {
            return;
        }
        setError(null);
        const accepted = [];
        for (const file of Array.from(files)) {
            if (!isImageFile(file)) {
                setError("Only image files are supported.");
                continue;
            }
            if (images.length + accepted.length >= MAX_IMAGES) {
                setError(`Limit ${MAX_IMAGES} images per export.`);
                break;
            }
            try {
                const asset = await buildAsset(file);
                accepted.push(asset);
            }
            catch (assetError) {
                console.error(assetError);
                setError("Failed to load one of the images.");
            }
        }
        if (accepted.length > 0) {
            setImages((current) => [...current, ...accepted]);
            setStatus(`${accepted.length} image${accepted.length === 1 ? "" : "s"} ready.`);
        }
    }, [images.length]);
    const handleInputChange = useCallback((event) => {
        void handleFiles(event.target.files);
        event.target.value = "";
    }, [handleFiles]);
    const handleDrop = useCallback((event) => {
        event.preventDefault();
        setDragging(false);
        void handleFiles(event.dataTransfer?.files ?? null);
    }, [handleFiles]);
    const handleDragOver = useCallback((event) => {
        if (event.dataTransfer?.types.includes("Files")) {
            event.preventDefault();
            setDragging(true);
        }
    }, []);
    const handleDragLeave = useCallback((event) => {
        if (event.dataTransfer?.types.includes("Files")) {
            event.preventDefault();
            setDragging(false);
        }
    }, []);
    const removeImage = useCallback((id) => {
        setImages((current) => current.filter((image) => image.id !== id));
    }, []);
    const moveImage = useCallback((id, direction) => {
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
            const doc = await PDFDocument.create();
            for (const asset of images) {
                const page = doc.addPage([orientedDimensions.width, orientedDimensions.height]);
                const embedded = asset.embedType === "image/png"
                    ? await doc.embedPng(asset.bytes)
                    : await doc.embedJpg(asset.bytes);
                const placement = computeImagePlacement(asset.width, asset.height, { ...orientedDimensions, margin: DEFAULT_MARGIN }, fitMode);
                page.drawImage(embedded, {
                    x: placement.x,
                    y: placement.y,
                    width: placement.width,
                    height: placement.height,
                });
            }
            const bytes = await doc.save();
            const blob = new Blob([cloneBytesToArrayBuffer(bytes)], { type: "application/pdf" });
            const fileName = buildImagesPdfFileName(images[0]?.name ?? null, images.length);
            const result = {
                blob,
                size: blob.size,
                downloadName: fileName,
                durationMs: Math.max(0, Date.now() - startedAt),
                warnings: undefined,
                activity: {
                    tool: "images",
                    operation: `images-to-pdf-${images.length}-pages`,
                    sourceCount: images.length,
                    detail: `${preset.label} · ${fitMode.toUpperCase()}`,
                },
            };
            triggerBlobDownload(result.blob, result.downloadName);
            logExportResult(result);
            setStatus(`Created PDF with ${images.length} image${images.length === 1 ? "" : "s"}.`);
        }
        catch (exportError) {
            console.error("handleExport error", exportError);
            setError(exportError instanceof Error ? exportError.message : "Failed to export PDF.");
        }
        finally {
            setGenerating(false);
        }
    }, [images, isGenerating, orientedDimensions, fitMode, preset.label]);
    const emptyState = images.length === 0;
    return (_jsxs("div", { className: "mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:flex-row lg:px-10", children: [_jsxs("div", { className: "flex-1 space-y-6", children: [_jsxs("div", { className: clsx("rounded-3xl border-2 border-dashed p-10 text-center transition", isDragging
                            ? "border-emerald-400 bg-emerald-50/70 dark:border-emerald-300 dark:bg-emerald-500/10"
                            : "border-slate-300/70 bg-white/80 dark:border-white/10 dark:bg-slate-900/60"), onDrop: handleDrop, onDragOver: handleDragOver, onDragLeave: handleDragLeave, children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400", children: "0.5.x \u00B7 Images \u2192 PDF" }), _jsx("h1", { className: "mt-4 font-display text-4xl text-slate-900 dark:text-white", children: "Drag in images, tune layout, download a polished PDF." }), _jsxs("p", { className: "mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300", children: ["Add up to ", MAX_IMAGES, " images. Reorder them, choose the right page preset, and export a perfectly sized PDF without leaving the browser."] }), _jsxs("div", { className: "mt-8 flex flex-wrap items-center justify-center gap-4", children: [_jsx("button", { type: "button", className: "inline-flex items-center gap-3 rounded-full bg-slate-900 px-6 py-3 text-white shadow-lg shadow-slate-900/30 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 dark:bg-white dark:text-slate-900", onClick: () => fileInputRef.current?.click(), children: "Select images \u2197" }), _jsx("button", { type: "button", className: "text-sm text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300", onClick: clearAll, disabled: emptyState, children: "Clear list" }), _jsx("input", { ref: fileInputRef, id: "images-upload", type: "file", accept: "image/*", multiple: true, className: "sr-only", onChange: handleInputChange })] }), status ? (_jsx("p", { className: "mt-4 text-sm text-emerald-600 dark:text-emerald-300", children: status })) : null, error ? _jsx("p", { className: "mt-4 text-sm text-rose-600 dark:text-rose-300", children: error }) : null] }), _jsxs("div", { className: "rounded-3xl border border-slate-200/70 bg-white/80 p-6 dark:border-white/10 dark:bg-slate-900/60", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400", children: "Image queue" }), _jsxs("p", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: [images.length, " added \u00B7 ", totalSizeMb, " MB"] })] }), _jsx("button", { type: "button", className: "rounded-full border border-slate-300/70 px-4 py-2 text-sm text-slate-600 transition hover:border-slate-600 hover:text-slate-900 dark:border-white/10 dark:text-slate-300", onClick: () => fileInputRef.current?.click(), children: "Add more" })] }), emptyState ? (_jsx("p", { className: "mt-6 text-sm text-slate-500 dark:text-slate-400", children: "Need inspiration? Drop PNG, JPG, or WEBP files here. We'll keep them local and render lightweight previews before exporting." })) : (_jsx("ul", { className: "mt-6 space-y-4", "data-image-list": "true", children: images.map((image, index) => (_jsxs("li", { className: "flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-900/40 sm:flex-row", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("img", { src: image.dataUrl, alt: image.name, className: "h-20 w-20 rounded-xl object-cover", loading: "lazy" }), _jsxs("div", { children: [_jsxs("p", { className: "font-semibold text-slate-900 dark:text-white", children: ["Page ", index + 1, ": ", image.name] }), _jsxs("p", { className: "text-sm text-slate-500 dark:text-slate-400", children: [Math.round(image.width), " \u00D7 ", Math.round(image.height), " px \u00B7", " ", (image.size / 1024).toFixed(1), " KB"] })] })] }), _jsxs("div", { className: "flex flex-1 flex-wrap items-center justify-end gap-2", children: [_jsx("button", { type: "button", className: "rounded-full border border-slate-300/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-900 hover:text-slate-900 disabled:opacity-30 dark:border-white/10 dark:text-slate-300", onClick: () => moveImage(image.id, -1), disabled: index === 0, "data-move-up": "true", children: "Move up" }), _jsx("button", { type: "button", className: "rounded-full border border-slate-300/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-900 hover:text-slate-900 disabled:opacity-30 dark:border-white/10 dark:text-slate-300", onClick: () => moveImage(image.id, 1), disabled: index === images.length - 1, "data-move-down": "true", children: "Move down" }), _jsx("button", { type: "button", className: "rounded-full border border-rose-200/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:border-rose-500 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-300", onClick: () => removeImage(image.id), children: "Remove" })] })] }, image.id))) }))] })] }), _jsxs("aside", { className: "w-full rounded-3xl border border-slate-200/70 bg-white/80 p-6 dark:border-white/10 dark:bg-slate-900/60 lg:w-80", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400", children: "Layout presets" }), _jsx("div", { className: "mt-4 space-y-3", children: PAGE_PRESETS.map((option) => {
                            const inputId = `page-preset-${option.id}`;
                            return (_jsxs("label", { className: clsx("flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3", presetId === option.id
                                    ? "border-slate-900 bg-slate-900/5 text-slate-900 dark:border-white dark:bg-white/10 dark:text-white"
                                    : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300"), htmlFor: inputId, "aria-label": option.label, children: [_jsx("input", { type: "radio", name: "page-preset", className: "mt-1", checked: presetId === option.id, onChange: () => setPresetId(option.id), id: inputId }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold", children: option.label }), _jsxs("p", { className: "text-xs uppercase tracking-[0.3em] text-slate-400", children: [option.width, " \u00D7 ", option.height, " pt"] })] })] }, option.id));
                        }) }), _jsxs("div", { className: "mt-6 space-y-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400", children: "Orientation" }), _jsx("div", { className: "mt-3 flex gap-3", children: ["portrait", "landscape"].map((option) => (_jsx("button", { type: "button", className: clsx("flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold capitalize", orientation === option
                                                ? "border-slate-900 bg-slate-900/5 text-slate-900 dark:border-white dark:bg-white/10 dark:text-white"
                                                : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300"), onClick: () => setOrientation(option), children: option }, option))) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400", children: "Fit mode" }), _jsx("div", { className: "mt-3 space-y-2", children: FIT_OPTIONS.map((option) => {
                                            const inputId = `fit-mode-${option.id}`;
                                            return (_jsxs("label", { className: clsx("flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3", fitMode === option.id
                                                    ? "border-emerald-500 bg-emerald-500/5 text-emerald-900 dark:border-emerald-300/70 dark:text-emerald-100"
                                                    : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300"), htmlFor: inputId, "aria-label": option.label, children: [_jsx("input", { type: "radio", name: "fit-mode", className: "mt-1", checked: fitMode === option.id, onChange: () => setFitMode(option.id), id: inputId }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold", children: option.label }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400", children: option.description })] })] }, option.id));
                                        }) })] })] }), _jsxs("div", { className: "mt-8 space-y-3 text-sm text-slate-500 dark:text-slate-300", children: [_jsxs("p", { children: ["Each image becomes its own page. We'll apply a ", DEFAULT_MARGIN / 72, "\" margin."] }), _jsx("p", { children: "Everything stays on-device\u2014no uploads or external servers." })] }), _jsx("button", { type: "button", className: "mt-6 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-emerald-600/40 transition hover:-translate-y-0.5 disabled:opacity-40", onClick: () => void handleExport(), disabled: images.length === 0 || isGenerating, children: isGenerating
                            ? "Creating PDF..."
                            : images.length === 0
                                ? "Add images"
                                : `Create ${images.length}-page PDF` })] })] }));
};
export default ImagesToPdfPage;
