import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const referencePath = path.join(root, 'docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png');
const renderedPath = path.resolve(process.argv[2] ?? '.pr-artifacts/UIR-PR-02C/home-reference-1672x941.png');
const outputDirectory = path.resolve(process.argv[3] ?? '.pr-artifacts/UIR-PR-02C');
const threshold = 24;
await mkdir(outputDirectory, { recursive: true });

const reference = (await readFile(referencePath)).toString('base64');
const rendered = (await readFile(renderedPath)).toString('base64');
const photoAsset = (await readFile(path.join(root, 'public/home-reference/photo-background.png'))).toString('base64');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(`<img id="reference" src="data:image/png;base64,${reference}"><img id="rendered" src="data:image/png;base64,${rendered}"><img id="photo" src="data:image/png;base64,${photoAsset}"><canvas id="ref"></canvas><canvas id="actual"></canvas><canvas id="overlay"></canvas><canvas id="heatmap"></canvas><canvas id="photo-canvas"></canvas>`);
await page.waitForFunction(() => document.querySelector('#reference').naturalWidth > 0 && document.querySelector('#rendered').naturalWidth > 0 && document.querySelector('#photo').naturalWidth > 0);
const result = await page.evaluate((threshold) => {
  const refImage = document.querySelector('#reference');
  const actualImage = document.querySelector('#rendered');
  const width = refImage.naturalWidth;
  const height = refImage.naturalHeight;
  if (actualImage.naturalWidth !== width || actualImage.naturalHeight !== height) throw new Error('IMAGE_DIMENSIONS_MUST_MATCH');
  const refCanvas = document.querySelector('#ref');
  const actualCanvas = document.querySelector('#actual');
  const overlayCanvas = document.querySelector('#overlay');
  const heatCanvas = document.querySelector('#heatmap');
  const photoCanvas = document.querySelector('#photo-canvas');
  for (const canvas of [refCanvas, actualCanvas, overlayCanvas, heatCanvas, photoCanvas]) { canvas.width = width; canvas.height = height; }
  refCanvas.getContext('2d').drawImage(refImage, 0, 0);
  actualCanvas.getContext('2d').drawImage(actualImage, 0, 0);
  const ref = refCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
  const actual = actualCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
  const overlayContext = overlayCanvas.getContext('2d');
  const heatContext = heatCanvas.getContext('2d');
  const overlay = overlayContext.createImageData(width, height);
  const heat = heatContext.createImageData(width, height);
  photoCanvas.getContext('2d').drawImage(document.querySelector('#photo'), 0, 0);
  const photoPixels = photoCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
  let nonOpaquePhotoPixels = 0;
  let matched = 0;
  let maxDeltaSum = 0;
  for (let i = 0; i < ref.length; i += 4) {
    if (photoPixels[i + 3] !== 255) nonOpaquePhotoPixels += 1;
    const dr = Math.abs(ref[i] - actual[i]);
    const dg = Math.abs(ref[i + 1] - actual[i + 1]);
    const db = Math.abs(ref[i + 2] - actual[i + 2]);
    const delta = Math.max(dr, dg, db);
    if (delta <= threshold) matched += 1;
    maxDeltaSum += delta;
    overlay.data[i] = Math.round((ref[i] + actual[i]) / 2);
    overlay.data[i + 1] = Math.round((ref[i + 1] + actual[i + 1]) / 2);
    overlay.data[i + 2] = Math.round((ref[i + 2] + actual[i + 2]) / 2);
    overlay.data[i + 3] = 255;
    const intensity = Math.min(255, delta * 4);
    heat.data[i] = delta <= threshold ? 0 : intensity;
    heat.data[i + 1] = delta <= threshold ? Math.round(30 + (threshold - delta) * 3) : Math.round(intensity * 0.12);
    heat.data[i + 2] = delta <= threshold ? 0 : 0;
    heat.data[i + 3] = 255;
  }
  overlayContext.putImageData(overlay, 0, 0);
  heatContext.putImageData(heat, 0, 0);
  const save = (canvas, name) => ({ name, data: canvas.toDataURL('image/png').split(',')[1] });
  return {
    width, height, pixelCount: width * height, threshold,
    matchedPixels: matched,
    matchRate: Number((matched / (width * height) * 100).toFixed(4)),
    meanMaxChannelDelta: Number((maxDeltaSum / (width * height)).toFixed(4)),
    photoBackgroundNonOpaquePixels: nonOpaquePhotoPixels,
    images: [save(overlayCanvas, 'overlay.png'), save(heatCanvas, 'heatmap.png')],
  };
}, threshold);
for (const image of result.images) await writeFile(path.join(outputDirectory, image.name), Buffer.from(image.data, 'base64'));
const sourceFiles = [
  'src/components/auth/AuthMenu.tsx', 'src/components/layout/BlueprintShell.tsx',
  'src/components/projects/ProjectComposer.tsx', 'src/components/projects/RecentProjects.tsx',
  'src/pages/HomePage.tsx', 'src/styles/app-shell.css', 'src/styles/home.css',
  'src/styles/project-composer.css', 'public/home-reference/photo-background.png',
  'public/home-reference/mobile-photo-background.png',
  'scripts/assets/uir-pr-02c-photo-source.png', 'scripts/compose-uir-pr-02c-photo-background.mjs',
  'scripts/compare-uir-pr-02c-home.mjs', 'tests/e2e/uir-pr-02c-home-visual-parity.spec.ts',
];
const fileHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')])));
const head = process.env.UIR_PR_HEAD_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceStateHash = createHash('sha256').update(JSON.stringify({ head, fileHashes })).digest('hex');
const report = {
  ...result,
  images: result.images.map(({ name }) => name),
  reference: path.relative(root, referencePath),
  rendered: path.relative(root, renderedPath),
  maskedRegions: [],
  photoBackground: {
    source: 'standalone generated office photograph plus only photo texture outside interface masks in the approved design image',
    generatedSource: 'scripts/assets/uir-pr-02c-photo-source.png',
    output: 'public/home-reference/photo-background.png',
    method: 'Reference UI pixels are removed: the sidebar is filled white; the composer, recent/start headings, cards, and their shadows use the independent photograph; topbar and hero-title photo texture is reconstructed from adjacent photo-only pixels; reference photo texture remains only outside these regions; the output has no transparent pixels.',
    nonOpaquePixels: result.photoBackgroundNonOpaquePixels,
  },
  mobilePhotoBackground: {
    source: 'standalone generated office photograph without reference screenshot pixels',
    output: 'public/home-reference/mobile-photo-background.png',
  },
  sourceState: { head, sourceStateHash, files: fileHashes },
};
await writeFile(path.join(outputDirectory, 'pixel-comparison.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (report.matchRate < 95) throw new Error(`HOME_PIXEL_MATCH_BELOW_95_PERCENT: ${report.matchRate}%`);
