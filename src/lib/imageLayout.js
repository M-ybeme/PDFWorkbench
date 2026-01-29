const clampMargin = (value, max) => Math.max(0, Math.min(value, max));
const computeScale = (imageWidth, imageHeight, contentWidth, contentHeight, mode) => {
    if (mode === "fill") {
        return Math.max(contentWidth / imageWidth, contentHeight / imageHeight);
    }
    if (mode === "center") {
        const maxScale = Math.min(contentWidth / imageWidth, contentHeight / imageHeight);
        return Math.min(1, maxScale);
    }
    return Math.min(contentWidth / imageWidth, contentHeight / imageHeight);
};
export const computeImagePlacement = (imageWidth, imageHeight, page, mode) => {
    if (imageWidth <= 0 || imageHeight <= 0) {
        return { width: 0, height: 0, x: page.width / 2, y: page.height / 2 };
    }
    const margin = clampMargin(page.margin, Math.min(page.width, page.height) / 2);
    const contentWidth = page.width - margin * 2;
    const contentHeight = page.height - margin * 2;
    const scale = computeScale(imageWidth, imageHeight, contentWidth, contentHeight, mode);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    const x = (page.width - width) / 2;
    const y = (page.height - height) / 2;
    return { width, height, x, y };
};
