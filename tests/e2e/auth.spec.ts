import { test, expect } from "@playwright/test";

test("보호 화면은 로그인 후 안전한 returnTo로 복귀한다", async ({ page }, testInfo) => {
  let releaseSession!: () => void;
  await page.route("**/api/auth/session", async (route) => {
    await new Promise<void>((resolve) => { releaseSession = resolve; });
    await route.fulfill({ status: 401, json: { error: "AUTH_REQUIRED" } });
  });
  await page.goto("/");

  await expect(page.getByRole("status")).toHaveText("로그인 상태를 확인하고 있습니다.");
  await expect(page.getByRole("textbox", { name: "만들고 싶은 제품이나 해결할 문제" })).toHaveCount(0);
  await page.screenshot({ path: `.pr-artifacts/AUTH-PR-04/${testInfo.project.name}-auth-check.png`, fullPage: true, scale: "css" });
  releaseSession();
  await expect(page).toHaveURL(/\/login\?returnTo=%2F$/);
  await expect(page.getByRole("heading", { name: "ideon" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google로 시작하기" })).toBeEnabled();
  await expect(page.getByText("또는", { exact: true })).toHaveCount(0);
  await expect(page.getByText("이메일로 계속하기", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel(/비밀번호|이메일 주소|인증 코드/)).toHaveCount(0);
  await page.screenshot({ path: `.pr-artifacts/AUTH-PR-04/${testInfo.project.name}-login.png`, fullPage: true, scale: "css" });
});

test("OAuth 오류는 일반 안내와 재시도를 제공하며 중복 시작을 막는다", async ({ page }, testInfo) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 401, json: { error: "AUTH_REQUIRED" } }));
  await page.goto("/login?returnTo=%2F&error=access_denied");

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("로그인을 완료하지 못했습니다. 다시 시도해 주세요.");
  await expect(alert).toBeFocused();
  await expect(alert).not.toContainText("access_denied");
  await page.screenshot({ path: `.pr-artifacts/AUTH-PR-04/${testInfo.project.name}-login-error.png`, fullPage: true, scale: "css" });
  let releaseStart!: () => void;
  await page.route("**/api/auth/google/start?*", async (route) => {
    startCalls += 1;
    expect(new URL(route.request().url()).searchParams.get("returnTo")).toBe("/");
    await new Promise<void>((resolve) => { releaseStart = resolve; });
    await route.abort();
  });
  let startCalls = 0;
  await page.evaluate(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    const testWindow = window as Window & { runLoginRedirect?: () => void };
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 100 && typeof handler === "function") {
        testWindow.runLoginRedirect = () => handler(...args);
        return 1;
      }
      return nativeSetTimeout(handler, delay, ...args);
    }) as typeof window.setTimeout;
  });
  await page.locator(".auth-google-button").evaluate((button) => {
    button.click();
    button.click();
  });
  try {
    const redirectButton = await page.locator(".auth-google-button").evaluate((button) => ({
      busy: button.getAttribute("aria-busy"),
      disabled: (button as HTMLButtonElement).disabled,
      text: button.textContent,
    }));
    expect(redirectButton).toEqual({ busy: "true", disabled: true, text: "Google 로그인 화면으로 이동하고 있습니다." });
    await page.screenshot({ path: `.pr-artifacts/AUTH-PR-04/${testInfo.project.name}-login-redirect.png`, fullPage: true, scale: "css" });
    await page.evaluate(() => (window as Window & { runLoginRedirect?: () => void }).runLoginRedirect?.());
    await expect.poll(() => typeof releaseStart).toBe("function");
    expect(startCalls).toBe(1);
  } finally {
    releaseStart?.();
  }
});

test("외부 returnTo는 앱 루트로 제한된다", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 401, json: { error: "AUTH_REQUIRED" } }));
  await page.goto("/login?returnTo=https%3A%2F%2Fevil.example%2Fphish");
  let requestedReturnTo: string | null = null;
  await page.route("**/api/auth/google/start?*", async (route) => {
    requestedReturnTo = new URL(route.request().url()).searchParams.get("returnTo");
    await route.abort();
  });
  await page.locator(".auth-google-button").click();
  await expect.poll(() => requestedReturnTo).toBe("/");
});

test("세션 만료 응답은 보호 내용을 가리고 재인증 안내를 보인다", async ({ page }, testInfo) => {
  await page.route("**/api/auth/session", async (route) => route.fulfill({ status: 200, json: {
    authenticated: true,
    user: { issuer: "https://accounts.google.com", subject: "qa-user", email: "verified@example.test" },
  } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "어떤 서비스를 만들고 싶으세요?" })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("blueprint:session-expired")));

  await expect(page.getByRole("alert")).toContainText("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByRole("textbox", { name: "만들고 싶은 제품이나 해결할 문제" })).toHaveCount(0);
  await page.screenshot({ path: `.pr-artifacts/AUTH-PR-04/${testInfo.project.name}-session-expired.png`, fullPage: true, scale: "css" });
});

test("Blueprint 로그아웃은 사용자 메뉴에서 한 번만 수행되고 뒤로 가도 보호 화면을 보이지 않는다", async ({ page }, testInfo) => {
  let sessionActive = true;
  let logoutCalls = 0;
  await page.route("**/api/auth/session", async (route) => {
    if (route.request().method() === "POST") {
      logoutCalls += 1;
      sessionActive = false;
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.fulfill({ status: sessionActive ? 200 : 401, json: sessionActive
      ? { authenticated: true, user: { issuer: "https://accounts.google.com", subject: "qa-user", email: "verified@example.test" } }
      : { error: "AUTH_REQUIRED" } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "어떤 서비스를 만들고 싶으세요?" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.evaluate(() => {
    sessionStorage.setItem("windsoft-agent-blueprint:prd-context", "current-user-context");
    sessionStorage.setItem("sfood-agent-blueprint:prd-context", "legacy-context");
    sessionStorage.setItem("other-app-state", "preserve");
  });
  await page.getByRole("button", { name: "사용자 메뉴" }).click();
  await expect(page.getByText("이 작업은 Google 계정에서 로그아웃하지 않습니다.")).toBeVisible();
  await page.screenshot({ path: `.pr-artifacts/AUTH-PR-02/${testInfo.project.name}-account-menu.png`, fullPage: true, scale: "css" });
  await page.getByRole("button", { name: "Blueprint에서 로그아웃" }).evaluate((button) => {
    button.click();
    button.click();
  });
  await page.waitForURL("**/login");
  await expect(page.getByRole("heading", { name: "ideon" })).toBeVisible();
  expect(logoutCalls).toBe(1);
  expect(await page.evaluate(() => [
    sessionStorage.getItem("windsoft-agent-blueprint:prd-context"),
    sessionStorage.getItem("sfood-agent-blueprint:prd-context"),
    sessionStorage.getItem("other-app-state"),
  ])).toEqual([null, null, "preserve"]);
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(page.getByRole("heading", { name: "ideon" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "만들고 싶은 제품이나 해결할 문제" })).toHaveCount(0);
});
