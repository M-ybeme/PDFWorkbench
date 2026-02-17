import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const createSamplePdf = async (filePath: string, pageCount = 3) => {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });

  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Page ${i + 1}`, { x: 250, y: 400, size: 24 });
  }

  const bytes = await doc.save();
  await writeFile(filePath, bytes);
  return bytes.length;
};

test.describe("PDF to Images E2E", () => {
  test("exports a multi-page PDF as a ZIP of PNGs", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "sample-to-images.pdf");
    await createSamplePdf(samplePath, 3);

    page.on("console", (msg) => console.log("[pdf-to-images]", msg.text()));

    await page.goto("/pdf-to-images");
    await expect(page.getByText(/Export PDF pages as images/i)).toBeVisible();

    // Upload
    const uploader = page.locator("#pdf-to-images-upload");
    await uploader.waitFor({ state: "attached" });
    await uploader.setInputFiles(samplePath);

    await expect(page.getByText(/Ready to export images/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/3 pages/i)).toBeVisible();

    // Select PNG format (should be default)
    await expect(page.getByRole("button", { name: /PNG/i, pressed: true })).toBeVisible();

    // Select 1x scale for speed
    await page.getByRole("button", { name: /1x/i }).click();

    // Export
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export Images/i }).click();

    // Wait for progress
    await expect(page.getByText(/Rendering page/i)).toBeVisible();

    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Verify it's a ZIP with 3 PNG files
    const zipBytes = await readFile(downloadPath!);
    const zip = await JSZip.loadAsync(zipBytes);
    const fileNames = Object.keys(zip.files).filter((n) => !zip.files[n]!.dir);
    expect(fileNames).toHaveLength(3);

    for (const name of fileNames) {
      expect(name).toMatch(/\.png$/);
    }

    // Verify success message
    await expect(page.getByText(/Exported 3 pages as PNG/i)).toBeVisible();
  });

  test("exports a single-page PDF as a direct image download", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "single-page.pdf");
    await createSamplePdf(samplePath, 1);

    await page.goto("/pdf-to-images");

    const uploader = page.locator("#pdf-to-images-upload");
    await uploader.waitFor({ state: "attached" });
    await uploader.setInputFiles(samplePath);

    await expect(page.getByText(/Ready to export images/i)).toBeVisible({ timeout: 10000 });

    // Select JPEG
    await page.getByRole("button", { name: /JPEG/i }).click();
    await page.getByRole("button", { name: /1x/i }).click();

    // Should show quality slider for JPEG
    await expect(page.getByLabel(/JPEG quality/i)).toBeVisible();

    // Export — single page downloads directly (not ZIP)
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export Images/i }).click();

    const download = await downloadPromise;
    const fileName = download.suggestedFilename();
    expect(fileName).toMatch(/\.jpg$/);

    await expect(page.getByText(/Exported 1 page as JPEG/i)).toBeVisible();
  });
});
