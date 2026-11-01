import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";

const rawPreviewUrl = process.env.PLAYWRIGHT_PREVIEW_URL;
const expectedGitRef = process.env.PLAYWRIGHT_EXPECTED_GIT_REF;
const expectedCommitSha = process.env.PLAYWRIGHT_EXPECTED_COMMIT_SHA;
const oidcToken = process.env.VERCEL_OIDC_TOKEN;
const sessionToken = process.env.PREVIEW_E2E_SESSION_TOKEN;

if (!rawPreviewUrl || !expectedGitRef || !expectedCommitSha || !oidcToken || !sessionToken) {
  throw new Error("PLAYWRIGHT_PREVIEW_URL, PLAYWRIGHT_EXPECTED_GIT_REF, PLAYWRIGHT_EXPECTED_COMMIT_SHA, VERCEL_OIDC_TOKEN, and PREVIEW_E2E_SESSION_TOKEN are required.");
}

const previewUrl = new URL(rawPreviewUrl);
if (
  previewUrl.protocol !== "https:" || previewUrl.port || previewUrl.username || previewUrl.password
  || previewUrl.pathname !== "/" || previewUrl.search || previewUrl.hash
) {
  throw new Error("PLAYWRIGHT_PREVIEW_URL_MUST_BE_AN_HTTPS_DEPLOYMENT_ORIGIN.");
}

const vercelScope = process.env.VERCEL_SCOPE ?? "donghyunlees-projects-e43b52b1";
try {
  const output = execFileSync("vercel", ["inspect", previewUrl.origin, "--json", "--scope", vercelScope], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const jsonStart = output.indexOf("{");
  const deployment = JSON.parse(output.slice(jsonStart));
  const host = previewUrl.hostname;
  const source = JSON.parse(execFileSync("vercel", ["api", `/v13/deployments/${deployment.id}`, "--scope", vercelScope], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  if (
    deployment.name !== "windsoft-agent-blueprint" || deployment.target !== "preview"
    || deployment.readyState !== "READY" || (deployment.url !== host && !deployment.aliases?.includes(host))
    || source.gitSource?.ref !== expectedGitRef || source.gitSource?.sha !== expectedCommitSha
    || source.meta?.githubCommitRef !== expectedGitRef || source.meta?.githubCommitSha !== expectedCommitSha
    || source.meta?.githubRepo !== "ai-agent-blueprint" || source.meta?.githubOrg !== "donghyunlee-dev"
  ) {
    throw new Error("DEPLOYMENT_METADATA_MISMATCH");
  }
} catch {
  throw new Error("PLAYWRIGHT_PREVIEW_URL_MUST_RESOLVE_TO_A_READY_BLUEPRINT_PREVIEW_DEPLOYMENT.");
}

export default defineConfig({
  testDir: "./tests/live-preview",
  testMatch: "con-pr-05-live-preview.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60 * 1000,
  reporter: [["line"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: previewUrl.origin,
    viewport: { width: 1440, height: 900 },
    trace: "off",
    video: "off",
    screenshot: "off",
  },
});
