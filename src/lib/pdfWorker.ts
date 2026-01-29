import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?worker&url";

let isConfigured = false;

export const configurePdfWorker = () => {
  if (isConfigured || typeof window === "undefined") {
    return;
  }

  GlobalWorkerOptions.workerSrc = pdfWorker;
  isConfigured = true;
};
