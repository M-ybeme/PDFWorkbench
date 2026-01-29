import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SAMPLE_IMAGES = [
  {
    name: "first.png",
    base64:
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABaUlEQVR4nO2aO07DMBBFZ+bBjqASWAH3kAo7gBqoBJZADdUAXBIA7cAEGJs6D4n6SYLNOb3nmdnd2NpamdKIoF/f1PwCm+QN4BClEzjlM9lMHYChgnzzJY0tAAZgESz3BhA0AuwDaCSPZoPsgYotAMskk/MhvG65gF8hNnEtjPlL4AcyQbQf44hILVhTh9TY8Rhm87kgmfJrVYlxJcpuzq9B54UqldQJcl30J0MOSPjpu+bGkhSuQ8hVqgrmF8MmyhLvm0PslCi4+gIbGeZFkPGUKLj5ApsZ5kTnblDhDzrItvzLQ0K1IqxkmS5gxE1BFqRqTiETcEUJGpOIRNwWusWlVGoLDeA4ZPXVMHWW6CzuKXw6EGOpXJH6B4wY6lckfuqAXM4fWdeyr7bO13T+s2cl/qfd1q+IiiTs5aiD53WbuHaIynDh9p8cnA38zF7pEJtFCkAAAAASUVORK5CYII=",
  },
  {
    name: "second.png",
    base64:
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABcklEQVR4nO2aMW7DMAxFj4XBjoBF4ApqgAlYgJugEliAbqACTEHbAEGpM+2STb/HBKiITnH9t1Z2TnJykUURaX7+H4BTN0iuCKUhzjkM62S2gNGCfH8TyxoIDcABmCRLHcGEbQC7ANoJI92gSyBij0Ay6SS/GG4bL6AXyE2cS2M+YvgBzJBtB/jiEgtWdOH1PjBGHbzuSCZ8ktViXEl8m2dr0HnhSqV1AlyXfQnQw5I+Ol75saSFK5DyFWqCuYXwybKEu+XQ+yUKLj6AhsZ5kWQ8ZQouPkCmxnmROduUOEPOsix/MtDQrUirGSZLmBETUEWpGpOIRNwRQkal4hE3Ba6xaVUYgsN4Dhk9dUwdZboLO4pfDoQY6lckfoHjBjKVyR+6oBczh9Z17Kvt07Xtf0/Gtnd6X7dazIooU7OWog+d1m7h2iMpw4fSfHJwN/Mxe6RCbRQpAAAAAElFTkSuQmCC",
  },
];

const writeSampleImages = async (dir: string) => {
  await mkdir(dir, { recursive: true });
  const output: string[] = [];
  for (const image of SAMPLE_IMAGES) {
    const filePath = path.join(dir, image.name);
    await writeFile(filePath, Buffer.from(image.base64, "base64"));
    output.push(filePath);
  }
  return output;
};

test.describe("Images to PDF E2E", () => {
  test("builds a PDF from uploaded images", async ({ page }, testInfo) => {
    const sampleDir = path.join(testInfo.outputDir, "images-samples");
    const samplePaths = await writeSampleImages(sampleDir);

    page.on("console", (message) => console.log("[images-page]", message.text()));

    await page.goto("/images");
    const uploader = page.locator("#images-upload");
    await uploader.waitFor({ state: "attached" });
    await uploader.setInputFiles(samplePaths);

    const cards = page.locator("[data-image-list=\"true\"] li");
    await expect(cards).toHaveCount(samplePaths.length);

    // Reorder images to exercise queue controls.
    await cards.nth(1).getByRole("button", { name: /move up/i }).click();
    await expect(cards.first().getByText(/Page 1: second/i)).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Create 2-page PDF/i }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    if (!downloadPath) {
      throw new Error("Download path missing");
    }

    const bytes = await readFile(downloadPath);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(samplePaths.length);
    const firstPage = pdf.getPage(0);
    expect(firstPage.getWidth()).toBeCloseTo(612, 1);

    await expect(page.getByText(/Created PDF with 2 images/i)).toBeVisible();
  });
});
