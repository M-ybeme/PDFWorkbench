import { Buffer } from "node:buffer";
import { describe, expect, test } from "vitest";

import { hasPngSignature, isPngBytesComplete } from "./pngIntegrity";

const decodeBase64 = (input: string) => Uint8Array.from(Buffer.from(input, "base64"));

const VALID_SAMPLE =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

const TRUNCATED_SAMPLE =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABcklEQVR4nO2aMW7DMAxFj4XBjoBF4ApqgAlYgJugEliAbqACTEHbAEGpM+2STb/HBKiITnH9t1Z2TnJykUURaX7+H4BTN0iuCKUhzjkM62S2gNGCfH8TyxoIDcABmCRLHcGEbQC7ANoJI92gSyBij0Ay6SS/GG4bL6AXyE2cS2M+YvgBzJBtB/jiEgtWdOH1PjBGHbzuSCZ8ktViXEl8m2dr0HnhSqV1AlyXfQnQw5I+Ol75saSFK5DyFWqCuYXwybKEu+XQ+yUKLj6AhsZ5kWQ8ZQouPkCmxnmROduUOEPOsix/MtDQrUirGSZLmBETUEWpGpOIRNwRQkal4hE3Ba6xaVUYgsN4Dhk9dUwdZboLO4pfDoQY6lckfoHjBjKVyR+6oBczh9Z17Kvt07Xtf0/Gtnd6X7dazIooU7OWog+d1m7h2iMpw4fSfHJwN/Mxe6RCbRQpAAAAAElFTkSuQmCC";

describe("isPngBytesComplete", () => {
  test("returns true for intact PNG data", () => {
    const bytes = decodeBase64(VALID_SAMPLE);
    expect(isPngBytesComplete(bytes)).toBe(true);
  });

  test("detects PNG signature even if data is truncated", () => {
    const bytes = decodeBase64(TRUNCATED_SAMPLE);
    expect(hasPngSignature(bytes)).toBe(true);
  });

  test("returns false when IEND chunk is missing", () => {
    const bytes = decodeBase64(TRUNCATED_SAMPLE);
    expect(isPngBytesComplete(bytes)).toBe(false);
  });

  test("returns false for short buffers", () => {
    expect(isPngBytesComplete(new Uint8Array([0, 1, 2]))).toBe(false);
    expect(hasPngSignature(new Uint8Array([0, 1, 2]))).toBe(false);
  });
});
