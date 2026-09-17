import { describe, expect, it } from "vitest";

import { isPdf } from "./documentPipeline";

const makeFile = (name: string, type: string) =>
  new File([new Uint8Array([1, 2, 3])], name, { type });

describe("isPdf", () => {
  it("accepts a file with the application/pdf MIME type", () => {
    expect(isPdf(makeFile("document.pdf", "application/pdf"))).toBe(true);
  });

  it("accepts a .pdf extension even with an unrecognized MIME type", () => {
    expect(isPdf(makeFile("document.pdf", ""))).toBe(true);
  });

  it("accepts a .PDF extension regardless of case", () => {
    expect(isPdf(makeFile("DOCUMENT.PDF", ""))).toBe(true);
  });

  it("rejects a non-PDF file", () => {
    expect(isPdf(makeFile("photo.png", "image/png"))).toBe(false);
  });

  it("rejects a file with neither a PDF MIME type nor extension", () => {
    expect(isPdf(makeFile("notes.txt", "text/plain"))).toBe(false);
  });
});
