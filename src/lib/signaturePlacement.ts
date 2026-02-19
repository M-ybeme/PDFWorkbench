import type { SignatureEntry } from "../state/signatureLibrary";

export const SIGNATURE_DISCLAIMER_COPY =
  "Signature stamps are visual only. They do not apply cryptographic or certified signatures.";

export type SignaturePlacement = {
  id: string;
  signatureId: string;
  pageNumber: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  aspectRatio: number;
};

export type TextPlacement = {
  id: string;
  pageNumber: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  text: string;
  fontSizePt: number;
  color: string;
};

export type StrokePoint = {
  xPct: number;
  yPct: number;
};

export type DrawnStroke = {
  id: string;
  pageNumber: number;
  points: StrokePoint[];
  color: string;
  widthPx: number;
  opacity: number;
  tool: "pen" | "highlighter";
};

export type PageDimensions = {
  width: number;
  height: number;
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `signature-placement-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createTextId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `text-placement-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const deriveHeightPct = (widthPct: number, aspectRatio: number, canvasAspect: number) => {
  if (aspectRatio <= 0 || canvasAspect <= 0) {
    return widthPct;
  }

  return (widthPct * canvasAspect) / aspectRatio;
};

const clampWithinCanvas = (placement: SignaturePlacement) => {
  const maxX = Math.max(0, 1 - placement.widthPct);
  const maxY = Math.max(0, 1 - placement.heightPct);

  return {
    ...placement,
    xPct: clamp(placement.xPct, 0, maxX),
    yPct: clamp(placement.yPct, 0, maxY),
  } satisfies SignaturePlacement;
};

const normalizeSize = (
  placement: SignaturePlacement,
  canvasAspect: number,
  minWidthPct = 0.08,
  maxWidthPct = 0.9,
) => {
  const cappedWidth = clamp(placement.widthPct, minWidthPct, maxWidthPct);
  const derivedHeight = deriveHeightPct(cappedWidth, placement.aspectRatio, canvasAspect);
  const maxHeight = 0.8;
  const heightPct = Math.min(derivedHeight, maxHeight);
  const widthPct = Math.min(cappedWidth, 1);

  return clampWithinCanvas({
    ...placement,
    widthPct,
    heightPct,
  });
};

type PlacementFromPointArgs = {
  signature: SignatureEntry;
  pageNumber: number;
  canvasAspect: number;
  pointXPct: number;
  pointYPct: number;
  defaultWidthPct?: number;
};

export const createPlacementFromPoint = ({
  signature,
  pageNumber,
  canvasAspect,
  pointXPct,
  pointYPct,
  defaultWidthPct = 0.28,
}: PlacementFromPointArgs): SignaturePlacement => {
  const aspectRatio = signature.width / Math.max(1, signature.height);
  const baseWidthPct = clamp(defaultWidthPct, 0.08, 0.9);
  const heightPct = deriveHeightPct(baseWidthPct, aspectRatio, canvasAspect);
  const widthPct = baseWidthPct;

  const placement: SignaturePlacement = {
    id: createId(),
    signatureId: signature.id,
    pageNumber,
    xPct: clamp(pointXPct - widthPct / 2, 0, 1 - widthPct),
    yPct: clamp(pointYPct - heightPct / 2, 0, 1 - heightPct),
    widthPct,
    heightPct,
    aspectRatio,
  };

  return normalizeSize(placement, canvasAspect);
};

type ResizePlacementArgs = {
  placement: SignaturePlacement;
  nextWidthPct: number;
  canvasAspect: number;
};

export const resizePlacement = ({ placement, nextWidthPct, canvasAspect }: ResizePlacementArgs) => {
  const updated = normalizeSize(
    {
      ...placement,
      widthPct: nextWidthPct,
    },
    canvasAspect,
  );

  return clampWithinCanvas(updated);
};

const clampTextWithinCanvas = (placement: TextPlacement) => {
  const widthPct = clamp(placement.widthPct, 0.02, 0.9);
  const maxX = Math.max(0, 1 - widthPct);
  const maxY = Math.max(0, 1 - 0.02);

  return {
    ...placement,
    widthPct,
    xPct: clamp(placement.xPct, 0, maxX),
    yPct: clamp(placement.yPct, 0, maxY),
  } satisfies TextPlacement;
};

type CreateTextPlacementArgs = {
  text: string;
  fontSizePt: number;
  color: string;
  widthPct: number;
  pageNumber: number;
  pointXPct: number;
  pointYPct: number;
};

export const createTextPlacement = ({
  text,
  fontSizePt,
  color,
  widthPct,
  pageNumber,
  pointXPct,
  pointYPct,
}: CreateTextPlacementArgs): TextPlacement => {
  const normalizedWidth = clamp(widthPct, 0.02, 0.9);
  const placement: TextPlacement = {
    id: createTextId(),
    pageNumber,
    xPct: clamp(pointXPct, 0, 1 - normalizedWidth),
    yPct: clamp(pointYPct, 0, 0.98),
    widthPct: normalizedWidth,
    text,
    fontSizePt: clamp(fontSizePt, 8, 48),
    color,
  };

  return clampTextWithinCanvas(placement);
};

type TextMoveArgs = {
  placement: TextPlacement;
  deltaXPct: number;
  deltaYPct: number;
};

export const moveTextPlacement = ({ placement, deltaXPct, deltaYPct }: TextMoveArgs) =>
  clampTextWithinCanvas({
    ...placement,
    xPct: placement.xPct + deltaXPct,
    yPct: placement.yPct + deltaYPct,
  });

type TextResizeArgs = {
  placement: TextPlacement;
  nextWidthPct: number;
};

export const resizeTextPlacement = ({ placement, nextWidthPct }: TextResizeArgs) =>
  clampTextWithinCanvas({
    ...placement,
    widthPct: nextWidthPct,
  });

type MovePlacementArgs = {
  placement: SignaturePlacement;
  deltaXPct: number;
  deltaYPct: number;
};

export const movePlacement = ({ placement, deltaXPct, deltaYPct }: MovePlacementArgs) => {
  const updated: SignaturePlacement = {
    ...placement,
    xPct: placement.xPct + deltaXPct,
    yPct: placement.yPct + deltaYPct,
  };

  return clampWithinCanvas(updated);
};

type PdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const placementToPdfRect = (
  placement: SignaturePlacement,
  size: PageDimensions,
): PdfRect => {
  const width = placement.widthPct * size.width;
  const height = placement.heightPct * size.height;
  const x = placement.xPct * size.width;
  const top = placement.yPct * size.height;
  const y = size.height - top - height;

  return { x, y, width, height };
};

const base64Decode = (value: string): string => {
  if (typeof atob === "function") {
    return atob(value);
  }

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  let index = 0;
  const sanitized = value.replace(/[^A-Za-z0-9+/=]/g, "");

  while (index < sanitized.length) {
    const enc1 = chars.indexOf(sanitized.charAt(index++));
    const enc2 = chars.indexOf(sanitized.charAt(index++));
    const enc3 = chars.indexOf(sanitized.charAt(index++));
    const enc4 = chars.indexOf(sanitized.charAt(index++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64 && enc3 !== -1) {
      output += String.fromCharCode(chr2);
    }
    if (enc4 !== 64 && enc4 !== -1) {
      output += String.fromCharCode(chr3);
    }
  }

  return output;
};

export const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const [, base64 = ""] = dataUrl.split(",");
  const binary = base64Decode(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const textPlacementToPdfPosition = (
  placement: TextPlacement,
  size: PageDimensions,
): { x: number; y: number; maxWidth: number } => {
  const x = placement.xPct * size.width;
  const top = placement.yPct * size.height;
  const maxWidth = Math.max(12, placement.widthPct * size.width);
  const y = size.height - top - placement.fontSizePt;

  return { x, y, maxWidth };
};

const createStrokeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `stroke-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

type CreateStrokeArgs = {
  pageNumber: number;
  points: StrokePoint[];
  color: string;
  widthPx: number;
  tool: "pen" | "highlighter";
};

export const createStrokeFromPoints = ({
  pageNumber,
  points,
  color,
  widthPx,
  tool,
}: CreateStrokeArgs): DrawnStroke | null => {
  if (points.length < 2) return null;

  const clamped = points.map((p) => ({
    xPct: clamp(p.xPct),
    yPct: clamp(p.yPct),
  }));

  return {
    id: createStrokeId(),
    pageNumber,
    points: clamped,
    color,
    widthPx: Math.max(1, widthPx),
    opacity: tool === "highlighter" ? 0.3 : 1,
    tool,
  };
};

export type PdfStrokePoint = { x: number; y: number };

export const strokeToPdfPoints = (stroke: DrawnStroke, size: PageDimensions): PdfStrokePoint[] =>
  stroke.points.map((p) => ({
    x: p.xPct * size.width,
    y: size.height - p.yPct * size.height,
  }));
