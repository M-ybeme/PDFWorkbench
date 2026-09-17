import { describe, expect, it } from "vitest";

import { cloneBytesToArrayBuffer } from "./bytes";

describe("cloneBytesToArrayBuffer", () => {
  it("preserves exact byte contents", () => {
    const source = new Uint8Array([1, 2, 3, 4, 5]);
    const buffer = cloneBytesToArrayBuffer(source);
    expect(Array.from(new Uint8Array(buffer))).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns a buffer with the same length as the input", () => {
    const source = new Uint8Array(10);
    const buffer = cloneBytesToArrayBuffer(source);
    expect(buffer.byteLength).toBe(10);
  });

  it("does not alias the source buffer", () => {
    const source = new Uint8Array([9, 9, 9]);
    const buffer = cloneBytesToArrayBuffer(source);
    source[0] = 0;
    expect(new Uint8Array(buffer)[0]).toBe(9);
  });

  it("clones a view into a larger backing buffer without leaking sibling bytes", () => {
    const backing = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const view = backing.subarray(2, 4);
    const buffer = cloneBytesToArrayBuffer(view);
    expect(buffer.byteLength).toBe(2);
    expect(Array.from(new Uint8Array(buffer))).toEqual([3, 4]);
  });
});
