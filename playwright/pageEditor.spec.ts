import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const widthForIndex = (index: number) => 400 + index * 25;
const PAGE_HEIGHT = 600;

const createSamplePdf = async (filePath: string) => {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });

  const doc = await PDFDocument.create();
  for (let index = 0; index < 3; index += 1) {
    doc.addPage([widthForIndex(index), PAGE_HEIGHT]);
  }

  const bytes = await doc.save();
  await writeFile(filePath, bytes);
};

test.describe("Page editor E2E", () => {
  test("reorders, rotates, deletes, and exports edited PDF", async ({ page }, testInfo) => {
    const samplePath = path.join(testInfo.outputDir, "sample-editor.pdf");
    await createSamplePdf(samplePath);

    await page.goto("/editor");
    await page.setInputFiles("#editor-upload", samplePath);

    await expect(page.getByText(/Page editor ready/i)).toBeVisible();

    const cards = page.locator('[data-page-card="true"]');
    await expect(cards).toHaveCount(3);

    await cards.nth(2).dragTo(cards.first());

    await expect(cards.first().getByText(/Page 1/i)).toBeVisible();

    await cards
      .nth(1)
      .getByRole("button", { name: /Rotate \+90°/i })
      .click();
    await cards
      .nth(2)
      .getByRole("button", { name: /Delete/i })
      .click();
    await expect(cards.nth(2).getByText(/Deleted/i)).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Apply & Download/i }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();

    expect(downloadPath).toBeTruthy();
    if (!downloadPath) {
      throw new Error("Download path not available");
    }

    const fileBytes = await readFile(downloadPath);
    const parsed = await PDFDocument.load(fileBytes);

    await expect(page.getByText(/Exported 2 pages/i)).toBeVisible();
    expect(parsed.getPageCount()).toBe(2);
    const firstPage = parsed.getPage(0);
    const secondPage = parsed.getPage(1);
    expect(firstPage.getWidth()).toBeCloseTo(widthForIndex(2), 2);
    expect(secondPage.getWidth()).toBeCloseTo(widthForIndex(0), 2);
    expect(secondPage.getRotation().angle).toBe(90);
  });
});
