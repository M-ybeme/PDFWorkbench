import { useCallback, useEffect, useRef, useState } from "react";
const dragContainsFiles = (event) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
export function useDragDrop({ accept, multiple = false, onFiles }) {
    const [isDragActive, setDragActive] = useState(false);
    const inputRef = useRef(null);
    const handleDrop = useCallback((event) => {
        if (!dragContainsFiles(event)) {
            return;
        }
        event.preventDefault();
        setDragActive(false);
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            onFiles(files);
        }
    }, [onFiles]);
    const handleDragOver = useCallback((event) => {
        if (!dragContainsFiles(event)) {
            return;
        }
        event.preventDefault();
        setDragActive(true);
    }, []);
    const handleDragLeave = useCallback((event) => {
        if (!dragContainsFiles(event)) {
            return;
        }
        event.preventDefault();
        setDragActive(false);
    }, []);
    const handleInputChange = useCallback((event) => {
        const { files } = event.target;
        if (files && files.length > 0) {
            onFiles(files);
        }
        event.target.value = "";
    }, [onFiles]);
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
            type: "file",
            accept,
            multiple,
            className: "sr-only",
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
