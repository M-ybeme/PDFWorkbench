import { describe, expect, it, vi } from "vitest";

import { createLazyModule } from "./pdfLoaderModule";

describe("createLazyModule", () => {
  it("caches a successful import and never calls the importer again", async () => {
    const importer = vi.fn().mockResolvedValue({ marker: "ok" });
    const getModule = createLazyModule(importer);

    const first = await getModule();
    const second = await getModule();

    expect(first).toBe(second);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it("shares the same in-flight promise between concurrent callers", () => {
    const importer = vi.fn().mockReturnValue(new Promise(() => {}));
    const getModule = createLazyModule(importer);

    const first = getModule();
    const second = getModule();

    expect(first).toBe(second);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it("clears the cache on a failed import so the next call retries and can succeed", async () => {
    const importer = vi
      .fn()
      .mockRejectedValueOnce(new Error("chunk load failed"))
      .mockResolvedValueOnce({ marker: "recovered" });
    const getModule = createLazyModule(importer);

    await expect(getModule()).rejects.toThrow("chunk load failed");
    // The original error propagates normally, and the next attempt is a
    // genuinely fresh import rather than the same cached rejection.
    await expect(getModule()).resolves.toEqual({ marker: "recovered" });
    expect(importer).toHaveBeenCalledTimes(2);
  });
});
