import { create } from "zustand";
import { persist } from "zustand/middleware";
const createId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
export const useActivityLog = create()(persist((set) => ({
    entries: [],
    addEntry: (payload) => set((state) => {
        const entry = {
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
}), {
    name: "pdf-workbench-activity",
    partialize: (state) => ({ entries: state.entries }),
    merge: (persistedState, currentState) => {
        const typed = persistedState ?? {};
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
}));
