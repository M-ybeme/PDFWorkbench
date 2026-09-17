import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderThumbnails } from "./pdfThumbnails";
import type { LoadedPdf } from "./pdfLoader";

const createFakePage = (renderPromise: Promise<void> = Promise.resolve()) => {
  return {
    getViewport: vi.fn((options: { scale: number }) => ({
      width: 100 * options.scale,
      height: 200 * options.scale,
    })),
    render: vi.fn(() => ({ promise: renderPromise })),
    cleanup: vi.fn(),
  };
};

type FakePage = ReturnType<typeof createFakePage>;

const createFakePdf = (pages: FakePage[]): LoadedPdf =>
  ({
    id: "pdf-1",
    pageCount: pages.length,
    doc: {
      getPage: vi.fn((pageNumber: number) => Promise.resolve(pages[pageNumber - 1])),
    },
  }) as unknown as LoadedPdf;

const collect = async <T>(iterable: AsyncGenerator<T>): Promise<T[]> => {
  const results: T[] = [];
  for await (const item of iterable) {
    results.push(item);
  }
  return results;
};

const createFakeCanvas = () => {
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({}) as unknown),
    toDataURL: vi.fn(),
  };
  canvas.toDataURL.mockImplementation(() => `data:image/png;fake-${canvas.width}x${canvas.height}`);
  return canvas;
};

describe("renderThumbnails", () => {
  beforeEach(() => {
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag !== "canvas") {
        return originalCreateElement(tag);
      }
      return createFakeCanvas() as unknown as HTMLCanvasElement;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders pages in order, one thumbnail per page, at the requested scale", async () => {
    const pageOne = createFakePage();
    const pageTwo = createFakePage();
    const pdf = createFakePdf([pageOne, pageTwo]);

    const thumbnails = await collect(renderThumbnails(pdf, { scale: 0.25 }));

    expect(thumbnails).toEqual([
      { pageNumber: 1, dataUrl: "data:image/png;fake-25x50" },
      { pageNumber: 2, dataUrl: "data:image/png;fake-25x50" },
    ]);
    expect(pageOne.getViewport).toHaveBeenCalledWith({ scale: 0.25 });
    expect(pageTwo.getViewport).toHaveBeenCalledWith({ scale: 0.25 });
    expect(pdf.doc.getPage).toHaveBeenNthCalledWith(1, 1);
    expect(pdf.doc.getPage).toHaveBeenNthCalledWith(2, 2);
  });

  it("cleans up the page's temporary render resources after a successful render", async () => {
    const page = createFakePage();
    const pdf = createFakePdf([page]);

    await collect(renderThumbnails(pdf, { scale: 0.2 }));

    expect(page.cleanup).toHaveBeenCalledTimes(1);
  });

  it("still cleans up the page and propagates the error when a render fails", async () => {
    const failingRender = Promise.reject(new Error("pdf.js render failure"));
    const page = createFakePage(failingRender);
    const pdf = createFakePdf([page]);

    const iterator = renderThumbnails(pdf, { scale: 0.2 });
    await expect(iterator.next()).rejects.toThrow("pdf.js render failure");
    expect(page.cleanup).toHaveBeenCalledTimes(1);
  });

  it("stops without yielding or throwing once the signal is already aborted", async () => {
    const page = createFakePage();
    const pdf = createFakePdf([page]);
    const controller = new AbortController();
    controller.abort();

    const thumbnails = await collect(
      renderThumbnails(pdf, { scale: 0.2, signal: controller.signal }),
    );

    expect(thumbnails).toEqual([]);
    expect(pdf.doc.getPage).toHaveBeenCalledTimes(0);
  });

  it("stops after the in-flight page finishes rendering if aborted mid-render", async () => {
    const pageOne = createFakePage();
    const pageTwo = createFakePage();
    const pdf = createFakePdf([pageOne, pageTwo]);
    const controller = new AbortController();

    const iterator = renderThumbnails(pdf, { scale: 0.2, signal: controller.signal });
    controller.abort();
    const result = await iterator.next();

    expect(result.done).toBe(true);
    expect(pageTwo.getViewport).toHaveBeenCalledTimes(0);
  });
});
