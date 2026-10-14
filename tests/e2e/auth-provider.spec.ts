import { test, expect } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

const issuer = "https://accounts.google.com";
let viteServer: ViteDevServer;
let providerOrigin: string;

test.describe("AuthProvider identity race integration", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    viteServer = await createServer({
      configFile: false,
      root: process.cwd(),
      logLevel: "error",
      plugins: [react()],
      resolve: { dedupe: ["react", "react-dom"] },
      server: { host: "127.0.0.1", port: 0 },
    });
    await viteServer.listen();
    const address = viteServer.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("VITE_TEST_SERVER_ADDRESS_UNAVAILABLE");
    providerOrigin = `http://127.0.0.1:${address.port}`;
  });

  test.afterAll(async () => {
    await viteServer?.close();
  });

  test("late A session cannot restore owner, user, status, or memory project after logout starts", async ({ page }) => {
    let sessionCalls = 0;
    let releaseLateA!: () => void;
    let lateAFinished = false;
    let releaseLogout!: () => void;
    await page.route("**/api/auth/session", async (route) => {
      sessionCalls += 1;
      if (sessionCalls === 1) return fulfillSession(route, "user-a");
      if (sessionCalls === 2) {
        await new Promise<void>((resolve) => { releaseLateA = resolve; });
        await fulfillSession(route, "user-a");
        lateAFinished = true;
        return;
      }
      await route.fulfill({ status: 401, json: { error: "AUTH_REQUIRED" } });
    });
    await page.route("**/api/auth/logout", async (route) => {
      await new Promise<void>((resolve) => { releaseLogout = resolve; });
      await route.fulfill({ status: 500, json: { error: "LOGOUT_FAILED" } });
    });

    await mountProvider(page);
    await expectProvider(page, "authenticated", "user-a", true, "user-a");
    await page.getByRole("button", { name: "Check session" }).click();
    await expect.poll(() => sessionCalls).toBe(2);
    await expectProvider(page, "checking", "", false, "");

    await page.getByRole("button", { name: "Logout" }).click();
    await expectProvider(page, "redirecting", "", false, "");
    releaseLateA();
    await expect.poll(() => lateAFinished).toBe(true);
    await expectProvider(page, "redirecting", "", false, "");

    releaseLogout();
    await expectProvider(page, "anonymous", "", false, "");
  });

  test("late A session cannot restore access after expiry", async ({ page }) => {
    let sessionCalls = 0;
    let releaseLateA!: () => void;
    let lateAFinished = false;
    await page.route("**/api/auth/session", async (route) => {
      sessionCalls += 1;
      if (sessionCalls === 1) return fulfillSession(route, "user-a");
      await new Promise<void>((resolve) => { releaseLateA = resolve; });
      await fulfillSession(route, "user-a");
      lateAFinished = true;
    });

    await mountProvider(page);
    await expectProvider(page, "authenticated", "user-a", true, "user-a");
    await page.getByRole("button", { name: "Check session" }).click();
    await expect.poll(() => sessionCalls).toBe(2);
    await expectProvider(page, "checking", "", false, "");
    await page.getByRole("button", { name: "Expire session" }).click();
    await expectProvider(page, "expired", "", false, "");

    releaseLateA();
    await expect.poll(() => lateAFinished).toBe(true);
    await expectProvider(page, "expired", "", false, "");
  });

  test("late A session cannot replace newer B identity or its memory project", async ({ page }) => {
    let sessionCalls = 0;
    let releaseLateA!: () => void;
    let lateAFinished = false;
    await page.route("**/api/auth/session", async (route) => {
      sessionCalls += 1;
      if (sessionCalls === 1) return fulfillSession(route, "user-a");
      if (sessionCalls === 2) {
        await new Promise<void>((resolve) => { releaseLateA = resolve; });
        await fulfillSession(route, "user-a");
        lateAFinished = true;
        return;
      }
      await fulfillSession(route, "user-b");
    });

    await mountProvider(page);
    await expectProvider(page, "authenticated", "user-a", true, "user-a");
    await page.getByRole("button", { name: "Check session" }).click();
    await expect.poll(() => sessionCalls).toBe(2);
    await expectProvider(page, "checking", "", false, "");
    await page.getByRole("button", { name: "Check session" }).click();
    await expect.poll(() => sessionCalls).toBe(3);
    await expectProvider(page, "authenticated", "user-b", true, "user-b");

    releaseLateA();
    await expect.poll(() => lateAFinished).toBe(true);
    await expectProvider(page, "authenticated", "user-b", true, "user-b");
  });

  test("owner key derivation failure leaves identity and owner context unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(crypto.subtle, "digest", {
        configurable: true,
        value: () => Promise.reject(new Error("TEST_CRYPTO_FAILURE")),
      });
    });
    await page.route("**/api/auth/session", (route) => fulfillSession(route, "user-a"));

    await mountProvider(page);
    await expectProvider(page, "error", "", false, "");
  });
});

async function mountProvider(page: import("@playwright/test").Page) {
  await page.goto(`${providerOrigin}/tests/e2e/fixtures/auth-provider-harness.html`);
}

async function fulfillSession(route: import("@playwright/test").Route, subject: string) {
  await route.fulfill({
    status: 200,
    json: { authenticated: true, user: { issuer, subject, email: `${subject}@example.test` } },
  });
}

async function expectProvider(
  page: import("@playwright/test").Page,
  status: string,
  subject: string,
  hasOwner: boolean,
  projectOwner: string,
) {
  await expect(page.getByTestId("auth-status")).toHaveText(status);
  await expect(page.getByTestId("auth-subject")).toHaveText(subject);
  await expect(page.getByTestId("owner-context-present")).toHaveText(hasOwner ? "yes" : "no");
  await expect(page.getByTestId("memory-project-owner")).toHaveText(projectOwner);
}
