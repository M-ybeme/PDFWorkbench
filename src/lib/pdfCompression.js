import { PDFDocument } from "pdf-lib";
import { buildDownloadName } from "./documentPipeline";
const PRESET_OPTIONS = [
    {
        id: "high",
        label: "High fidelity",
        description: "Subtle downsizing for gentle savings when visual quality matters most.",
        targetRatio: 0.85,
        maxDimension: 2200,
        jpegQuality: 0.85,
    },
    {
        id: "balanced",
        label: "Balanced",
        description: "Blend of size reduction and clarity tuned for general office PDFs.",
        targetRatio: 0.7,
        maxDimension: 1800,
        jpegQuality: 0.75,
    },
    {
        id: "smallest",
        label: "Smallest",
        description: "Aggressive downscale for email-friendly handoffs; expect stronger smoothing.",
        targetRatio: 0.55,
        maxDimension: 1400,
        jpegQuality: 0.65,
    },
];
const PRESET_LOOKUP = PRESET_OPTIONS.reduce((map, option) => ({
    ...map,
    [option.id]: option,
}), {});
const clampBytes = (value) => {
    if (!Number.isFinite(value) || value <= 0) {
        return 1024;
    }
    return Math.max(512, Math.round(value));
};
export const computeScaledDimensions = (sourceWidth, sourceHeight, maxDimension) => {
    const maxSource = Math.max(sourceWidth, sourceHeight);
    if (maxSource <= maxDimension) {
        return { width: sourceWidth, height: sourceHeight, scale: 1 };
    }
    const scale = maxDimension / maxSource;
    return {
        width: Math.round(sourceWidth * scale),
        height: Math.round(sourceHeight * scale),
        scale,
    };
};
const canvasToJpegBytes = (canvas, quality) => new Promise((resolve, reject) => {
    if (canvas.toBlob) {
        canvas.toBlob(async (blob) => {
            if (blob) {
                const buffer = await blob.arrayBuffer();
                resolve(new Uint8Array(buffer));
            }
            else {
                reject(new Error("Canvas toBlob returned null."));
            }
        }, "image/jpeg", quality);
    }
    else {
        try {
            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            const base64 = dataUrl.split(",")[1];
            if (!base64) {
                reject(new Error("Failed to encode canvas as JPEG."));
                return;
            }
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            resolve(bytes);
        }
        catch (error) {
            reject(error);
        }
    }
});
const renderPageToCompressedImage = async (pdf, pageNumber, preset) => {
    const page = await pdf.doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const scaled = computeScaledDimensions(viewport.width, viewport.height, preset.maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = scaled.width;
    canvas.height = scaled.height;
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas 2D context unavailable.");
    }
    const renderViewport = page.getViewport({ scale: scaled.scale });
    await page.render({ canvas, canvasContext: context, viewport: renderViewport }).promise;
    const jpegBytes = await canvasToJpegBytes(canvas, preset.jpegQuality);
    page.cleanup();
    return { jpegBytes, width: scaled.width, height: scaled.height };
};
const buildCompressedPdf = async (pdf, preset) => {
    const warnings = [];
    const output = await PDFDocument.create();
    for (let pageNum = 1; pageNum <= pdf.pageCount; pageNum++) {
        try {
            const compressed = await renderPageToCompressedImage(pdf, pageNum, preset);
            const jpegImage = await output.embedJpg(compressed.jpegBytes);
            const page = output.addPage([compressed.width, compressed.height]);
            page.drawImage(jpegImage, {
                x: 0,
                y: 0,
                width: compressed.width,
                height: compressed.height,
            });
        }
        catch (pageError) {
            console.warn(`Failed to compress page ${pageNum}`, pageError);
            warnings.push(`Page ${pageNum} could not be compressed and was skipped.`);
        }
    }
    if (output.getPageCount() === 0) {
        throw new Error("No pages were successfully compressed.");
    }
    const pdfBytes = await output.save();
    return { pdfBytes, warnings };
};
const formatBytes = (size) => {
    if (!Number.isFinite(size) || size <= 0) {
        return "0 B";
    }
    const units = ["B", "KB", "MB", "GB", "TB"];
    const power = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / 1024 ** power;
    return `${power === 0 ? Math.round(value) : value.toFixed(1)} ${units[power]}`;
};
export const COMPRESSION_PRESETS = PRESET_OPTIONS;
export const getCompressionPreset = (presetId) => {
    return PRESET_LOOKUP[presetId] ?? PRESET_LOOKUP.balanced;
};
export const estimateCompressedSize = (originalSize, presetId) => {
    const preset = getCompressionPreset(presetId);
    return clampBytes(originalSize * preset.targetRatio);
};
export const compressPdfWithPreset = async (pdf, presetId, options) => {
    const preset = getCompressionPreset(presetId);
    const startedAt = options?.startedAt ?? Date.now();
    const originalSize = pdf.size;
    const { pdfBytes, warnings } = await buildCompressedPdf(pdf, preset);
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
    const compressedSize = blob.size;
    const savings = Math.max(0, originalSize - compressedSize);
    const savingsPercent = originalSize > 0 ? (savings / originalSize) * 100 : 0;
    const downloadName = buildDownloadName(pdf.name, `compress-${preset.id}`);
    const savingsNote = savings > 0
        ? `${formatBytes(savings)} saved (${Math.round(savingsPercent)}% reduction)`
        : "No size reduction achieved";
    return {
        blob,
        size: compressedSize,
        downloadName,
        durationMs: Math.max(0, Date.now() - startedAt),
        warnings: warnings.length > 0 ? warnings : undefined,
        originalSize,
        compressedSize,
        savings,
        savingsPercent,
        activity: {
            tool: "compression",
            operation: `compress-${preset.id}`,
            sourceCount: 1,
            detail: `${pdf.name} · ${preset.label} preset · ${savingsNote}`,
        },
    };
};
