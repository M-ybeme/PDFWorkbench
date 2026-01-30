import { create } from "zustand";
import { configurePdfWorker } from "../lib/pdfWorker";
import { loadPdfFromSource } from "../lib/pdfLoader";
import { getFriendlyPdfError } from "../lib/pdfErrors";
import { createPdfSourceFromFile } from "../lib/documentPipeline";
const isPdf = (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
const reorder = (list, fromIndex, toIndex) => {
    const result = [...list];
    const [removed] = result.splice(fromIndex, 1);
    if (typeof removed === "undefined") {
        return list;
    }
    result.splice(toIndex, 0, removed);
    return result;
};
const destroyAssetDoc = (asset) => {
    try {
        asset.loaded.doc.destroy();
    }
    catch (cleanupError) {
        console.warn("Failed to release PDF document", cleanupError);
    }
};
export const usePdfAssets = create((set, get) => ({
    assets: [],
    isBusy: false,
    error: null,
    addAsset: async (file, options) => {
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
        }
        catch (error) {
            console.error("Failed to add PDF asset", error);
            set({ isBusy: false, error: getFriendlyPdfError(error) });
        }
    },
    removeAsset: (id) => set((state) => {
        const asset = state.assets.find((entry) => entry.id === id);
        if (asset) {
            destroyAssetDoc(asset);
        }
        return {
            assets: state.assets.filter((entry) => entry.id !== id),
        };
    }),
    reorderAssets: (fromIndex, toIndex) => set((state) => {
        if (fromIndex === toIndex) {
            return state;
        }
        if (fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= state.assets.length ||
            toIndex >= state.assets.length) {
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
