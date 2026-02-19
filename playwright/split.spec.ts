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

test.describe("Split E2E", () => {
  test("extracts a page selection and downloads as a single PDF", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "split-selection.pdf");
    await createSamplePdf(samplePath, 4);

    page.on("console", (msg) => console.log("[split-page]", msg.text()));

    await page.goto("/split");

    const uploader = page.locator("#split-upload");
    await uploader.waitFor({ state: "attached" });
    await uploader.setInputFiles(samplePath);

    // Wait for the PDF to load and show page count
    await expect(page.getByText(/4 pages/i)).toBeVisible({ timeout: 10_000 });

    // Select all pages then download
    await page.getByRole("button", { name: /Select all/i }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download selection/i }).click();
    const download = await downloadPromise;

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    if (!downloadPath) throw new Error("Download path missing");

    // Output should be a valid PDF with all 4 pages
    const bytes = await readFile(downloadPath);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(4);

    await expect(page.getByText(/Downloaded 4 page\(s\)/i)).toBeVisible();
  });

  test("splits into N-page slices and downloads as a ZIP bundle", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "split-preset.pdf");
    await createSamplePdf(samplePath, 4);

    await page.goto("/split");

    const uploader = page.locator("#split-upload");
    await uploader.waitFor({ state: "attached" });
    await uploader.setInputFiles(samplePath);

    await expect(page.getByText(/4 pages/i)).toBeVisible({ timeout: 10_000 });

    // Set the split interval to 2 → 4 pages / 2 = 2 slices
    const intervalInput = page.locator("#page-interval-input");
    await intervalInput.fill("2");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Create 2-page slices/i }).click();
    const download = await downloadPromise;

    // Result should be a ZIP archive
    expect(download.suggestedFilename()).toMatch(/\.zip$/i);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    await expect(
      page.getByText(/Exported 2 slice\(s\) with 2-page preset/i),
    ).toBeVisible();
  });

  test("can select only odd pages before downloading", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "split-odd.pdf");
    await createSamplePdf(samplePath, 4);

    await page.goto("/split");

    const uploader = page.locator("#split-upload");
    await uploader.waitFor({ state: "attached" });
    await uploader.setInputFiles(samplePath);

    await expect(page.getByText(/4 pages/i)).toBeVisible({ timeout: 10_000 });

    // Select only odd pages (pages 1 and 3)
    await page.getByRole("button", { name: /Odd pages/i }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download selection/i }).click();
    const download = await downloadPromise;

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    if (!downloadPath) throw new Error("Download path missing");

    // Pages 1 and 3 → 2-page output
    const bytes = await readFile(downloadPath);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);

    await expect(page.getByText(/Downloaded 2 page\(s\)/i)).toBeVisible();
  });
});
