import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { DrawnStroke, SignaturePlacement, TextPlacement } from "../lib/signaturePlacement";

type SessionData = {
  fileKey: string;
  placements: SignaturePlacement[];
  textPlacements: TextPlacement[];
  strokes: DrawnStroke[];
};

type SignatureSessionState = SessionData & {
  save: (data: SessionData) => void;
  clear: () => void;
};

const EMPTY: SessionData = {
  fileKey: "",
  placements: [],
  textPlacements: [],
  strokes: [],
};

export const buildFileKey = (name: string, size: number) => `${name}::${size}`;

export const useSignatureSession = create<SignatureSessionState>()(
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
