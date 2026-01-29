import { beforeEach, describe, expect, it } from "vitest";

import { useActivityLog } from "./activityLog";

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
});
