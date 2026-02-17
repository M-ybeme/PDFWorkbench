export const SIGNATURE_DISCLAIMER_COPY = "Signature stamps are visual only. They do not apply cryptographic or certified signatures.";
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
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const deriveHeightPct = (widthPct, aspectRatio, canvasAspect) => {
    if (aspectRatio <= 0 || canvasAspect <= 0) {
        return widthPct;
    }
    return (widthPct * canvasAspect) / aspectRatio;
};
const clampWithinCanvas = (placement) => {
    const maxX = Math.max(0, 1 - placement.widthPct);
    const maxY = Math.max(0, 1 - placement.heightPct);
    return {
        ...placement,
        xPct: clamp(placement.xPct, 0, maxX),
        yPct: clamp(placement.yPct, 0, maxY),
    };
};
const normalizeSize = (placement, canvasAspect, minWidthPct = 0.08, maxWidthPct = 0.9) => {
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
export const createPlacementFromPoint = ({ signature, pageNumber, canvasAspect, pointXPct, pointYPct, defaultWidthPct = 0.28, }) => {
    const aspectRatio = signature.width / Math.max(1, signature.height);
    const baseWidthPct = clamp(defaultWidthPct, 0.08, 0.9);
    const heightPct = deriveHeightPct(baseWidthPct, aspectRatio, canvasAspect);
    const widthPct = baseWidthPct;
    const placement = {
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
export const resizePlacement = ({ placement, nextWidthPct, canvasAspect }) => {
    const updated = normalizeSize({
        ...placement,
        widthPct: nextWidthPct,
    }, canvasAspect);
    return clampWithinCanvas(updated);
};
const clampTextWithinCanvas = (placement) => {
    const widthPct = clamp(placement.widthPct, 0.15, 0.9);
    const maxX = Math.max(0, 1 - widthPct);
    const maxY = Math.max(0, 1 - 0.02);
    return {
        ...placement,
        widthPct,
        xPct: clamp(placement.xPct, 0, maxX),
        yPct: clamp(placement.yPct, 0, maxY),
    };
};
export const createTextPlacement = ({ text, fontSizePt, color, widthPct, pageNumber, pointXPct, pointYPct, }) => {
    const normalizedWidth = clamp(widthPct, 0.15, 0.9);
    const placement = {
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
export const moveTextPlacement = ({ placement, deltaXPct, deltaYPct }) => clampTextWithinCanvas({
    ...placement,
    xPct: placement.xPct + deltaXPct,
    yPct: placement.yPct + deltaYPct,
});
export const resizeTextPlacement = ({ placement, nextWidthPct }) => clampTextWithinCanvas({
    ...placement,
    widthPct: nextWidthPct,
});
export const movePlacement = ({ placement, deltaXPct, deltaYPct }) => {
    const updated = {
        ...placement,
        xPct: placement.xPct + deltaXPct,
        yPct: placement.yPct + deltaYPct,
    };
    return clampWithinCanvas(updated);
};
export const placementToPdfRect = (placement, size) => {
    const width = placement.widthPct * size.width;
    const height = placement.heightPct * size.height;
    const x = placement.xPct * size.width;
    const top = placement.yPct * size.height;
    const y = size.height - top - height;
    return { x, y, width, height };
};
const base64Decode = (value) => {
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
export const dataUrlToUint8Array = (dataUrl) => {
    const [, base64 = ""] = dataUrl.split(",");
    const binary = base64Decode(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};
export const textPlacementToPdfPosition = (placement, size) => {
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
export const createStrokeFromPoints = ({ pageNumber, points, color, widthPx, tool, }) => {
    if (points.length < 2)
        return null;
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
export const strokeToPdfPoints = (stroke, size) => stroke.points.map((p) => ({
    x: p.xPct * size.width,
    y: size.height - p.yPct * size.height,
}));
