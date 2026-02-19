import { create } from "zustand";
import { persist } from "zustand/middleware";
const EMPTY = {
  fileKey: "",
  placements: [],
  textPlacements: [],
  strokes: [],
};
export const buildFileKey = (name, size) => `${name}::${size}`;
export const useSignatureSession = create()(
  persist(
    (set) => ({
      ...EMPTY,
      save: (data) => set(data),
      clear: () => set(EMPTY),
    }),
    {
      name: "pdf-workbench-sig-session",
      partialize: (state) => ({
        fileKey: state.fileKey,
        placements: state.placements,
        textPlacements: state.textPlacements,
        strokes: state.strokes,
      }),
    },
  ),
);
