import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = "docs/blueprint-design/윈도우 오피스와 미니멀 로그인 화면.png";
const outputDirectory = "public/login-reference";
const source = await readFile(sourcePath);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<img id="source" src="data:image/png;base64,${source.toString("base64")}">`);
  const results = await page.locator("#source").evaluate(async (image) => {
    await image.decode();
    const crops = {
      office: { x: 0, y: 0, width: 838, height: 992, transparentWhite: false },
      ideon: { x: 1000, y: 318, width: 430, height: 150, transparentWhite: true },
      windsoft: { x: 1414, y: 18, width: 150, height: 42, transparentWhite: true },
      google: { x: 1104, y: 540, width: 40, height: 40, transparentWhite: false, transparentNavy: true },
      chevron: { x: 1370, y: 545, width: 30, height: 30, transparentWhite: false, transparentNavy: true },
    };
    return Object.fromEntries(Object.entries(crops).map(([name, crop]) => {
      const canvas = document.createElement("canvas");
      canvas.width = crop.width;
      canvas.height = crop.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      if (crop.transparentWhite || crop.transparentNavy) {
        const pixels = context.getImageData(0, 0, crop.width, crop.height);
        for (let index = 0; index < pixels.data.length; index += 4) {
          const [red, green, blue] = pixels.data.slice(index, index + 3);
          if (crop.transparentWhite && red > 246 && green > 246 && blue > 246) pixels.data[index + 3] = 0;
          if (crop.transparentNavy && red < 60 && green < 75 && blue < 150) pixels.data[index + 3] = 0;
        }
        context.putImageData(pixels, 0, 0);
      }
      return [name, { dataUrl: canvas.toDataURL("image/png"), ...crop }];
    }));
  });
  await mkdir(outputDirectory, { recursive: true });
  const manifest = { source: sourcePath, sourceSize: { width: 1586, height: 992 }, crops: {} };
  for (const [name, crop] of Object.entries(results)) {
    const filePath = path.join(outputDirectory, `${name}.png`);
    const base64 = crop.dataUrl.slice(crop.dataUrl.indexOf(",") + 1);
    await writeFile(filePath, Buffer.from(base64, "base64"));
    manifest.crops[name] = { path: filePath, x: crop.x, y: crop.y, width: crop.width, height: crop.height, transparentWhite: crop.transparentWhite, transparentNavy: crop.transparentNavy };
  }
  await writeFile(path.join(outputDirectory, "crop-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  await browser.close();
}
