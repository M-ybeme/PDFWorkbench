import { describe, expect, it } from "vitest";

import { timestampToken } from "./fileNames";

describe("timestampToken", () => {
  it("produces a filename-safe token with no colons or periods", () => {
    const token = timestampToken();
    expect(/[:.]/.test(token)).toBe(false);
  });

  it("preserves the ISO-derived token shape", () => {
    const token = timestampToken();
    expect(token).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
  });
});
