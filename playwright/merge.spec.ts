import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const createSamplePdf = async (filePath: string, pageCount: number) => {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });

  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Page ${i + 1}`, { x: 250, y: 400, size: 24 });
  }

  const bytes = await doc.save();
  await writeFile(filePath, bytes);
};

test.describe("Merge E2E", () => {
  test("merges two PDFs and downloads the combined file", async ({ page }, testInfo) => {
    const pathA = path.join(testInfo.outputDir, "merge-a.pdf");
    const pathB = path.join(testInfo.outputDir, "merge-b.pdf");
    await createSamplePdf(pathA, 2);
    await createSamplePdf(pathB, 3);

    page.on("console", (msg) => console.log("[merge-page]", msg.text()));

    await page.goto("/merge");
    await expect(page.getByText(/Start stacking PDFs/i)).toBeVisible();

    // Upload both files
    const uploader = page.locator("#merge-upload");
    await uploader.waitFor({ state: "attached" });
    await uploader.setInputFiles([pathA, pathB]);

    // Both files should appear in the asset list with their page counts
    await expect(page.getByText(/2 pages/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/3 pages/i)).toBeVisible({ timeout: 10_000 });

    // Summary panel should reflect combined totals
    await expect(page.getByText(/Total files: 2/i)).toBeVisible();
    await expect(page.getByText(/Total pages: 5/i)).toBeVisible();

    // Trigger merge and capture download
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Merge & Download/i }).click();

    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    if (!downloadPath) throw new Error("Download path missing");

    // Merged PDF must have 2 + 3 = 5 pages
    const bytes = await readFile(downloadPath);
    const merged = await PDFDocument.load(bytes);
    expect(merged.getPageCount()).toBe(5);

    // Success alert should confirm the download
    await expect(page.getByText(/Merged stack downloaded as/i)).toBeVisible();
  });

  test("reorders PDFs before merging", async ({ page }, testInfo) => {
    const pathA = path.join(testInfo.outputDir, "reorder-a.pdf");
    const pathB = path.join(testInfo.outputDir, "reorder-b.pdf");
    await createSamplePdf(pathA, 1);
    await createSamplePdf(pathB, 1);

    await page.goto("/merge");

    const uploader = page.locator("#merge-upload");
    await uploader.waitFor({ state: "attached" });
    await uploader.setInputFiles([pathA, pathB]);

    await expect(page.getByText(/Total files: 2/i)).toBeVisible({ timeout: 10_000 });

    // Move the second file up (making it first in the stack)
    const moveUpButtons = page.getByRole("button", { name: /Move up/i });
    await moveUpButtons.last().click();

    // Both files still present — the list should still show 2 items
    await expect(page.getByText(/Total files: 2/i)).toBeVisible();

    // Merge still succeeds after reorder
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Merge & Download/i }).click();
    const download = await downloadPromise;

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    if (!downloadPath) throw new Error("Download path missing");

    const bytes = await readFile(downloadPath);
    const merged = await PDFDocument.load(bytes);
    expect(merged.getPageCount()).toBe(2);

    await expect(page.getByText(/Merged stack downloaded as/i)).toBeVisible();
  });
});
