import { beforeEach, describe, expect, it } from "vitest";

import { logExportResult, useActivityLog } from "./activityLog";
import { type ExportResult } from "../lib/documentPipeline";

describe("useActivityLog", () => {
  beforeEach(() => {
    useActivityLog.getState().reset();
    if (typeof window !== "undefined") {
      window.localStorage?.clear();
    }
  });

  it("records new entries with generated ids", () => {
    const addEntry = useActivityLog.getState().addEntry;
    addEntry({ type: "merge", label: "Merged 2 files" });
    const entries = useActivityLog.getState().entries;
    expect(entries).toHaveLength(1);
    const firstEntry = entries[0]!;
    expect(firstEntry).toMatchObject({ type: "merge", label: "Merged 2 files" });
    expect(typeof firstEntry.id).toBe("string");
  });

  it("trims to the newest 12 entries", () => {
    const addEntry = useActivityLog.getState().addEntry;
    for (let index = 0; index < 15; index += 1) {
      addEntry({ type: "split-selection", label: `Entry ${index}` });
    }

    const entries = useActivityLog.getState().entries;
    expect(entries).toHaveLength(12);
    const newest = entries[0]!;
    const oldest = entries[11]!;
    expect(newest.label).toBe("Entry 14");
    expect(oldest.label).toBe("Entry 3");
  });

  it("logs export results with derived labels and details", () => {
    const blob = new Blob(["demo-bytes"], { type: "application/pdf" });
    const result: ExportResult = {
      blob,
      size: blob.size,
      downloadName: "merged-demo.pdf",
      durationMs: 42,
      warnings: ["Large input"],
      activity: {
        tool: "merge",
        operation: "merge-2-files",
        sourceCount: 2,
      },
    };

    logExportResult(result);

    const entry = useActivityLog.getState().entries[0]!;
    expect(entry.type).toBe("merge");
    expect(entry.label).toBe("Merged 2 files");
    expect(entry.detail).toBe("merged-demo.pdf · 10 B · Large input");
  });

  it("prefers custom activity detail overrides and appends warnings", () => {
    const blob = new Blob(["img"], { type: "application/pdf" });
    const result: ExportResult = {
      blob,
      size: blob.size,
      downloadName: "images-export.pdf",
      durationMs: 10,
      warnings: ["Downscaled images"],
      activity: {
        tool: "images",
        operation: "images-to-pdf-3-pages",
        sourceCount: 3,
        detail: "Custom preset detail",
      },
    };

    logExportResult(result);

    const entry = useActivityLog.getState().entries[0]!;
    expect(entry.type).toBe("images-to-pdf");
    expect(entry.detail).toBe("Custom preset detail · Downscaled images");
  });
});
