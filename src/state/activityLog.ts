import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ActivityCategory = "merge" | "split-selection" | "split-preset";

export type ActivityEntry = {
  id: string;
  type: ActivityCategory;
  label: string;
  detail?: string;
  timestamp: number;
};

type ActivityPayload = {
  type: ActivityCategory;
  label: string;
  detail?: string;
  timestamp?: number;
};

type ActivityLogState = {
  entries: ActivityEntry[];
  addEntry: (payload: ActivityPayload) => void;
  clear: () => void;
  reset: () => void;
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const useActivityLog = create<ActivityLogState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (payload) =>
        set((state) => {
          const entry: ActivityEntry = {
            id: createId(),
            timestamp: payload.timestamp ?? Date.now(),
            type: payload.type,
            label: payload.label,
            detail: payload.detail,
          };

          const entries = [entry, ...state.entries].slice(0, 12);
          return { entries };
        }),
      clear: () => set({ entries: [] }),
      reset: () => set({ entries: [] }),
    }),
    {
      name: "pdf-workbench-activity",
      partialize: (state) => ({ entries: state.entries }),
      merge: (persistedState, currentState) => {
        const typed = (persistedState as Partial<ActivityLogState>) ?? {};
        const persistedEntries = typed.entries ?? [];

        if (currentState.entries.length === 0) {
          return { ...currentState, ...typed, entries: persistedEntries };
        }

        const seen = new Set(currentState.entries.map((entry) => entry.id));
        const merged = [
          ...currentState.entries,
          ...persistedEntries.filter((entry) => !seen.has(entry.id)),
        ].slice(0, 12);

        return { ...currentState, ...typed, entries: merged };
      },
    },
  ),
);
