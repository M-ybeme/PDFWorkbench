import { create } from "zustand";

import { configurePdfWorker } from "../lib/pdfWorker";
import { loadPdfFromSource, type LoadPdfOptions, type LoadedPdf } from "../lib/pdfLoader";
import { getFriendlyPdfError } from "../lib/pdfErrors";
import { createPdfSourceFromFile, type PdfSource } from "../lib/documentPipeline";

export type PdfAsset = {
  id: string;
  fileName: string;
  source: PdfSource;
  loaded: LoadedPdf;
  addedAt: number;
};

type PdfAssetState = {
  assets: PdfAsset[];
  isBusy: boolean;
  error: string | null;
  addAsset: (file: File, options?: LoadPdfOptions) => Promise<void>;
  removeAsset: (id: string) => void;
  reorderAssets: (fromIndex: number, toIndex: number) => void;
  clearError: () => void;
  reset: () => void;
};

const isPdf = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const reorder = <T>(list: T[], fromIndex: number, toIndex: number): T[] => {
  const result = [...list];
  const [removed] = result.splice(fromIndex, 1);

  if (typeof removed === "undefined") {
    return list;
  }

  result.splice(toIndex, 0, removed);
  return result;
};

const destroyAssetDoc = (asset: PdfAsset) => {
  try {
    asset.loaded.doc.destroy();
  } catch (cleanupError) {
    console.warn("Failed to release PDF document", cleanupError);
  }
};

export const usePdfAssets = create<PdfAssetState>((set, get) => ({
  assets: [],
  isBusy: false,
  error: null,
  addAsset: async (file: File, options?: LoadPdfOptions) => {
    try {
      if (!isPdf(file)) {
        set({ error: "Please choose valid PDF files.", isBusy: false });
        return;
      }

      configurePdfWorker();
      set({ isBusy: true, error: null });
      const source = await createPdfSourceFromFile(file, "upload");
      const loaded = await loadPdfFromSource(source, options);
      set((state) => ({
        assets: [
          ...state.assets,
          {
            id: loaded.id,
            fileName: source.name,
            source,
            loaded,
            addedAt: Date.now(),
          },
        ],
        isBusy: false,
      }));
    } catch (error) {
      console.error("Failed to add PDF asset", error);
      set({ isBusy: false, error: getFriendlyPdfError(error) });
    }
  },
  removeAsset: (id) =>
    set((state) => {
      const asset = state.assets.find((entry) => entry.id === id);
      if (asset) {
        destroyAssetDoc(asset);
      }

      return {
        assets: state.assets.filter((entry) => entry.id !== id),
      };
    }),
  reorderAssets: (fromIndex, toIndex) =>
    set((state) => {
      if (fromIndex === toIndex) {
        return state;
      }

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.assets.length ||
        toIndex >= state.assets.length
      ) {
        return state;
      }

      return {
        assets: reorder(state.assets, fromIndex, toIndex),
      };
    }),
  clearError: () => set({ error: null }),
  reset: () => {
    const { assets } = get();
    assets.forEach(destroyAssetDoc);
    set({ assets: [], isBusy: false, error: null });
  },
}));
