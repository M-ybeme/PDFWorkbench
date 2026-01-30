import { expect, test } from "@playwright/test";
import { PDFDocument, rgb } from "pdf-lib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const createSamplePdf = async (filePath: string, pageCount = 2) => {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });

  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([612, 792]);
    // Add some content to make compression meaningful
    page.drawRectangle({
      x: 50,
      y: 50,
      width: 512,
      height: 692,
      color: rgb(0.9, 0.9, 0.95),
    });
    page.drawText(`Page ${i + 1}`, {
      x: 250,
      y: 400,
      size: 24,
    });
  }

  const bytes = await doc.save();
  await writeFile(filePath, bytes);
  return bytes.length;
};

test.describe("Compression E2E", () => {
  test("compresses a PDF with the Balanced preset", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "sample-compress.pdf");
    const originalSize = await createSamplePdf(samplePath, 2);

    page.on("console", (message) => console.log("[compression-page]", message.text()));

    await page.goto("/compression");

    // Wait for the page to be ready
    await expect(page.getByText(/Compress image-heavy PDFs/i)).toBeVisible();

    // Upload the PDF
    const uploader = page.locator("#compression-upload");
    await uploader.waitFor({ state: "attached" });
    await uploader.setInputFiles(samplePath);

    // Wait for PDF to load
    await expect(page.getByText(/Ready for compression/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/2 pages/i)).toBeVisible();

    // Verify preset buttons are visible
    await expect(page.getByRole("button", { name: /High fidelity/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Balanced/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Smallest/i })).toBeVisible();

    // Select the Balanced preset (should be default, but click to be sure)
    await page.getByRole("button", { name: /Balanced/i }).click();

    // Start compression and wait for download
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Compress & Download/i }).click();

    // Wait for the button to show "Compressing..."
    await expect(page.getByRole("button", { name: /Compressing/i })).toBeVisible();

    const download = await downloadPromise;
    const downloadPath = await download.path();

    expect(downloadPath).toBeTruthy();
    if (!downloadPath) {
      throw new Error("Download path not available");
    }

    // Verify the downloaded file is a valid PDF
    const fileBytes = await readFile(downloadPath);
    const parsed = await PDFDocument.load(fileBytes);

    // Should have same page count
    expect(parsed.getPageCount()).toBe(2);

    // Verify success message appears
    await expect(page.getByText(/Saved as/i)).toBeVisible();

    // The compressed file should exist (may or may not be smaller for simple PDFs)
    expect(fileBytes.length).toBeGreaterThan(0);
    console.log(`Original: ${originalSize} bytes, Compressed: ${fileBytes.length} bytes`);
  });

  test("shows guardrail warnings for large PDFs", async ({ page }, testInfo) => {
    // Create a PDF with many pages to trigger the warning
    const samplePath = path.join(testInfo.outputDir, "large-page-count.pdf");
    await createSamplePdf(samplePath, 250);

    await page.goto("/compression");

    const uploader = page.locator("#compression-upload");
    await uploader.waitFor({ state: "attached" });
    await uploader.setInputFiles(samplePath);

    await expect(page.getByText(/Ready for compression/i)).toBeVisible({ timeout: 15000 });

    // Should show the large page count warning
    await expect(page.getByText(/Large page counts/i)).toBeVisible();
  });
});
