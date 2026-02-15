import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
} from "react";
import clsx from "clsx";

import { SIGNATURE_DISCLAIMER_COPY } from "../lib/signaturePlacement";
import type { SignatureEntry } from "../state/signatureLibrary";
import { useSignatureLibrary } from "../state/signatureLibrary";

type SignatureBuilderModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (entry: SignatureEntry) => void;
};

type SignaturePreview = {
  dataUrl: string;
  width: number;
  height: number;
};

const DRAW_WIDTH = 720;
const DRAW_HEIGHT = 260;
const COLOR_OPTIONS = ["#0f172a", "#1d4ed8", "#047857", "#7c2d12"] as const;
const TABS = [
  { id: "draw" as const, label: "Draw" },
  { id: "type" as const, label: "Type" },
  { id: "upload" as const, label: "Upload" },
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

const DEFAULT_TYPEFACE = TYPEFACE_OPTIONS[0]!;
const getTypefaceById = (id: string) =>
  TYPEFACE_OPTIONS.find((entry) => entry.id === id) ?? DEFAULT_TYPEFACE;

const SignatureBuilderModal = ({ open, onClose, onCreated }: SignatureBuilderModalProps) => {
  const addSignature = useSignatureLibrary((state) => state.addSignature);
  const [mode, setMode] = useState<(typeof TABS)[number]["id"]>("draw");
  const [label, setLabel] = useState("Signature");
  const [drawColor, setDrawColor] = useState<string>(COLOR_OPTIONS[0]);
  const [typedColor, setTypedColor] = useState<string>(COLOR_OPTIONS[0]);
  const [typedFont, setTypedFont] = useState(DEFAULT_TYPEFACE.id);
  const [typedValue, setTypedValue] = useState("");
  const [typedPreview, setTypedPreview] = useState<SignaturePreview | null>(null);
  const [uploadPreview, setUploadPreview] = useState<SignaturePreview | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const drawTracker = useRef<{ isDrawing: boolean; lastPoint: { x: number; y: number } | null }>({
    isDrawing: false,
    lastPoint: null,
  });
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ratioRef = useRef(1);
  const typedTypeface = useMemo(() => getTypefaceById(typedFont), [typedFont]);

  const closeModal = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
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

  const pointerToCanvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
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

  const beginDraw = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = pointerToCanvasPoint(event);
    if (!point) {
      return;
    }

    drawTracker.current = { isDrawing: true, lastPoint: point };
    (event.target as HTMLCanvasElement | null)?.setPointerCapture(event.pointerId);
  };

  const continueDraw = (event: PointerEvent<HTMLCanvasElement>) => {
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

  const endDraw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawTracker.current.isDrawing) {
      return;
    }

    drawTracker.current = { isDrawing: false, lastPoint: null };
    (event.target as HTMLCanvasElement | null)?.releasePointerCapture(event.pointerId);
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

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
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
      const dataUrl = await new Promise<string>((resolve, reject) => {
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
      await new Promise<void>((resolve, reject) => {
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
    } catch (error) {
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

  const drawnPreviewSrc =
    hasDrawn && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-slate-900/70" aria-hidden="true" onClick={closeModal} />
      <div className="relative z-10 w-full max-w-4xl rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950/95">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Signatures
            </p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Create a signature stamp
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {SIGNATURE_DISCLAIMER_COPY}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-semibold",
                  mode === tab.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "border border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-200",
                )}
                onClick={() => setMode(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Label
                <input
                  type="text"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  placeholder="Signature label"
                />
              </label>

              {mode === "draw" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>Ink color:</span>
                    <div className="flex gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={clsx(
                            "h-8 w-8 rounded-full border-2",
                            drawColor === color
                              ? "border-slate-900"
                              : "border-transparent opacity-70",
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setDrawColor(color)}
                          aria-label={`Use ${color} ink`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="ml-auto text-xs font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-600"
                      onClick={resetCanvas}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-dashed border-slate-300/80 bg-white shadow-inner dark:border-white/10 dark:bg-slate-900">
                    <canvas
                      ref={canvasRef}
                      className="block cursor-crosshair"
                      onPointerDown={beginDraw}
                      onPointerMove={continueDraw}
                      onPointerUp={endDraw}
                      onPointerLeave={endDraw}
                    />
                  </div>
                </div>
              ) : null}

              {mode === "type" ? (
                <div className="space-y-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Typed name
                    <input
                      type="text"
                      value={typedValue}
                      onChange={(event) => setTypedValue(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                      placeholder="Your name"
                    />
                  </label>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      Style
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {TYPEFACE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={clsx(
                            "rounded-2xl border px-4 py-3 text-sm",
                            typedFont === option.id
                              ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                              : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-100",
                          )}
                          style={{ fontFamily: option.previewFont }}
                          onClick={() => setTypedFont(option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>Ink color:</span>
                    <div className="flex gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={clsx(
                            "h-8 w-8 rounded-full border-2",
                            typedColor === color
                              ? "border-slate-900"
                              : "border-transparent opacity-70",
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setTypedColor(color)}
                          aria-label={`Use ${color} ink`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-slate-300/70 bg-white/70 px-6 py-6 text-center text-3xl text-slate-800 shadow-inner dark:border-white/10 dark:bg-slate-900 dark:text-white">
                    <span style={{ fontFamily: typedTypeface.previewFont, color: typedColor }}>
                      {typedValue || "Your Name"}
                    </span>
                  </div>
                </div>
              ) : null}

              {mode === "upload" ? (
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/70 bg-white/70 px-6 py-10 text-center text-sm text-slate-500 shadow-inner dark:border-white/10 dark:bg-slate-900">
                    <input
                      type="file"
                      accept="image/png,image/svg+xml,image/webp"
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      Click to choose a PNG signature
                    </span>
                    <span className="text-xs text-slate-400">
                      Transparent backgrounds preserve best results.
                    </span>
                  </label>
                  {uploadError ? <p className="text-sm text-rose-500">{uploadError}</p> : null}
                  {uploadPreview ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-inner dark:border-white/10 dark:bg-slate-900">
                      <img
                        src={uploadPreview.dataUrl}
                        alt="Uploaded signature preview"
                        className="mx-auto max-h-40 object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Preview
              </p>
              {mode === "draw" ? (
                <div className="rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/80 p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-950/40">
                  {drawnPreviewSrc ? (
                    <img
                      src={drawnPreviewSrc}
                      alt="Drawn signature preview"
                      className="mx-auto max-h-40 object-contain"
                    />
                  ) : (
                    <p>Use the drawing pad to sketch a signature.</p>
                  )}
                </div>
              ) : null}

              {mode === "type" ? (
                <div
                  className="rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/80 p-6 text-center text-3xl text-slate-900 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  style={{ fontFamily: typedTypeface.previewFont, color: typedColor }}
                >
                  {typedValue || "Your Name"}
                </div>
              ) : null}

              {mode === "upload" ? (
                <div className="rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/80 p-6 text-center dark:border-white/10 dark:bg-slate-950/40">
                  {uploadPreview ? (
                    <img
                      src={uploadPreview.dataUrl}
                      alt="Uploaded signature preview"
                      className="mx-auto max-h-48 object-contain"
                    />
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Upload a transparent PNG to preview it here.
                    </p>
                  )}
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
                <p>
                  Tips: keep signatures under 900px wide, use transparent backgrounds, and avoid
                  colors that blend into your document.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700 dark:text-slate-300"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition disabled:opacity-40 dark:bg-white dark:text-slate-900"
              disabled={!canSave}
              onClick={handleSave}
            >
              Save signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureBuilderModal;
