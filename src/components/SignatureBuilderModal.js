import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, } from "react";
import clsx from "clsx";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { SIGNATURE_DISCLAIMER_COPY } from "../lib/signaturePlacement";
import { useSignatureLibrary } from "../state/signatureLibrary";
const DRAW_WIDTH = 720;
const DRAW_HEIGHT = 260;
const COLOR_OPTIONS = ["#0f172a", "#1d4ed8", "#047857", "#7c2d12"];
const TABS = [
    { id: "draw", label: "Draw" },
    { id: "type", label: "Type" },
    { id: "upload", label: "Upload" },
];
const TYPEFACE_OPTIONS = [
    {
        id: "script",
        label: "Signature Script",
        previewFont: '"Great Vibes", "Segoe Script", "Brush Script MT", cursive',
    },
    {
        id: "casual",
        label: "Casual Print",
        previewFont: '"Patrick Hand", "Comic Sans MS", "Segoe Print", cursive',
    },
    {
        id: "serif",
        label: "Elegant Serif",
        previewFont: '"Playfair Display", "Times New Roman", serif',
    },
];
const DEFAULT_TYPEFACE = TYPEFACE_OPTIONS[0];
const getTypefaceById = (id) => TYPEFACE_OPTIONS.find((entry) => entry.id === id) ?? DEFAULT_TYPEFACE;
const SignatureBuilderModal = ({ open, onClose, onCreated }) => {
    const addSignature = useSignatureLibrary((state) => state.addSignature);
    const dialogRef = useRef(null);
    useFocusTrap(dialogRef, open);
    const [mode, setMode] = useState("draw");
    const [label, setLabel] = useState("Signature");
    const [drawColor, setDrawColor] = useState(COLOR_OPTIONS[0]);
    const [typedColor, setTypedColor] = useState(COLOR_OPTIONS[0]);
    const [typedFont, setTypedFont] = useState(DEFAULT_TYPEFACE.id);
    const [typedValue, setTypedValue] = useState("");
    const [typedPreview, setTypedPreview] = useState(null);
    const [uploadPreview, setUploadPreview] = useState(null);
    const [uploadError, setUploadError] = useState(null);
    const drawTracker = useRef({
        isDrawing: false,
        lastPoint: null,
    });
    const [hasDrawn, setHasDrawn] = useState(false);
    const canvasRef = useRef(null);
    const ratioRef = useRef(1);
    const typedTypeface = useMemo(() => getTypefaceById(typedFont), [typedFont]);
    const closeModal = useCallback(() => {
        onClose();
    }, [onClose]);
    useEffect(() => {
        if (!open || typeof window === "undefined") {
            return;
        }
        const handleKey = (event) => {
            if (event.key === "Escape") {
                closeModal();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [closeModal, open]);
    useEffect(() => {
        if (!open || typeof window === "undefined") {
            return;
        }
        ratioRef.current = window.devicePixelRatio || 1;
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        canvas.width = DRAW_WIDTH * ratioRef.current;
        canvas.height = DRAW_HEIGHT * ratioRef.current;
        canvas.style.width = `${DRAW_WIDTH}px`;
        canvas.style.height = `${DRAW_HEIGHT}px`;
        const context = canvas.getContext("2d");
        if (context) {
            context.lineCap = "round";
            context.lineJoin = "round";
            context.lineWidth = 2.8 * ratioRef.current;
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
        drawTracker.current = { isDrawing: false, lastPoint: null };
        setHasDrawn(false);
    }, [open]);
    useEffect(() => {
        if (!open) {
            setMode("draw");
            setLabel("Signature");
            setTypedValue("");
            setUploadPreview(null);
            setUploadError(null);
            setTypedPreview(null);
            drawTracker.current = { isDrawing: false, lastPoint: null };
            setHasDrawn(false);
        }
    }, [open]);
    useEffect(() => {
        if (!open) {
            return;
        }
        const text = typedValue.trim();
        if (!text || typeof document === "undefined") {
            setTypedPreview(null);
            return;
        }
        const option = typedTypeface;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
            setTypedPreview(null);
            return;
        }
        const fontSize = 92;
        const paddingX = 56;
        const paddingY = 42;
        context.font = `${fontSize}px ${option.previewFont}`;
        const metrics = context.measureText(text);
        const width = Math.min(1000, Math.max(280, Math.ceil(metrics.width + paddingX * 2)));
        const height = fontSize + paddingY * 2;
        const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        const drawContext = canvas.getContext("2d");
        if (!drawContext) {
            setTypedPreview(null);
            return;
        }
        drawContext.scale(ratio, ratio);
        drawContext.clearRect(0, 0, width, height);
        drawContext.font = `${fontSize}px ${option.previewFont}`;
        drawContext.fillStyle = typedColor;
        drawContext.textBaseline = "middle";
        drawContext.textAlign = "center";
        drawContext.fillText(text, width / 2, height / 2);
        setTypedPreview({ dataUrl: canvas.toDataURL("image/png"), width, height });
    }, [open, typedTypeface, typedValue, typedColor]);
    const pointerToCanvasPoint = (event) => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return null;
        }
        const rect = canvas.getBoundingClientRect();
        const scaleX = DRAW_WIDTH / rect.width;
        const scaleY = DRAW_HEIGHT / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        };
    };
    const beginDraw = (event) => {
        event.preventDefault();
        const point = pointerToCanvasPoint(event);
        if (!point) {
            return;
        }
        drawTracker.current = { isDrawing: true, lastPoint: point };
        event.target?.setPointerCapture(event.pointerId);
    };
    const continueDraw = (event) => {
        if (!drawTracker.current.isDrawing) {
            return;
        }
        event.preventDefault();
        const point = pointerToCanvasPoint(event);
        const canvas = canvasRef.current;
        if (!point || !canvas) {
            return;
        }
        const context = canvas.getContext("2d");
        const last = drawTracker.current.lastPoint;
        if (!context || !last) {
            return;
        }
        const ratio = ratioRef.current;
        context.strokeStyle = drawColor;
        context.beginPath();
        context.moveTo(last.x * ratio, last.y * ratio);
        context.lineTo(point.x * ratio, point.y * ratio);
        context.stroke();
        drawTracker.current = { isDrawing: true, lastPoint: point };
        setHasDrawn(true);
    };
    const endDraw = (event) => {
        if (!drawTracker.current.isDrawing) {
            return;
        }
        drawTracker.current = { isDrawing: false, lastPoint: null };
        event.target?.releasePointerCapture(event.pointerId);
    };
    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const context = canvas.getContext("2d");
        if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
        drawTracker.current = { isDrawing: false, lastPoint: null };
        setHasDrawn(false);
    };
    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            setUploadError("Please select a PNG signature image.");
            setUploadPreview(null);
            return;
        }
        try {
            setUploadError(null);
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
                reader.readAsDataURL(file);
            });
            if (typeof document === "undefined") {
                setUploadPreview({ dataUrl, width: 600, height: 200 });
                return;
            }
            const image = document.createElement("img");
            image.src = dataUrl;
            await new Promise((resolve, reject) => {
                image.onload = () => resolve();
                image.onerror = () => reject(new Error("Failed to load image"));
            });
            const maxDim = 900;
            const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
            const width = Math.max(120, Math.round(image.width * scale));
            const height = Math.max(60, Math.round(image.height * scale));
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");
            if (context) {
                context.clearRect(0, 0, width, height);
                context.drawImage(image, 0, 0, width, height);
            }
            setUploadPreview({ dataUrl: canvas.toDataURL("image/png"), width, height });
        }
        catch (error) {
            console.error(error);
            setUploadError("Could not process that image. Please try another PNG file.");
            setUploadPreview(null);
        }
    };
    const canSave = useMemo(() => {
        if (mode === "draw") {
            return hasDrawn;
        }
        if (mode === "type") {
            return Boolean(typedPreview);
        }
        if (mode === "upload") {
            return Boolean(uploadPreview);
        }
        return false;
    }, [hasDrawn, mode, typedPreview, uploadPreview]);
    const drawnPreviewSrc = hasDrawn && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null;
    const handleSave = () => {
        if (!canSave) {
            return;
        }
        if (mode === "draw") {
            const canvas = canvasRef.current;
            if (!canvas || !hasDrawn) {
                return;
            }
            const entry = addSignature({
                label,
                kind: "drawn",
                dataUrl: canvas.toDataURL("image/png"),
                width: DRAW_WIDTH,
                height: DRAW_HEIGHT,
            });
            onCreated?.(entry);
            onClose();
            return;
        }
        if (mode === "type" && typedPreview) {
            const entry = addSignature({
                label,
                kind: "typed",
                dataUrl: typedPreview.dataUrl,
                width: typedPreview.width,
                height: typedPreview.height,
            });
            onCreated?.(entry);
            onClose();
            return;
        }
        if (mode === "upload" && uploadPreview) {
            const entry = addSignature({
                label,
                kind: "upload",
                dataUrl: uploadPreview.dataUrl,
                width: uploadPreview.width,
                height: uploadPreview.height,
            });
            onCreated?.(entry);
            onClose();
        }
    };
    if (!open) {
        return null;
    }
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center px-4 py-8", children: [_jsx("div", { className: "absolute inset-0 bg-slate-900/70", "aria-hidden": "true", onClick: closeModal }), _jsx("div", { ref: dialogRef, role: "dialog", "aria-modal": "true", "aria-labelledby": "signature-modal-title", "aria-describedby": "signature-modal-desc", className: "relative z-10 w-full max-w-4xl rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950/95", children: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.3em] text-slate-400", children: "Signatures" }), _jsx("h2", { id: "signature-modal-title", className: "text-2xl font-semibold text-slate-900 dark:text-white", children: "Create a signature stamp" }), _jsx("p", { id: "signature-modal-desc", className: "text-sm text-slate-500 dark:text-slate-400", children: SIGNATURE_DISCLAIMER_COPY })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: TABS.map((tab) => (_jsx("button", { type: "button", className: clsx("rounded-full px-4 py-2 text-sm font-semibold", mode === tab.id
                                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                    : "border border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-200"), onClick: () => setMode(tab.id), children: tab.label }, tab.id))) }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("label", { className: "text-xs font-semibold uppercase tracking-[0.3em] text-slate-400", children: ["Label", _jsx("input", { type: "text", value: label, onChange: (event) => setLabel(event.target.value), className: "mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-white/10 dark:bg-slate-900 dark:text-white", placeholder: "Signature label" })] }), mode === "draw" ? (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-sm text-slate-500", children: [_jsx("span", { children: "Ink color:" }), _jsx("div", { className: "flex gap-2", children: COLOR_OPTIONS.map((color) => (_jsx("button", { type: "button", className: clsx("h-8 w-8 rounded-full border-2", drawColor === color
                                                                    ? "border-slate-900"
                                                                    : "border-transparent opacity-70"), style: { backgroundColor: color }, onClick: () => setDrawColor(color), "aria-label": `Use ${color} ink` }, color))) }), _jsx("button", { type: "button", className: "ml-auto text-xs font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-600", onClick: resetCanvas, children: "Clear" })] }), _jsx("div", { className: "overflow-hidden rounded-2xl border border-dashed border-slate-300/80 bg-white shadow-inner dark:border-white/10 dark:bg-slate-900", children: _jsx("canvas", { ref: canvasRef, className: "block cursor-crosshair", onPointerDown: beginDraw, onPointerMove: continueDraw, onPointerUp: endDraw, onPointerLeave: endDraw }) })] })) : null, mode === "type" ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("label", { className: "text-xs font-semibold uppercase tracking-[0.3em] text-slate-400", children: ["Typed name", _jsx("input", { type: "text", value: typedValue, onChange: (event) => setTypedValue(event.target.value), className: "mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-white/10 dark:bg-slate-900 dark:text-white", placeholder: "Your name" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.3em] text-slate-400", children: "Style" }), _jsx("div", { className: "mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3", children: TYPEFACE_OPTIONS.map((option) => (_jsx("button", { type: "button", className: clsx("rounded-2xl border px-4 py-3 text-sm", typedFont === option.id
                                                                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                                                                    : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-100"), style: { fontFamily: option.previewFont }, onClick: () => setTypedFont(option.id), children: option.label }, option.id))) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-sm text-slate-500", children: [_jsx("span", { children: "Ink color:" }), _jsx("div", { className: "flex gap-2", children: COLOR_OPTIONS.map((color) => (_jsx("button", { type: "button", className: clsx("h-8 w-8 rounded-full border-2", typedColor === color
                                                                    ? "border-slate-900"
                                                                    : "border-transparent opacity-70"), style: { backgroundColor: color }, onClick: () => setTypedColor(color), "aria-label": `Use ${color} ink` }, color))) })] }), _jsx("div", { className: "rounded-2xl border border-dashed border-slate-300/70 bg-white/70 px-6 py-6 text-center text-3xl text-slate-800 shadow-inner dark:border-white/10 dark:bg-slate-900 dark:text-white", children: _jsx("span", { style: { fontFamily: typedTypeface.previewFont, color: typedColor }, children: typedValue || "Your Name" }) })] })) : null, mode === "upload" ? (_jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/70 bg-white/70 px-6 py-10 text-center text-sm text-slate-500 shadow-inner dark:border-white/10 dark:bg-slate-900", children: [_jsx("input", { type: "file", accept: "image/png,image/svg+xml,image/webp", className: "sr-only", onChange: handleFileChange }), _jsx("span", { className: "font-semibold text-slate-700 dark:text-slate-200", children: "Click to choose a PNG signature" }), _jsx("span", { className: "text-xs text-slate-400", children: "Transparent backgrounds preserve best results." })] }), uploadError ? _jsx("p", { className: "text-sm text-rose-500", children: uploadError }) : null, uploadPreview ? (_jsx("div", { className: "rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-inner dark:border-white/10 dark:bg-slate-900", children: _jsx("img", { src: uploadPreview.dataUrl, alt: "Uploaded signature preview", className: "mx-auto max-h-40 object-contain" }) })) : null] })) : null] }), _jsxs("div", { className: "space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/70", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.3em] text-slate-400", children: "Preview" }), mode === "draw" ? (_jsx("div", { className: "rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/80 p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-950/40", children: drawnPreviewSrc ? (_jsx("img", { src: drawnPreviewSrc, alt: "Drawn signature preview", className: "mx-auto max-h-40 object-contain" })) : (_jsx("p", { children: "Use the drawing pad to sketch a signature." })) })) : null, mode === "type" ? (_jsx("div", { className: "rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/80 p-6 text-center text-3xl text-slate-900 dark:border-white/10 dark:bg-slate-950/40 dark:text-white", style: { fontFamily: typedTypeface.previewFont, color: typedColor }, children: typedValue || "Your Name" })) : null, mode === "upload" ? (_jsx("div", { className: "rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/80 p-6 text-center dark:border-white/10 dark:bg-slate-950/40", children: uploadPreview ? (_jsx("img", { src: uploadPreview.dataUrl, alt: "Uploaded signature preview", className: "mx-auto max-h-48 object-contain" })) : (_jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400", children: "Upload a transparent PNG to preview it here." })) })) : null, _jsx("div", { className: "rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300", children: _jsx("p", { children: "Tips: keep signatures under 900px wide, use transparent backgrounds, and avoid colors that blend into your document." }) })] })] }), _jsxs("div", { className: "flex justify-end gap-3", children: [_jsx("button", { type: "button", className: "rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700 dark:text-slate-300", onClick: closeModal, children: "Cancel" }), _jsx("button", { type: "button", className: "rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition disabled:opacity-40 dark:bg-white dark:text-slate-900", disabled: !canSave, onClick: handleSave, children: "Save signature" })] })] }) })] }));
};
export default SignatureBuilderModal;
