import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

type UseDragDropOptions = {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: FileList) => void;
};

const dragContainsFiles = (event: DragEvent<HTMLElement>) =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

export function useDragDrop({ accept, multiple = false, onFiles }: UseDragDropOptions) {
  const [isDragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!dragContainsFiles(event)) {
        return;
      }
      event.preventDefault();
      setDragActive(false);
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        onFiles(files);
      }
    },
    [onFiles],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!dragContainsFiles(event)) {
      return;
    }
    event.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (!dragContainsFiles(event)) {
      return;
    }
    event.preventDefault();
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { files } = event.target;
      if (files && files.length > 0) {
        onFiles(files);
      }
      event.target.value = "";
    },
    [onFiles],
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  useEffect(() => {
    const handler = () => openFilePicker();
    window.addEventListener("pdfworkbench:open-file", handler);
    return () => window.removeEventListener("pdfworkbench:open-file", handler);
  }, [openFilePicker]);

  return {
    isDragActive,
    inputRef,
    inputProps: {
      ref: inputRef,
      type: "file" as const,
      accept,
      multiple,
      className: "sr-only" as const,
      onChange: handleInputChange,
    },
    dropZoneProps: {
      onDrop: handleDrop,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
    },
    openFilePicker,
  };
}
