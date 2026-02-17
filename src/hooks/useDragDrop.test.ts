import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDragDrop } from "./useDragDrop";

const makeFileList = (files: File[]): FileList => {
  const list = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: () => files[Symbol.iterator](),
  } as unknown as FileList;
  files.forEach((f, i) => {
    Object.defineProperty(list, i, { value: f });
  });
  return list;
};

const makeDragEvent = (type: string, files?: FileList): React.DragEvent<HTMLElement> =>
  ({
    preventDefault: vi.fn(),
    dataTransfer: {
      types: ["Files"],
      files: files ?? makeFileList([]),
    },
  }) as unknown as React.DragEvent<HTMLElement>;

describe("useDragDrop", () => {
  it("starts with isDragActive false", () => {
    const { result } = renderHook(() =>
      useDragDrop({ accept: "application/pdf", onFiles: vi.fn() }),
    );
    expect(result.current.isDragActive).toBe(false);
  });

  it("sets isDragActive true on dragOver", () => {
    const { result } = renderHook(() =>
      useDragDrop({ accept: "application/pdf", onFiles: vi.fn() }),
    );

    act(() => {
      result.current.dropZoneProps.onDragOver(makeDragEvent("dragover"));
    });

    expect(result.current.isDragActive).toBe(true);
  });

  it("sets isDragActive false on dragLeave", () => {
    const { result } = renderHook(() =>
      useDragDrop({ accept: "application/pdf", onFiles: vi.fn() }),
    );

    act(() => {
      result.current.dropZoneProps.onDragOver(makeDragEvent("dragover"));
    });
    act(() => {
      result.current.dropZoneProps.onDragLeave(makeDragEvent("dragleave"));
    });

    expect(result.current.isDragActive).toBe(false);
  });

  it("calls onFiles when files are dropped", () => {
    const onFiles = vi.fn();
    const { result } = renderHook(() => useDragDrop({ accept: "application/pdf", onFiles }));

    const file = new File(["pdf"], "test.pdf", { type: "application/pdf" });
    const fileList = makeFileList([file]);

    act(() => {
      result.current.dropZoneProps.onDrop(makeDragEvent("drop", fileList));
    });

    expect(result.current.isDragActive).toBe(false);
    expect(onFiles).toHaveBeenCalledWith(fileList);
  });

  it("ignores drag events that do not contain files", () => {
    const onFiles = vi.fn();
    const { result } = renderHook(() => useDragDrop({ accept: "application/pdf", onFiles }));

    const noFileEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { types: ["text/plain"], files: makeFileList([]) },
    } as unknown as React.DragEvent<HTMLElement>;

    act(() => {
      result.current.dropZoneProps.onDragOver(noFileEvent);
    });

    expect(result.current.isDragActive).toBe(false);
    expect(noFileEvent.preventDefault).toHaveBeenCalledTimes(0);
  });

  it("provides input props with correct accept and multiple", () => {
    const { result } = renderHook(() =>
      useDragDrop({ accept: "image/*", multiple: true, onFiles: vi.fn() }),
    );

    expect(result.current.inputProps.type).toBe("file");
    expect(result.current.inputProps.accept).toBe("image/*");
    expect(result.current.inputProps.multiple).toBe(true);
    expect(result.current.inputProps.className).toBe("sr-only");
  });

  it("responds to pdfworkbench:open-file custom event", () => {
    const { result } = renderHook(() =>
      useDragDrop({ accept: "application/pdf", onFiles: vi.fn() }),
    );

    const clickSpy = vi.fn();
    Object.defineProperty(result.current.inputRef, "current", {
      value: { click: clickSpy },
      writable: true,
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("pdfworkbench:open-file"));
    });

    expect(clickSpy).toHaveBeenCalled();
  });
});
