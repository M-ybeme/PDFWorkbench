import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/imagesToPdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/imagesToPdf")>();
  return {
    ...actual,
    createImageAsset: vi.fn(),
  };
});

import ImagesToPdfPage from "./ImagesToPdfPage";
import { createImageAsset, type ImageAsset } from "../lib/imagesToPdf";

const mockCreateImageAsset = vi.mocked(createImageAsset);

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const createFakeAsset = (overrides: Partial<ImageAsset> = {}): ImageAsset => ({
  id: overrides.name ?? "asset",
  name: "image.png",
  size: 100,
  type: "image/png",
  embedType: "image/png",
  dataUrl: "data:image/png;base64,",
  width: 10,
  height: 10,
  bytes: new Uint8Array(),
  ...overrides,
});

const createFile = (name: string) => new File(["fake"], name, { type: "image/png" });

const getUploadInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>("#images-upload")!;

const getImageListItems = (container: HTMLElement) =>
  container.querySelectorAll('[data-image-list="true"] li');

describe("ImagesToPdfPage ingestion", () => {
  beforeEach(() => {
    mockCreateImageAsset.mockReset();
  });

  it("drops a stale batch's results if Clear is clicked before it resolves", async () => {
    const seeded = createDeferred<ImageAsset>();
    mockCreateImageAsset.mockReturnValueOnce(seeded.promise);

    const { container, getByText } = render(<ImagesToPdfPage />);

    // First image lands, so "Clear list" becomes enabled.
    fireEvent.change(getUploadInput(container), { target: { files: [createFile("a.png")] } });
    await act(async () => {
      seeded.resolve(createFakeAsset({ id: "a", name: "a.png" }));
    });
    await waitFor(() => expect(getImageListItems(container)).toHaveLength(1));

    // A second batch starts decoding but never gets to finish before Clear.
    const staleBatch = createDeferred<ImageAsset>();
    mockCreateImageAsset.mockReturnValueOnce(staleBatch.promise);
    fireEvent.change(getUploadInput(container), { target: { files: [createFile("b.png")] } });

    fireEvent.click(getByText(/clear list/i));
    await waitFor(() => expect(getImageListItems(container)).toHaveLength(0));

    // The stale batch finishes after Clear — it must not resurrect anything.
    await act(async () => {
      staleBatch.resolve(createFakeAsset({ id: "b", name: "b.png" }));
    });
    expect(getImageListItems(container)).toHaveLength(0);
  });

  it("commits only the newer batch's results when a second selection supersedes an in-flight one", async () => {
    const batchA = createDeferred<ImageAsset>();
    const batchB = createDeferred<ImageAsset>();
    mockCreateImageAsset.mockReturnValueOnce(batchA.promise).mockReturnValueOnce(batchB.promise);

    const { container } = render(<ImagesToPdfPage />);

    fireEvent.change(getUploadInput(container), { target: { files: [createFile("a.png")] } });
    fireEvent.change(getUploadInput(container), { target: { files: [createFile("b.png")] } });

    // A resolves after B has already become the current batch.
    await act(async () => {
      batchA.resolve(createFakeAsset({ id: "a", name: "a.png" }));
    });
    expect(getImageListItems(container)).toHaveLength(0);

    await act(async () => {
      batchB.resolve(createFakeAsset({ id: "b", name: "b.png" }));
    });
    await waitFor(() => expect(getImageListItems(container)).toHaveLength(1));
    expect(container.textContent).toContain("b.png");
    expect(container.textContent?.includes("a.png")).toBe(false);
  });

  it("keeps the queue at MAX_IMAGES when two overlapping batches race for the last slot", async () => {
    // Seed 23 images via one resolved batch, then start two more single-file
    // batches while both are still in flight (true overlap): B supersedes A
    // the instant it starts, so only whichever is still current when it
    // resolves may commit — but it's still bound by the authoritative
    // capacity check, not a stale `images.length` closure.
    mockCreateImageAsset.mockImplementation(async (file: File) =>
      createFakeAsset({ id: file.name, name: file.name }),
    );
    const { container } = render(<ImagesToPdfPage />);
    const seedFiles = Array.from({ length: 23 }, (_, index) => createFile(`seed-${index}.png`));
    fireEvent.change(getUploadInput(container), { target: { files: seedFiles } });
    await waitFor(() => expect(getImageListItems(container)).toHaveLength(23));

    const batchA = createDeferred<ImageAsset>();
    const batchB = createDeferred<ImageAsset>();
    mockCreateImageAsset.mockReturnValueOnce(batchA.promise).mockReturnValueOnce(batchB.promise);

    fireEvent.change(getUploadInput(container), { target: { files: [createFile("a.png")] } });
    fireEvent.change(getUploadInput(container), { target: { files: [createFile("b.png")] } });

    // B is current when it resolves — it takes the one remaining slot.
    await act(async () => {
      batchB.resolve(createFakeAsset({ id: "b", name: "b.png" }));
    });
    await waitFor(() => expect(getImageListItems(container)).toHaveLength(24));

    // A resolves afterward, already superseded — it must not be committed
    // or push the queue past the cap.
    await act(async () => {
      batchA.resolve(createFakeAsset({ id: "a", name: "a.png" }));
    });
    expect(getImageListItems(container)).toHaveLength(24);
    expect(container.textContent).toContain("b.png");
    expect(container.textContent?.includes("a.png")).toBe(false);
  });

  it("truncates a single batch to the remaining capacity and warns, without exceeding MAX_IMAGES", async () => {
    mockCreateImageAsset.mockImplementation(async (file: File) =>
      createFakeAsset({ id: file.name, name: file.name }),
    );
    const { container, getByText } = render(<ImagesToPdfPage />);

    const seedFiles = Array.from({ length: 20 }, (_, index) => createFile(`seed-${index}.png`));
    fireEvent.change(getUploadInput(container), { target: { files: seedFiles } });
    await waitFor(() => expect(getImageListItems(container)).toHaveLength(20));

    const moreFiles = Array.from({ length: 10 }, (_, index) => createFile(`more-${index}.png`));
    fireEvent.change(getUploadInput(container), { target: { files: moreFiles } });

    await waitFor(() => expect(getImageListItems(container)).toHaveLength(24));
    expect(getByText(/Limit 24 images per export\./i)).toBeInTheDocument();
  });

  it("loads a normal batch of images unchanged", async () => {
    mockCreateImageAsset.mockImplementation(async (file: File) =>
      createFakeAsset({ id: file.name, name: file.name }),
    );

    const { container, getByText } = render(<ImagesToPdfPage />);
    fireEvent.change(getUploadInput(container), {
      target: { files: [createFile("one.png"), createFile("two.png")] },
    });

    await waitFor(() => expect(getImageListItems(container)).toHaveLength(2));
    expect(getByText(/2 images ready\./i)).toBeInTheDocument();
  });
});
