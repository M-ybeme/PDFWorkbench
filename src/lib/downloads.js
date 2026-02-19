export const triggerBlobDownload = (blob, fileName) => {
    if (typeof document === "undefined") {
        throw new Error("Downloads are not supported in this environment.");
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};
