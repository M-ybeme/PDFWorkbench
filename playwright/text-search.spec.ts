import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const createTextPdf = async (filePath: string) => {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });

  const doc = await PDFDocument.create();

  const page1 = doc.addPage([612, 792]);
  page1.drawText("Hello World from page one", { x: 50, y: 700, size: 18 });
  page1.drawText("Some unique text alpha", { x: 50, y: 650, size: 14 });

  const page2 = doc.addPage([612, 792]);
  page2.drawText("Hello World from page two", { x: 50, y: 700, size: 18 });
  page2.drawText("Different text beta", { x: 50, y: 650, size: 14 });

  const page3 = doc.addPage([612, 792]);
  page3.drawText("Final page content", { x: 50, y: 700, size: 18 });
  page3.drawText("Hello again here", { x: 50, y: 650, size: 14 });

  const bytes = await doc.save();
  await writeFile(filePath, bytes);
};

test.describe("Text Search E2E", () => {
  test("opens search with Ctrl+F and finds text", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "search-sample.pdf");
    await createTextPdf(samplePath);

    page.on("console", (msg) => console.log("[text-search]", msg.text()));

    await page.goto("/viewer");

    // Upload the PDF
    const uploader = page.locator("#viewer-upload");
    await uploader.waitFor({ state: "attached" });
    await uploader.setInputFiles(samplePath);

    // Wait for PDF to load
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

    // Open search with Ctrl+F
    await page.locator("canvas").first().click();
    await page.keyboard.press("Control+f");

    // Search bar should appear
    await expect(page.getByRole("search")).toBeVisible();
    await expect(page.getByLabel(/search text/i)).toBeFocused();

    // Type a search query
    await page.getByLabel(/search text/i).fill("Hello");

    // Wait for search results
    await expect(page.getByText(/of \d+/)).toBeVisible({ timeout: 5000 });
  });

  test("Find button toggles search bar", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "search-find-btn.pdf");
    await createTextPdf(samplePath);

    await page.goto("/viewer");

    const uploader = page.locator("#viewer-upload");
    await uploader.waitFor({ state: "attached" });
    await uploader.setInputFiles(samplePath);

    await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

    // Click Find button
    await page.getByRole("button", { name: /Find/i }).click();
    await expect(page.getByRole("search")).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
    const searchBar = page.getByRole("search");
    await expect(searchBar).toBeHidden();
  });
});
