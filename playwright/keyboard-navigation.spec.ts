import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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
};

test.describe("Keyboard navigation", () => {
  test("skip link is focusable and jumps to main content", async ({ page }) => {
    await page.goto("/");

    // Tab to the skip link
    await page.keyboard.press("Tab");
    const skipLink = page.locator("a:has-text('Skip to main content')");
    await expect(skipLink).toBeFocused();

    // Activate the skip link
    await page.keyboard.press("Enter");

    // Main content should exist with the correct id
    const main = page.locator("#main-content");
    await expect(main).toBeVisible();
  });

  test("Ctrl+O triggers file input on viewer page", async ({ page }) => {
    await page.goto("/viewer");
    await expect(page.getByText(/Bring your PDF/i)).toBeVisible();

    // Set up a listener for the custom event dispatch on the file input
    const fileInputClicked = page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        // The file input is sr-only, find it
        const input = document.querySelector<HTMLInputElement>("input[type='file']");
        if (!input) {
          resolve(false);
          return;
        }
        input.addEventListener("click", () => resolve(true), { once: true });
        setTimeout(() => resolve(false), 3000);
      });
    });

    // Need to click body first so focus isn't on an input element
    await page.locator("body").click();
    await page.keyboard.press("Control+o");
    const clicked = await fileInputClicked;
    expect(clicked).toBe(true);
  });

  test("arrow keys navigate pages in viewer", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "sample-keyboard.pdf");
    await createSamplePdf(samplePath, 3);

    await page.goto("/viewer");
    await expect(page.getByText(/Bring your PDF/i)).toBeVisible();

    // Upload PDF via the hidden file input
    const uploader = page.locator("input[type='file']");
    await uploader.setInputFiles(samplePath);

    // Wait for PDF to load — page indicator shows "Page 1 / 3"
    await expect(page.getByText("Page 1 / 3")).toBeVisible({ timeout: 15000 });

    // Click somewhere non-interactive to ensure focus is not on an input
    await page.locator("canvas").first().click();

    // ArrowRight → page 2
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Page 2 / 3")).toBeVisible();

    // ArrowRight → page 3
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Page 3 / 3")).toBeVisible();

    // ArrowRight at last page → stays at 3
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Page 3 / 3")).toBeVisible();

    // ArrowLeft → page 2
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("Page 2 / 3")).toBeVisible();
  });

  test("+ and - change zoom level in viewer", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "sample-zoom.pdf");
    await createSamplePdf(samplePath, 1);

    await page.goto("/viewer");
    const uploader = page.locator("input[type='file']");
    await uploader.setInputFiles(samplePath);

    // Wait for PDF to load
    await expect(page.getByText("Page 1 / 1")).toBeVisible({ timeout: 15000 });

    // Click on canvas to ensure focus is not on an input
    await page.locator("canvas").first().click();

    // Get initial zoom text (should be "100%")
    await expect(page.getByText("100%").first()).toBeVisible();

    // Press = to zoom in (= is the unshifted + key)
    await page.keyboard.press("=");
    await expect(page.getByText("110%").first()).toBeVisible();

    // Press - to zoom out
    await page.keyboard.press("-");
    await expect(page.getByText("100%").first()).toBeVisible();

    // Press = to zoom in, then 0 to reset
    await page.keyboard.press("=");
    await expect(page.getByText("110%").first()).toBeVisible();
    await page.keyboard.press("0");
    await expect(page.getByText("100%").first()).toBeVisible();
  });

  test("ARIA landmarks are present", async ({ page }) => {
    await page.goto("/");

    // Verify nav has aria-label
    const nav = page.locator("nav[aria-label='Tool navigation']");
    await expect(nav).toBeVisible();

    // Verify main has id
    const main = page.locator("main#main-content");
    await expect(main).toBeVisible();
  });
});
