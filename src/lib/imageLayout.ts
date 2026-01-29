export type FitMode = "fit" | "fill" | "center";

export type PageDimensions = {
  width: number;
  height: number;
  margin: number;
};

export type ImagePlacement = {
  width: number;
  height: number;
  x: number;
  y: number;
};

const clampMargin = (value: number, max: number) => Math.max(0, Math.min(value, max));

const computeScale = (
  imageWidth: number,
  imageHeight: number,
  contentWidth: number,
  contentHeight: number,
  mode: FitMode,
) => {
  if (mode === "fill") {
    return Math.max(contentWidth / imageWidth, contentHeight / imageHeight);
  }

  if (mode === "center") {
    const maxScale = Math.min(contentWidth / imageWidth, contentHeight / imageHeight);
    return Math.min(1, maxScale);
  }

  return Math.min(contentWidth / imageWidth, contentHeight / imageHeight);
};

export const computeImagePlacement = (
  imageWidth: number,
  imageHeight: number,
  page: PageDimensions,
  mode: FitMode,
): ImagePlacement => {
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
