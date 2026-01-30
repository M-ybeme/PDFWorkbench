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
const formatBytes = (size) => {
    if (!Number.isFinite(size) || size <= 0) {
        return "0 B";
    }
    const units = ["B", "KB", "MB", "GB", "TB"];
    const power = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / 1024 ** power;
    return `${power === 0 ? Math.round(value) : value.toFixed(1)} ${units[power]}`;
};
const resolveActivityCategory = (result) => {
    switch (result.activity.tool) {
        case "merge":
            return "merge";
        case "split":
            return result.activity.operation.includes("preset") ? "split-preset" : "split-selection";
        case "editor":
            return "page-edit";
        case "images":
            return "images-to-pdf";
        case "compression":
            return "compression";
        case "signatures":
            return "signatures";
        case "viewer":
        default:
            return "viewer";
    }
};
const buildLabel = (result) => {
    const pluralize = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;
    switch (result.activity.tool) {
        case "merge":
            return `Merged ${pluralize(result.activity.sourceCount, "file")}`;
        case "split":
            return result.activity.operation.includes("preset")
                ? "Split PDF into preset bundles"
                : `Split ${pluralize(result.activity.sourceCount, "PDF")}`;
        case "editor":
            return `Edited ${pluralize(result.activity.sourceCount, "PDF")}`;
        case "images":
            return `Created PDF from ${pluralize(result.activity.sourceCount, "image")}`;
        case "compression": {
            const preset = result.activity.operation.replace(/^compress-/, "").replace(/-/g, " ");
            return `Compressed PDF (${preset || "balanced"})`;
        }
        case "signatures":
            return `Stamped signature on ${pluralize(result.activity.sourceCount, "PDF")}`;
        case "viewer":
            return "Downloaded from viewer";
        default:
            return result.activity.operation.replace(/-/g, " ");
    }
};
const buildDetail = (result) => {
    const parts = result.activity.detail
        ? [result.activity.detail]
        : [result.downloadName, formatBytes(result.size)];
    if (result.warnings?.length) {
        parts.push(result.warnings.join(" | "));
    }
    return parts.filter(Boolean).join(" · ");
};
export const logExportResult = (result) => {
    const addEntry = useActivityLog.getState().addEntry;
    addEntry({
        type: resolveActivityCategory(result),
        label: buildLabel(result),
        detail: buildDetail(result),
    });
};
