import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const referencePath = "docs/blueprint-design/윈도우 오피스와 미니멀 로그인 화면.png";
const artifactDirectory = ".pr-artifacts/AUTH-PR-04";
const reference = await readFile(referencePath);
const implementationHeadSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const implementationFiles = ["src/pages/LoginPage.tsx", "src/styles/auth.css", "public/login-reference", "scripts/crop-login-reference.mjs", "tests/e2e/auth.spec.ts", "tests/e2e/smoke.spec.ts", "docs/ui/screens/00-login-and-session.md"];
const implementationWorkingTreeDirty = execFileSync("git", ["status", "--porcelain", "--", ...implementationFiles], { encoding: "utf8" }).trim().length > 0;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1586, height: 992 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 401, json: { error: "AUTH_REQUIRED" } }));
  await page.goto("http://localhost:4173/login", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Google로 시작하기" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const rendered = await page.screenshot({ path: `${artifactDirectory}/login-1586x992-render.png`, scale: "css" });
  const comparison = await page.evaluate(async ({ referenceData, renderData }) => {
    const decode = async (data) => {
      const image = new Image();
      image.src = data;
      await image.decode();
      return image;
    };
    const [source, output] = await Promise.all([decode(referenceData), decode(renderData)]);
    const width = source.naturalWidth;
    const height = source.naturalHeight;
    if (width !== output.naturalWidth || height !== output.naturalHeight) throw new Error("Comparison images must have identical native dimensions");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(source, 0, 0);
    const sourcePixels = context.getImageData(0, 0, width, height).data;
    context.clearRect(0, 0, width, height);
    context.drawImage(output, 0, 0);
    const outputPixels = context.getImageData(0, 0, width, height).data;
    let matchingPixels = 0;
    let totalMaxChannelDifference = 0;
    let maximumChannelDifference = 0;
    const heat = context.createImageData(width, height);
    for (let offset = 0; offset < sourcePixels.length; offset += 4) {
      const difference = Math.max(Math.abs(sourcePixels[offset] - outputPixels[offset]), Math.abs(sourcePixels[offset + 1] - outputPixels[offset + 1]), Math.abs(sourcePixels[offset + 2] - outputPixels[offset + 2]));
      if (difference <= 24) matchingPixels++;
      totalMaxChannelDifference += difference;
      maximumChannelDifference = Math.max(maximumChannelDifference, difference);
      heat.data[offset] = difference <= 24 ? 0 : Math.min(255, difference * 4);
      heat.data[offset + 1] = difference <= 24 ? 0 : Math.max(0, 255 - difference * 4);
      heat.data[offset + 2] = 0;
      heat.data[offset + 3] = 255;
    }
    context.putImageData(heat, 0, 0);
    const heatmap = canvas.toDataURL("image/png");
    context.clearRect(0, 0, width, height);
    context.globalAlpha = 1;
    context.drawImage(source, 0, 0);
    context.globalAlpha = 0.5;
    context.drawImage(output, 0, 0);
    const overlay = canvas.toDataURL("image/png");
    return { width, height, totalPixels: width * height, matchingPixels, nonMatchingPixels: width * height - matchingPixels, totalMaxChannelDifference, maximumChannelDifference, similarity: matchingPixels / (width * height) * 100, heatmap, overlay };
  }, {
    referenceData: `data:image/png;base64,${reference.toString("base64")}`,
    renderData: `data:image/png;base64,${rendered.toString("base64")}`,
  });
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(`${artifactDirectory}/login-1586x992-reference.png`, reference);
  for (const [name, dataUrl] of [["login-1586x992-heatmap.png", comparison.heatmap], ["login-1586x992-overlay.png", comparison.overlay]]) {
    await writeFile(`${artifactDirectory}/${name}`, Buffer.from(dataUrl.split(",")[1], "base64"));
  }
  for (const [width, height, name] of [[1440, 900, "login-1440x900.png"], [390, 844, "login-390x844.png"]]) {
    await page.setViewportSize({ width, height });
    await page.goto("http://localhost:4173/login", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Google로 시작하기" }).waitFor();
    await page.screenshot({ path: `${artifactDirectory}/${name}`, scale: "css" });
  }
  const artifactNames = ["login-1586x992-reference.png", "login-1586x992-render.png", "login-1586x992-overlay.png", "login-1586x992-heatmap.png", "login-1440x900.png", "login-390x844.png"];
  const hashes = {};
  for (const name of artifactNames) hashes[name] = createHash("sha256").update(await readFile(`${artifactDirectory}/${name}`)).digest("hex");
  const report = {
    algorithm: "Unmasked RGB pixel comparison; pixel matches if max absolute per-channel difference <= 24; no scaling, cropping, or excluded regions.",
    route: "/login",
    state: "default unauthenticated login",
    fixture: "F-LOGIN",
    focusState: "The Google action receives initial programmatic focus and its focus-visible outline is included in the rendered capture.",
    viewportCssPx: { width: comparison.width, height: comparison.height },
    totalPixels: comparison.totalPixels,
    matchingPixels: comparison.matchingPixels,
    nonMatchingPixels: comparison.nonMatchingPixels,
    maximumPerChannelDeltaForMatch: 24,
    maximumObservedPerChannelDelta: comparison.maximumChannelDifference,
    meanMaximumPerChannelDelta: Number((comparison.totalMaxChannelDifference / comparison.totalPixels).toFixed(4)),
    similarityPercent: Number(comparison.similarity.toFixed(4)),
    thresholdPercent: 95,
    passed: comparison.similarity >= 95,
    sourcePath: referencePath,
    implementationHeadSha,
    implementationWorkingTreeDirty,
    artifacts: artifactNames,
    sha256: hashes,
  };
  await writeFile(`${artifactDirectory}/comparison-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
