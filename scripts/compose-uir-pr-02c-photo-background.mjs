import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const outputDirectory = 'public/home-reference';
const referencePath = 'docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png';
const cleanPhotoPath = 'scripts/assets/uir-pr-02c-photo-source.png';
const reference = (await readFile(referencePath)).toString('base64');
const cleanPhoto = (await readFile(cleanPhotoPath)).toString('base64');
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(`<img id="reference" src="data:image/png;base64,${reference}"><img id="photo" src="data:image/png;base64,${cleanPhoto}"><canvas id="output"></canvas>`);
await page.waitForFunction(() => document.querySelector('#reference').naturalWidth === 1672 && document.querySelector('#photo').naturalWidth > 0);
const asset = await page.evaluate(() => {
  const reference = document.querySelector('#reference');
  const photo = document.querySelector('#photo');
  const canvas = document.querySelector('#output');
  const width = 1672;
  const height = 941;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const base = context.createImageData(width, height);
  context.drawImage(photo, 0, 0, width, height);
  const generated = context.getImageData(0, 0, width, height).data;
  context.drawImage(reference, 0, 0, width, height);
  const design = context.getImageData(0, 0, width, height).data;
  const masks = [
    [412, 344, 987, 171],
    [280, 540, 200, 76], [1500, 540, 170, 76],
    [280, 720, 180, 84],
    [286, 592, 1354, 134],
    [285, 765, 1354, 176],
  ];
  const insideMask = (x, y) => masks.some(([left, top, maskWidth, maskHeight]) => x >= left && x < left + maskWidth && y >= top && y < top + maskHeight);
  const distanceToMask = (x, y) => Math.min(...masks.map(([left, top, maskWidth, maskHeight]) => {
    const dx = Math.max(left - x, 0, x - (left + maskWidth - 1));
    const dy = Math.max(top - y, 0, y - (top + maskHeight - 1));
    return Math.hypot(dx, dy);
  }));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (x < 250) {
        base.data[offset] = 255;
        base.data[offset + 1] = 255;
        base.data[offset + 2] = 255;
      } else if (!insideMask(x, y)) {
        const distance = distanceToMask(x, y);
      const generatedWeight = distance < 20 ? 1 - distance / 20 : 0;
        base.data[offset] = design[offset];
        base.data[offset + 1] = design[offset + 1];
        base.data[offset + 2] = design[offset + 2];
        if (generatedWeight) {
          base.data[offset] = Math.round(base.data[offset] * (1 - generatedWeight) + generated[offset] * generatedWeight);
          base.data[offset + 1] = Math.round(base.data[offset + 1] * (1 - generatedWeight) + generated[offset + 1] * generatedWeight);
          base.data[offset + 2] = Math.round(base.data[offset + 2] * (1 - generatedWeight) + generated[offset + 2] * generatedWeight);
        }
      } else {
        base.data[offset] = generated[offset];
        base.data[offset + 1] = generated[offset + 1];
        base.data[offset + 2] = generated[offset + 2];
      }
      base.data[offset + 3] = 255;
    }
  }
  const interpolateBand = (x, y, bandWidth, bandHeight, axis) => {
    if (axis === 'vertical') {
      const before = y - 1;
      const after = y + bandHeight;
      for (let row = y; row < y + bandHeight; row += 1) {
        const ratio = (row - before) / (after - before);
        for (let column = x; column < x + bandWidth; column += 1) {
          const offset = (row * width + column) * 4;
          const first = (before * width + column) * 4;
          const last = (after * width + column) * 4;
          for (let channel = 0; channel < 3; channel += 1) base.data[offset + channel] = Math.round(design[first + channel] * (1 - ratio) + design[last + channel] * ratio);
        }
      }
      return;
    }
    const before = x - 1;
    const after = Math.min(x + bandWidth, width - 1);
    for (let row = y; row < y + bandHeight; row += 1) {
      for (let column = x; column < Math.min(x + bandWidth, width); column += 1) {
        const ratio = (column - before) / (after - before);
        const offset = (row * width + column) * 4;
        const first = (row * width + before) * 4;
        const last = (row * width + after) * 4;
        for (let channel = 0; channel < 3; channel += 1) base.data[offset + channel] = Math.round(design[first + channel] * (1 - ratio) + design[last + channel] * ratio);
      }
    }
  };
  interpolateBand(1272, 18, 395, 48, 'horizontal');
  interpolateBand(678, 210, 465, 54, 'vertical');
  context.putImageData(base, 0, 0);
  return canvas.toDataURL('image/png').split(',')[1];
});
await writeFile(`${outputDirectory}/photo-background.png`, Buffer.from(asset, 'base64'));
await browser.close();
