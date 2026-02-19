import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, } from "react";
import clsx from "clsx";
import Alert from "../components/Alert";
import PasswordPromptModal from "../components/PasswordPromptModal";
import SignatureBuilderModal from "../components/SignatureBuilderModal";
import SignatureRibbon, { DEFAULT_TEXT_DRAFT, SYMBOL_PRESETS, } from "../components/signatures/SignatureRibbon";
import { triggerBlobDownload } from "../lib/downloads";
import { getFriendlyPdfError } from "../lib/pdfErrors";
import { configurePdfWorker } from "../lib/pdfWorker";
import { loadPdfFromFile } from "../lib/pdfLoader";
import { stampSignaturesToExportResult } from "../lib/signatureStamp";
import { SIGNATURE_DISCLAIMER_COPY, createPlacementFromPoint, createStrokeFromPoints, createTextPlacement, movePlacement, moveTextPlacement, resizePlacement, resizeTextPlacement, } from "../lib/signaturePlacement";
import { useDragDrop } from "../hooks/useDragDrop";
import { logExportResult } from "../state/activityLog";
import { useSignatureLibrary } from "../state/signatureLibrary";
import { buildFileKey, useSignatureSession } from "../state/signatureSession";
const HISTORY_LIMIT = 30;
const SAVE_DEBOUNCE_MS = 800;
const SignaturesToolPage = () => {
    const signatures = useSignatureLibrary((state) => state.signatures);
    const deleteSignature = useSignatureLibrary((state) => state.deleteSignature);
    const markUsed = useSignatureLibrary((state) => state.markUsed);
    const sessionStore = useSignatureSession();
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState(null);
    const [pdf, setPdf] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [canvasSize, setCanvasSize] = useState({
        width: 0,
        height: 0,
    });
    const [placements, setPlacements] = useState([]);
    const [textPlacements, setTextPlacements] = useState([]);
    const [selectedPlacementId, setSelectedPlacementId] = useState(null);
    const [selectedTextId, setSelectedTextId] = useState(null);
    const [activeSignatureId, setActiveSignatureId] = useState(null);
    const [activeTool, setActiveTool] = useState("signature");
    const [textDraft, setTextDraft] = useState({ ...DEFAULT_TEXT_DRAFT });
    const [textToolError, setTextToolError] = useState(null);
    const [downloadMessage, setDownloadMessage] = useState(null);
    const [downloadError, setDownloadError] = useState(null);
    const [passwordPrompt, setPasswordPrompt] = useState(null);
    const [isStamping, setStamping] = useState(false);
    const [isBuilderOpen, setBuilderOpen] = useState(false);
    const [symbolPreset, setSymbolPreset] = useState(SYMBOL_PRESETS[0]);
    const [symbolSize, setSymbolSize] = useState(20);
    const [symbolColor, setSymbolColor] = useState("#111827");
    const [strokes, setStrokes] = useState([]);
    const [penColor, setPenColor] = useState("#111827");
    const [penWidth, setPenWidth] = useState(3);
    const [activeStrokePoints, setActiveStrokePoints] = useState(null);
    const [history, setHistory] = useState([]);
    const [strokesOnTop, setStrokesOnTop] = useState(true);
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const renderTaskRef = useRef(null);
    const dragSessionRef = useRef(null);
    const isDrawingRef = useRef(false);
    const saveTimerRef = useRef(null);
    const fileKeyRef = useRef("");
    useEffect(() => {
        configurePdfWorker();
    }, []);
    useEffect(() => {
        if (signatures.length === 0) {
            setActiveSignatureId(null);
            return;
        }
        setActiveSignatureId((current) => {
            if (current && signatures.some((entry) => entry.id === current)) {
                return current;
            }
            return signatures[0].id;
        });
    }, [signatures]);
    useEffect(() => {
        let cancelled = false;
        const renderPage = async () => {
            if (!pdf || !canvasRef.current) {
                setCanvasSize({ width: 0, height: 0 });
                return;
            }
            try {
                const canvas = canvasRef.current;
                const context = canvas.getContext("2d");
                if (!context) {
                    return;
                }
                renderTaskRef.current?.cancel();
                const page = await pdf.doc.getPage(currentPage);
                if (cancelled) {
                    page.cleanup();
                    return;
                }
                const viewport = page.getViewport({ scale: zoom });
                const outputScale = window.devicePixelRatio || 1;
                const displayWidth = viewport.width;
                const displayHeight = viewport.height;
                canvas.width = displayWidth * outputScale;
                canvas.height = displayHeight * outputScale;
                canvas.style.width = `${displayWidth}px`;
                canvas.style.height = `${displayHeight}px`;
                setCanvasSize({ width: displayWidth, height: displayHeight });
                const renderContext = {
                    canvasContext: context,
                    viewport,
                    canvas,
                    transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
                };
                const task = page.render(renderContext);
                renderTaskRef.current = task;
                await task.promise;
                page.cleanup();
            }
            catch (renderError) {
                if (!cancelled) {
                    console.error(renderError);
                    setError(getFriendlyPdfError(renderError));
                }
            }
        };
        void renderPage();
        return () => {
            cancelled = true;
            renderTaskRef.current?.cancel();
            renderTaskRef.current = null;
        };
    }, [currentPage, pdf, setError, zoom]);
    const signatureMap = useMemo(() => {
        const map = new Map();
        signatures.forEach((signature) => map.set(signature.id, signature));
        return map;
    }, [signatures]);
    const placementsForCurrentPage = placements.filter((placement) => placement.pageNumber === currentPage);
    const textPlacementsForCurrentPage = textPlacements.filter((placement) => placement.pageNumber === currentPage);
    const activeSignature = activeSignatureId ? (signatureMap.get(activeSignatureId) ?? null) : null;
    const activeTextPlacement = selectedTextId
        ? (textPlacements.find((placement) => placement.id === selectedTextId) ?? null)
        : null;
    const textFormValues = activeTextPlacement ?? textDraft;
    const isEditingTextPlacement = Boolean(activeTextPlacement);
    const textDraftHasContent = textDraft.text.trim().length > 0;
    const symbolWidthPct = useMemo(() => Math.min(0.18, Math.max(0.05, symbolSize / 160)), [symbolSize]);
    const canStamp = Boolean(pdf) &&
        (placements.length > 0 || textPlacements.length > 0 || strokes.length > 0) &&
        !isStamping;
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
        setError(null);
        setPlacements([]);
        setTextPlacements([]);
        setStrokes([]);
        setHistory([]);
        setSelectedTextId(null);
        setDownloadError(null);
        setDownloadMessage(null);
        setActiveTool("signature");
        setTextToolError(null);
        setTextDraft((draft) => ({ ...draft, text: "" }));
        try {
            pdf?.doc.destroy();
        }
        catch {
            // ignore
        }
        try {
            const loaded = await loadPdfFromFile(file, {
                requestPassword: (reason) => new Promise((resolve) => {
                    setPasswordPrompt({ fileName: file.name, reason, resolve });
                }),
            });
            setPdf(loaded);
            setStatus("ready");
            setCurrentPage(1);
            setZoom(1);
            const key = buildFileKey(file.name, file.size);
            fileKeyRef.current = key;
            const session = useSignatureSession.getState();
            if (session.fileKey === key) {
                setPlacements(session.placements);
                setTextPlacements(session.textPlacements);
                setStrokes(session.strokes);
            }
        }
        catch (loadError) {
            console.error(loadError);
            setPdf(null);
            setStatus("error");
            setError(getFriendlyPdfError(loadError));
        }
    }, [pdf]);
    const handleFilesSelected = useCallback((files) => {
        void loadFile(files[0] ?? null);
    }, [loadFile]);
    const { isDragActive, inputProps, dropZoneProps } = useDragDrop({
        accept: "application/pdf",
        onFiles: handleFilesSelected,
    });
    const handlePlacementDelete = useCallback((id) => {
        setPlacements((current) => current.filter((placement) => placement.id !== id));
        if (selectedPlacementId === id) {
            setSelectedPlacementId(null);
        }
    }, [selectedPlacementId]);
    const handleTextPlacementDelete = useCallback((id) => {
        setTextPlacements((current) => current.filter((placement) => placement.id !== id));
        if (selectedTextId === id) {
            setSelectedTextId(null);
        }
    }, [selectedTextId]);
    const startPlacementDrag = useCallback((target, placement, mode) => (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!overlayRef.current) {
            return;
        }
        const bounds = overlayRef.current.getBoundingClientRect();
        if (bounds.width === 0 || bounds.height === 0) {
            return;
        }
        if (dragSessionRef.current) {
            return;
        }
        const startX = event.clientX;
        const startY = event.clientY;
        const startLeft = placement.xPct;
        const startTop = placement.yPct;
        const startWidth = placement.widthPct;
        const moveHandler = (moveEvent) => {
            moveEvent.preventDefault();
            const session = dragSessionRef.current;
            if (!session) {
                return;
            }
            const deltaX = (moveEvent.clientX - startX) / bounds.width;
            const deltaY = (moveEvent.clientY - startY) / bounds.height;
            if (session.target === "signature") {
                setPlacements((current) => current.map((entry) => {
                    if (entry.id !== session.placementId) {
                        return entry;
                    }
                    if (session.mode === "move") {
                        const targetX = startLeft + deltaX;
                        const targetY = startTop + deltaY;
                        return movePlacement({
                            placement: entry,
                            deltaXPct: targetX - entry.xPct,
                            deltaYPct: targetY - entry.yPct,
                        });
                    }
                    const targetWidth = Math.max(0.08, startWidth + deltaX);
                    return resizePlacement({
                        placement: entry,
                        nextWidthPct: targetWidth,
                        canvasAspect: bounds.width / bounds.height,
                    });
                }));
            }
            else {
                setTextPlacements((current) => current.map((entry) => {
                    if (entry.id !== session.placementId) {
                        return entry;
                    }
                    if (session.mode === "move") {
                        const targetX = startLeft + deltaX;
                        const targetY = startTop + deltaY;
                        return moveTextPlacement({
                            placement: entry,
                            deltaXPct: targetX - entry.xPct,
                            deltaYPct: targetY - entry.yPct,
                        });
                    }
                    const targetWidth = Math.max(0.02, startWidth + deltaX);
                    return resizeTextPlacement({
                        placement: entry,
                        nextWidthPct: targetWidth,
                    });
                }));
            }
        };
        const upHandler = (upEvent) => {
            upEvent.preventDefault();
            if (dragSessionRef.current) {
                window.removeEventListener("pointermove", dragSessionRef.current.moveHandler);
                window.removeEventListener("pointerup", dragSessionRef.current.upHandler);
                dragSessionRef.current = null;
            }
        };
        dragSessionRef.current = {
            target,
            placementId: placement.id,
            mode,
            startX,
            startY,
            startLeft,
            startTop,
            startWidth,
            bounds: { width: bounds.width, height: bounds.height },
            moveHandler,
            upHandler,
        };
        window.addEventListener("pointermove", moveHandler);
        window.addEventListener("pointerup", upHandler, { once: true });
    }, [setPlacements, setTextPlacements]);
    const pushHistory = useCallback(() => {
        setHistory((prev) => [
            { placements: [...placements], textPlacements: [...textPlacements], strokes: [...strokes] },
            ...prev,
        ].slice(0, HISTORY_LIMIT));
    }, [placements, textPlacements, strokes]);
    const handleUndo = useCallback(() => {
        setHistory((current) => {
            if (current.length === 0)
                return current;
            const [latest, ...rest] = current;
            if (latest) {
                setPlacements(latest.placements);
                setTextPlacements(latest.textPlacements);
                setStrokes(latest.strokes);
                setSelectedPlacementId(null);
                setSelectedTextId(null);
            }
            return rest;
        });
    }, []);
    useEffect(() => {
        const handler = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "z") {
                event.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [handleUndo]);
    useEffect(() => {
        if (!fileKeyRef.current || status !== "ready")
            return;
        if (saveTimerRef.current)
            clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            sessionStore.save({
                fileKey: fileKeyRef.current,
                placements,
                textPlacements,
                strokes,
            });
        }, SAVE_DEBOUNCE_MS);
        return () => {
            if (saveTimerRef.current)
                clearTimeout(saveTimerRef.current);
        };
    }, [placements, textPlacements, strokes, sessionStore, status]);
    const strokesForCurrentPage = strokes.filter((s) => s.pageNumber === currentPage);
    const handleOverlayPointerDown = useCallback((event) => {
        if (!overlayRef.current || !pdf) {
            return;
        }
        if (dragSessionRef.current) {
            return;
        }
        const bounds = overlayRef.current.getBoundingClientRect();
        if (bounds.width === 0 || bounds.height === 0) {
            return;
        }
        event.preventDefault();
        const pointXPct = (event.clientX - bounds.left) / bounds.width;
        const pointYPct = (event.clientY - bounds.top) / bounds.height;
        if (activeTool === "text") {
            if (selectedTextId) {
                setTextToolError("Finish editing or deselect the current text block before placing a new one.");
                return;
            }
            const trimmed = textDraft.text.trim();
            if (!trimmed) {
                setTextToolError("Enter text before placing it on the page.");
                return;
            }
            pushHistory();
            const placement = createTextPlacement({
                text: trimmed,
                fontSizePt: textDraft.fontSizePt,
                color: textDraft.color,
                widthPct: textDraft.widthPct,
                pageNumber: currentPage,
                pointXPct,
                pointYPct,
            });
            setTextPlacements((current) => [...current, placement]);
            setSelectedTextId(null);
            setSelectedPlacementId(null);
            setTextDraft((draft) => ({ ...draft, text: "" }));
            setTextToolError(null);
            setDownloadMessage(null);
            return;
        }
        if (activeTool === "symbol") {
            pushHistory();
            const placement = createTextPlacement({
                text: symbolPreset.glyph,
                fontSizePt: symbolSize,
                color: symbolColor,
                widthPct: symbolWidthPct,
                pageNumber: currentPage,
                pointXPct,
                pointYPct,
            });
            setTextPlacements((current) => [...current, placement]);
            setSelectedTextId(placement.id);
            setSelectedPlacementId(null);
            setActiveTool("signature");
            setTextToolError(null);
            setDownloadMessage(null);
            return;
        }
        if (!activeSignature) {
            return;
        }
        pushHistory();
        const placement = createPlacementFromPoint({
            signature: activeSignature,
            pageNumber: currentPage,
            canvasAspect: bounds.width / bounds.height,
            pointXPct,
            pointYPct,
        });
        setPlacements((current) => [...current, placement]);
        setSelectedPlacementId(placement.id);
        setSelectedTextId(null);
        setDownloadMessage(null);
    }, [
        activeSignature,
        activeTool,
        currentPage,
        pdf,
        pushHistory,
        selectedTextId,
        symbolColor,
        symbolPreset,
        symbolSize,
        symbolWidthPct,
        textDraft,
    ]);
    const handleStamp = useCallback(async () => {
        if (!pdf || (placements.length === 0 && textPlacements.length === 0 && strokes.length === 0)) {
            return;
        }
        setStamping(true);
        setDownloadError(null);
        setDownloadMessage(null);
        try {
            const result = await stampSignaturesToExportResult({
                pdf,
                placements,
                signatures,
                textPlacements,
                strokes,
                strokesOnTop,
            });
            triggerBlobDownload(result.blob, result.downloadName);
            logExportResult(result);
            const used = new Set(placements.map((placement) => placement.signatureId));
            used.forEach((id) => markUsed(id));
            const summary = [];
            if (placements.length > 0) {
                summary.push(`${placements.length} signature${placements.length === 1 ? "" : "s"}`);
            }
            if (textPlacements.length > 0) {
                summary.push(`${textPlacements.length} text block${textPlacements.length === 1 ? "" : "s"}`);
            }
            if (strokes.length > 0) {
                summary.push(`${strokes.length} stroke${strokes.length === 1 ? "" : "s"}`);
            }
            setDownloadMessage(`Stamped ${summary.join(" + ")}.`);
            sessionStore.clear();
        }
        catch (stampError) {
            console.error(stampError);
            setDownloadError(getFriendlyPdfError(stampError));
        }
        finally {
            setStamping(false);
        }
    }, [markUsed, pdf, placements, sessionStore, signatures, strokes, strokesOnTop, textPlacements]);
    const handleSignatureDelete = useCallback((id) => {
        deleteSignature(id);
        setPlacements((current) => current.filter((placement) => placement.signatureId !== id));
        if (activeSignatureId === id) {
            setActiveSignatureId(signatures.find((entry) => entry.id !== id)?.id ?? null);
        }
    }, [activeSignatureId, deleteSignature, signatures]);
    const handleSignatureCreated = useCallback((entry) => {
        setActiveSignatureId(entry.id);
    }, []);
    const updateTextValue = useCallback((value) => {
        if (selectedTextId) {
            setTextPlacements((current) => current.map((placement) => placement.id === selectedTextId ? { ...placement, text: value } : placement));
        }
        else {
            setTextDraft((draft) => ({ ...draft, text: value }));
        }
        setTextToolError(null);
    }, [selectedTextId]);
    const updateTextFontSize = useCallback((value) => {
        const clamped = Math.min(48, Math.max(8, value));
        if (selectedTextId) {
            setTextPlacements((current) => current.map((placement) => placement.id === selectedTextId ? { ...placement, fontSizePt: clamped } : placement));
        }
        else {
            setTextDraft((draft) => ({ ...draft, fontSizePt: clamped }));
        }
    }, [selectedTextId]);
    const updateTextWidth = useCallback((value) => {
        const clamped = Math.min(0.9, Math.max(0.02, value));
        if (selectedTextId) {
            setTextPlacements((current) => current.map((placement) => placement.id === selectedTextId ? { ...placement, widthPct: clamped } : placement));
        }
        else {
            setTextDraft((draft) => ({ ...draft, widthPct: clamped }));
        }
    }, [selectedTextId]);
    const updateTextColor = useCallback((value) => {
        if (selectedTextId) {
            setTextPlacements((current) => current.map((placement) => placement.id === selectedTextId ? { ...placement, color: value } : placement));
        }
        else {
            setTextDraft((draft) => ({ ...draft, color: value }));
        }
    }, [selectedTextId]);
    const activateTool = useCallback((tool) => {
        setActiveTool(tool);
        if (tool !== "signature") {
            setSelectedPlacementId(null);
        }
        if (tool !== "text") {
            setTextToolError(null);
        }
    }, []);
    const clearTextSelection = useCallback(() => {
        setSelectedTextId(null);
        setTextToolError(null);
    }, []);
    const handlePenPointerDown = useCallback((event) => {
        if (activeTool !== "pen" && activeTool !== "highlighter")
            return;
        if (!overlayRef.current)
            return;
        event.preventDefault();
        event.stopPropagation();
        isDrawingRef.current = true;
        const bounds = overlayRef.current.getBoundingClientRect();
        const xPct = (event.clientX - bounds.left) / bounds.width;
        const yPct = (event.clientY - bounds.top) / bounds.height;
        setActiveStrokePoints([{ xPct, yPct }]);
    }, [activeTool]);
    const handlePenPointerMove = useCallback((event) => {
        if (!isDrawingRef.current || !overlayRef.current)
            return;
        event.preventDefault();
        const bounds = overlayRef.current.getBoundingClientRect();
        const xPct = (event.clientX - bounds.left) / bounds.width;
        const yPct = (event.clientY - bounds.top) / bounds.height;
        setActiveStrokePoints((prev) => (prev ? [...prev, { xPct, yPct }] : null));
    }, []);
    const handlePenPointerUp = useCallback(() => {
        if (!isDrawingRef.current)
            return;
        isDrawingRef.current = false;
        setActiveStrokePoints((points) => {
            if (!points || points.length < 2)
                return null;
            const stroke = createStrokeFromPoints({
                pageNumber: currentPage,
                points,
                color: penColor,
                widthPx: activeTool === "highlighter" ? penWidth * 4 : penWidth,
                tool: activeTool === "highlighter" ? "highlighter" : "pen",
            });
            if (stroke) {
                pushHistory();
                setStrokes((prev) => [...prev, stroke]);
            }
            return null;
        });
    }, [activeTool, currentPage, penColor, penWidth, pushHistory]);
    return (_jsxs("div", { className: "mx-auto flex max-w-full flex-col gap-4 px-4 py-6 lg:px-8", children: [_jsx("div", { ...dropZoneProps, className: clsx("rounded-3xl border-2 border-dashed p-8 text-center transition-colors", isDragActive
                    ? "border-indigo-400 bg-indigo-50/70 dark:border-indigo-300 dark:bg-indigo-500/10"
                    : "border-slate-300/70 bg-white/80 dark:border-white/10 dark:bg-slate-900/60"), children: _jsxs("div", { className: "mx-auto flex max-w-3xl flex-col gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-lg font-semibold text-slate-800 dark:text-white", children: "Load a PDF to start stamping signatures" }), _jsxs("p", { className: "text-sm text-slate-500 dark:text-slate-300", children: ["Files stay in your browser. ", SIGNATURE_DISCLAIMER_COPY] })] }), _jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx("label", { htmlFor: "signature-upload", className: "inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:bg-white dark:text-slate-900", children: "Choose PDF" }), _jsx("input", { id: "signature-upload", ...inputProps }), _jsx("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "or drag anywhere in this panel" })] })] }) }), error ? (_jsx(Alert, { variant: "error", onDismiss: () => setError(null), children: error })) : null, status === "ready" && pdf ? (_jsxs(_Fragment, { children: [_jsx(SignatureRibbon, { activeTool: activeTool, onActivateTool: activateTool, signatures: signatures, activeSignatureId: activeSignatureId, onSelectSignature: setActiveSignatureId, onDeleteSignature: handleSignatureDelete, onOpenBuilder: () => setBuilderOpen(true), textFormValues: textFormValues, isEditingTextPlacement: isEditingTextPlacement, textDraftHasContent: textDraftHasContent, textToolError: textToolError, activeTextPlacement: activeTextPlacement ?? undefined, onUpdateTextValue: updateTextValue, onUpdateTextFontSize: updateTextFontSize, onUpdateTextWidth: updateTextWidth, onUpdateTextColor: updateTextColor, onClearTextSelection: clearTextSelection, symbolPreset: symbolPreset, symbolSize: symbolSize, symbolColor: symbolColor, onSetSymbolPreset: setSymbolPreset, onSetSymbolSize: setSymbolSize, onSetSymbolColor: setSymbolColor, penColor: penColor, penWidth: penWidth, onSetPenColor: setPenColor, onSetPenWidth: setPenWidth, strokes: strokes, onClearStrokes: () => {
                            pushHistory();
                            setStrokes([]);
                        }, onDeleteStroke: (id) => {
                            pushHistory();
                            setStrokes((prev) => prev.filter((s) => s.id !== id));
                        }, placements: placements, textPlacements: textPlacements, selectedPlacementId: selectedPlacementId, selectedTextId: selectedTextId, onSelectPlacement: (id, pageNumber) => {
                            setSelectedPlacementId(id);
                            setCurrentPage(pageNumber);
                        }, onDeletePlacement: handlePlacementDelete, onSelectTextPlacement: (id, pageNumber) => {
                            setSelectedTextId(id);
                            setCurrentPage(pageNumber);
                            setSelectedPlacementId(null);
                        }, onDeleteTextPlacement: handleTextPlacementDelete, onClearAllPlacements: () => {
                            setPlacements([]);
                            setSelectedPlacementId(null);
                        }, onClearAllTextPlacements: () => {
                            setTextPlacements([]);
                            setSelectedTextId(null);
                        }, signatureMap: signatureMap, currentPage: currentPage, canStamp: canStamp, isStamping: isStamping, onStamp: handleStamp, downloadMessage: downloadMessage, downloadError: downloadError, historyLength: history.length, onUndo: handleUndo, overlayCount: placements.length + textPlacements.length + strokes.length, strokesOnTop: strokesOnTop, onSetStrokesOnTop: setStrokesOnTop }), _jsxs("section", { className: "rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-inner dark:border-white/10 dark:bg-slate-900/70", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 text-sm text-slate-500 dark:border-white/5 dark:text-slate-300", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", className: "rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 disabled:opacity-40 dark:border-white/10 dark:text-white", onClick: () => setCurrentPage((page) => Math.max(1, page - 1)), disabled: currentPage === 1, children: "Prev" }), _jsxs("span", { children: ["Page ", currentPage, " / ", pdf.pageCount] }), _jsx("button", { type: "button", className: "rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 disabled:opacity-40 dark:border-white/10 dark:text-white", onClick: () => setCurrentPage((page) => Math.min(pdf.pageCount, page + 1)), disabled: currentPage === pdf.pageCount, children: "Next" })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { children: "Zoom" }), _jsx("input", { type: "range", min: 0.6, max: 1.6, step: 0.1, value: zoom, onChange: (event) => setZoom(Number(event.target.value)) }), _jsxs("span", { children: [Math.round(zoom * 100), "%"] })] })] }), _jsx("div", { className: "mt-4 flex justify-center overflow-auto", children: _jsxs("div", { className: "relative flex min-h-[420px] w-full max-w-[900px] items-center justify-center", style: {
                                        width: canvasSize.width || "100%",
                                        height: canvasSize.height || 520,
                                    }, children: [_jsx("canvas", { ref: canvasRef, className: clsx("rounded-2xl border border-slate-200 shadow transition dark:border-white/10", canvasSize.width === 0 ? "opacity-0" : "opacity-100"), style: { width: canvasSize.width || 0, height: canvasSize.height || 0 } }), _jsx("div", { ref: overlayRef, className: clsx("absolute left-0 top-0", activeTool === "pen" || activeTool === "highlighter"
                                                ? "cursor-crosshair"
                                                : activeTool === "text" || activeTool === "symbol"
                                                    ? "cursor-text"
                                                    : activeSignature
                                                        ? "cursor-crosshair"
                                                        : "cursor-not-allowed"), style: {
                                                width: canvasSize.width || 0,
                                                height: canvasSize.height || 0,
                                            }, "data-testid": "signature-overlay", onPointerDown: activeTool === "pen" || activeTool === "highlighter"
                                                ? undefined
                                                : handleOverlayPointerDown, children: canvasSize.width === 0 ? null : (_jsxs(_Fragment, { children: [placementsForCurrentPage.length === 0 &&
                                                        textPlacementsForCurrentPage.length === 0 &&
                                                        strokesForCurrentPage.length === 0 ? (_jsx("div", { className: "absolute inset-0 flex items-center justify-center text-sm text-slate-500", style: { pointerEvents: "none" }, children: activeTool === "pen" || activeTool === "highlighter"
                                                            ? "Draw on the page to add strokes."
                                                            : activeTool === "text"
                                                                ? "Click anywhere to drop your typed text."
                                                                : activeTool === "symbol"
                                                                    ? "Click anywhere to drop the selected symbol."
                                                                    : activeSignature
                                                                        ? "Click anywhere to place the selected signature."
                                                                        : "Create or select a signature or switch to text/symbol tools." })) : null, placementsForCurrentPage.map((placement) => {
                                                        const isSelected = placement.id === selectedPlacementId;
                                                        const signature = signatureMap.get(placement.signatureId);
                                                        if (!signature) {
                                                            return null;
                                                        }
                                                        return (_jsxs("div", { className: "absolute", style: {
                                                                left: `${placement.xPct * 100}%`,
                                                                top: `${placement.yPct * 100}%`,
                                                                width: `${placement.widthPct * 100}%`,
                                                                height: `${placement.heightPct * 100}%`,
                                                            }, onPointerDown: (event) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                setSelectedPlacementId(placement.id);
                                                                setSelectedTextId(null);
                                                            }, children: [_jsx("img", { src: signature.dataUrl, alt: signature.label, className: "h-full w-full rounded-xl object-contain shadow-sm", draggable: false }), isSelected ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "absolute inset-0 rounded-2xl border-2 border-indigo-400 shadow-[0_0_0_2px_rgba(79,70,229,0.25)]" }), _jsx("div", { className: "absolute inset-0 cursor-move", onPointerDown: startPlacementDrag("signature", placement, "move"), "aria-label": "Move signature" }), _jsx("div", { className: "absolute -bottom-2 -right-2 h-6 w-6 cursor-se-resize rounded-full border-2 border-white bg-indigo-500", onPointerDown: startPlacementDrag("signature", placement, "resize"), "aria-label": "Resize signature" })] })) : null] }, placement.id));
                                                    }), !strokesOnTop ? (_jsxs("svg", { className: "absolute inset-0 h-full w-full", viewBox: `0 0 ${canvasSize.width} ${canvasSize.height}`, style: {
                                                            pointerEvents: activeTool === "pen" || activeTool === "highlighter"
                                                                ? "auto"
                                                                : "none",
                                                        }, onPointerDown: handlePenPointerDown, onPointerMove: handlePenPointerMove, onPointerUp: handlePenPointerUp, onPointerLeave: handlePenPointerUp, children: [strokesForCurrentPage.map((stroke) => (_jsx("polyline", { points: stroke.points
                                                                    .map((p) => `${p.xPct * canvasSize.width},${p.yPct * canvasSize.height}`)
                                                                    .join(" "), fill: "none", stroke: stroke.color, strokeWidth: stroke.widthPx, strokeLinecap: "round", strokeLinejoin: "round", opacity: stroke.opacity }, stroke.id))), activeStrokePoints && activeStrokePoints.length >= 2 ? (_jsx("polyline", { points: activeStrokePoints
                                                                    .map((p) => `${p.xPct * canvasSize.width},${p.yPct * canvasSize.height}`)
                                                                    .join(" "), fill: "none", stroke: penColor, strokeWidth: activeTool === "highlighter" ? penWidth * 4 : penWidth, strokeLinecap: "round", strokeLinejoin: "round", opacity: activeTool === "highlighter" ? 0.3 : 1 })) : null] })) : null, textPlacementsForCurrentPage.map((placement) => {
                                                        const isSelected = placement.id === selectedTextId;
                                                        return (_jsxs("div", { className: "absolute", style: {
                                                                left: `${placement.xPct * 100}%`,
                                                                top: `${placement.yPct * 100}%`,
                                                                width: `${placement.widthPct * 100}%`,
                                                            }, onPointerDown: (event) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                setSelectedTextId(placement.id);
                                                                setSelectedPlacementId(null);
                                                                setActiveTool("text");
                                                            }, children: [_jsx("div", { className: clsx("relative rounded-2xl px-1 py-1", isSelected
                                                                        ? "bg-white/90 shadow border-2 border-emerald-400"
                                                                        : "bg-transparent border border-transparent"), children: _jsx("div", { className: "pointer-events-none whitespace-pre-wrap text-sm text-slate-900", style: {
                                                                            fontSize: `${placement.fontSizePt}px`,
                                                                            color: placement.color,
                                                                            lineHeight: 1.3,
                                                                        }, children: placement.text || "(Empty text)" }) }), isSelected ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "absolute inset-0 cursor-move rounded-2xl", onPointerDown: startPlacementDrag("text", placement, "move"), "aria-label": "Move text block" }), _jsx("div", { className: "absolute -bottom-2 -right-2 h-6 w-6 cursor-se-resize rounded-full border-2 border-white bg-emerald-500", onPointerDown: startPlacementDrag("text", placement, "resize"), "aria-label": "Resize text block" })] })) : null] }, placement.id));
                                                    }), strokesOnTop ? (_jsxs("svg", { className: "absolute inset-0 h-full w-full", viewBox: `0 0 ${canvasSize.width} ${canvasSize.height}`, style: {
                                                            pointerEvents: activeTool === "pen" || activeTool === "highlighter"
                                                                ? "auto"
                                                                : "none",
                                                        }, onPointerDown: handlePenPointerDown, onPointerMove: handlePenPointerMove, onPointerUp: handlePenPointerUp, onPointerLeave: handlePenPointerUp, children: [strokesForCurrentPage.map((stroke) => (_jsx("polyline", { points: stroke.points
                                                                    .map((p) => `${p.xPct * canvasSize.width},${p.yPct * canvasSize.height}`)
                                                                    .join(" "), fill: "none", stroke: stroke.color, strokeWidth: stroke.widthPx, strokeLinecap: "round", strokeLinejoin: "round", opacity: stroke.opacity }, stroke.id))), activeStrokePoints && activeStrokePoints.length >= 2 ? (_jsx("polyline", { points: activeStrokePoints
                                                                    .map((p) => `${p.xPct * canvasSize.width},${p.yPct * canvasSize.height}`)
                                                                    .join(" "), fill: "none", stroke: penColor, strokeWidth: activeTool === "highlighter" ? penWidth * 4 : penWidth, strokeLinecap: "round", strokeLinejoin: "round", opacity: activeTool === "highlighter" ? 0.3 : 1 })) : null] })) : null] })) }), canvasSize.width === 0 ? (_jsx("div", { className: "absolute inset-0 flex items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/70", children: "Rendering page preview..." })) : null] }) })] })] })) : null, _jsx(SignatureBuilderModal, { open: isBuilderOpen, onClose: () => setBuilderOpen(false), onCreated: (entry) => {
                    handleSignatureCreated(entry);
                    setBuilderOpen(false);
                } }), _jsx(PasswordPromptModal, { open: Boolean(passwordPrompt), fileName: passwordPrompt?.fileName ?? "", reason: passwordPrompt?.reason ?? "password-required", onSubmit: handlePasswordSubmit, onCancel: handlePasswordCancel })] }));
};
export default SignaturesToolPage;
