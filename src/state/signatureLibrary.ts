import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SignatureKind = "drawn" | "typed" | "upload";

export type SignatureEntry = {
  id: string;
  label: string;
  kind: SignatureKind;
  dataUrl: string;
  width: number;
  height: number;
  createdAt: number;
  lastUsedAt: number | null;
};

type SignatureLibraryState = {
  signatures: SignatureEntry[];
  addSignature: (input: {
    label?: string;
    kind: SignatureKind;
    dataUrl: string;
    width: number;
    height: number;
  }) => SignatureEntry;
  renameSignature: (id: string, label: string) => void;
  deleteSignature: (id: string) => void;
  markUsed: (id: string) => void;
  reset: () => void;
};

const MAX_SIGNATURES = 10;

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `signature-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeLabel = (label?: string) => {
  const trimmed = label?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }

  return "Signature";
};

export const useSignatureLibrary = create<SignatureLibraryState>()(
  persist(
    (set) => ({
      signatures: [],
      addSignature: (input) => {
        const now = Date.now();
        const entry: SignatureEntry = {
          id: createId(),
          label: normalizeLabel(input.label),
          kind: input.kind,
          dataUrl: input.dataUrl,
          width: input.width,
          height: input.height,
          createdAt: now,
          lastUsedAt: now,
        };

        set((state) => {
          const next = [entry, ...state.signatures];
          if (next.length > MAX_SIGNATURES) {
            next.length = MAX_SIGNATURES;
          }
          return { signatures: next };
        });

        return entry;
      },
      renameSignature: (id, label) =>
        set((state) => ({
          signatures: state.signatures.map((signature) =>
            signature.id === id ? { ...signature, label: normalizeLabel(label) } : signature,
          ),
        })),
      deleteSignature: (id) =>
        set((state) => ({
          signatures: state.signatures.filter((signature) => signature.id !== id),
        })),
      markUsed: (id) =>
        set((state) => ({
          signatures: state.signatures.map((signature) =>
            signature.id === id ? { ...signature, lastUsedAt: Date.now() } : signature,
          ),
        })),
      reset: () => set({ signatures: [] }),
    }),
    {
      name: "pdf-workbench-signatures",
      partialize: (state) => ({ signatures: state.signatures }),
      merge: (persistedState, currentState) => {
        const typed = (persistedState as Partial<SignatureLibraryState>) ?? {};
        const entries = typed.signatures ?? [];
        if (entries.length === 0) {
          return currentState;
        }

        const seen = new Set(currentState.signatures.map((entry) => entry.id));
        const merged = [
          ...currentState.signatures,
          ...entries.filter((entry) => !seen.has(entry.id)),
        ].slice(0, MAX_SIGNATURES);
        return { ...currentState, ...typed, signatures: merged };
      },
    },
  ),
);
