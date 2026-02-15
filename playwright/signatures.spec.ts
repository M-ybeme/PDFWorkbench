import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

const createSamplePdf = async (filePath: string) => {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });

  const doc = await PDFDocument.create();
  doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const bytes = await doc.save();
  await writeFile(filePath, bytes);
};

test.describe("Signatures E2E", () => {
  test("creates a signature, places it, and stamps the PDF", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "signatures-source.pdf");
    await createSamplePdf(samplePath);

    await page.goto("/signatures");
    await page.setInputFiles("#signature-upload", samplePath);

    await expect(page.getByText(/Page 1 \/ 1/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Create a signature to unlock/i)).toBeVisible();

    await page.getByRole("button", { name: /New$/i }).click();
    await expect(page.getByText(/Create a signature stamp/i)).toBeVisible();

    const labelInput = page.getByLabel(/^Label$/i);
    await labelInput.fill("Playwright Tester");
    await page.getByRole("button", { name: /^Type$/i }).click();
    await page.getByLabel("Typed name").fill("Playwright Tester");
    await page.getByRole("button", { name: /Save signature/i }).click();

    await expect(page.getByText(/Playwright Tester/)).toBeVisible();

    const previewPlaceholder = page.getByText(/Rendering page preview/i);
    await expect(previewPlaceholder).toBeHidden({ timeout: 15000 });

    const overlay = page.getByTestId("signature-overlay");
    await overlay.waitFor({ state: "visible" });
    await overlay.dispatchEvent("pointerdown", {
      clientX: 80,
      clientY: 80,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    });

    // Open the placements drawer to verify
    const itemsButton = page.getByRole("button", { name: /items/i });
    await itemsButton.click();

    const placementsList = page.getByTestId("placements-list");
    await expect(placementsList.locator("li")).toHaveCount(1);
    await expect(placementsList).toContainText(/Page 1/);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Stamp & download/i }).click();

    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    if (!downloadPath) {
      throw new Error("Download path not available");
    }

    const bytes = await readFile(downloadPath);
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBe(1);

    await expect(page.getByText(/Stamped 1 signature/i)).toBeVisible();
  });

  test("fills a form with text blocks and exports the PDF", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "form-fill-source.pdf");
    await createSamplePdf(samplePath);

    await page.goto("/signatures");
    await page.setInputFiles("#signature-upload", samplePath);
    await expect(page.getByText(/Page 1 \/ 1/)).toBeVisible({ timeout: 10000 });

    const previewPlaceholder = page.getByText(/Rendering page preview/i);
    await expect(previewPlaceholder).toBeHidden({ timeout: 15000 });

    // Activate text tool via ribbon tab
    await page.getByRole("button", { name: /^Text$/i }).click();
    await page.getByPlaceholder(/Type here/).fill("John Doe");

    // Place text on the page via direct event dispatch
    const overlay = page.getByTestId("signature-overlay");
    await overlay.dispatchEvent("pointerdown", {
      clientX: 100,
      clientY: 100,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    });

    // Open the placements drawer to verify
    const itemsButton = page.getByRole("button", { name: /items/i });
    await itemsButton.click();

    const textList = page.getByTestId("text-placements-list");
    await expect(textList.locator("li")).toHaveCount(1);
    await expect(textList).toContainText(/John Doe/);

    // Stamp & download
    const stampButton = page.getByRole("button", { name: /Stamp & download/i });
    await expect(stampButton).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }).catch(() => null),
      stampButton.click(),
    ]);

    if (!download) {
      const errorText = await page
        .locator(".text-rose-800, .text-rose-100")
        .textContent()
        .catch(() => "unknown");
      throw new Error(`Stamp failed: ${errorText}`);
    }

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    if (!downloadPath) throw new Error("Download path not available");

    const bytes = await readFile(downloadPath);
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBe(1);
  });
});
