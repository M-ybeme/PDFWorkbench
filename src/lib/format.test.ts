import { describe, expect, it } from "vitest";

import { formatBytes, formatTimestamp } from "./format";

describe("formatBytes", () => {
  it("returns '0 B' for zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("returns '0 B' for negative values", () => {
    expect(formatBytes(-100)).toBe("0 B");
  });

  it("returns '0 B' for NaN", () => {
    expect(formatBytes(NaN)).toBe("0 B");
  });

  it("returns '0 B' for Infinity", () => {
    expect(formatBytes(Infinity)).toBe("0 B");
  });

  it("formats bytes correctly", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes correctly", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });

  it("formats gigabytes correctly", () => {
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
  });

  it("formats terabytes correctly", () => {
    expect(formatBytes(1024 ** 4)).toBe("1.0 TB");
  });

  it("caps at TB for very large values", () => {
    expect(formatBytes(1024 ** 5)).toBe("1024.0 TB");
  });
});

describe("formatTimestamp", () => {
  it("returns em-dash for null", () => {
    expect(formatTimestamp(null)).toBe("\u2014");
  });

  it("returns em-dash for undefined", () => {
    expect(formatTimestamp(undefined)).toBe("\u2014");
  });

  it("returns em-dash for empty string", () => {
    expect(formatTimestamp("")).toBe("\u2014");
  });

  it("returns em-dash for invalid date string", () => {
    expect(formatTimestamp("not-a-date")).toBe("\u2014");
  });

  it("formats a numeric timestamp", () => {
    const result = formatTimestamp(1700000000000);
    expect(result !== "\u2014").toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats an ISO date string", () => {
    const result = formatTimestamp("2024-01-15T12:00:00Z");
    expect(result !== "\u2014").toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
