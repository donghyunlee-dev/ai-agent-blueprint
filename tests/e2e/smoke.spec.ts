import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const evidenceDirectory = path.resolve(".pr-artifacts/FND-PR-01");

test("앱 셸이 로드된다", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("#root")).toBeVisible();
});

test("/login은 공개 로그인 화면을 제공한다", async ({ page }, testInfo) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 401, json: { error: "AUTH_REQUIRED" } }));
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Agent Blueprint" })).toBeVisible();
  await expect(page.locator(".auth-eyebrow")).toHaveText("WINDSOFT · PRODUCT BLUEPRINT");
  await expect(page.getByRole("button", { name: "Google로 계속" })).toBeVisible();
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDirectory, `login-${testInfo.project.name}.png`), scale: "css" });
});

test("/는 인증 확인 후 프로젝트 시작 composer를 제공한다", async ({ page }, testInfo) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 200, json: {
    authenticated: true,
    user: { issuer: "https://accounts.google.com", subject: "qa-user", email: "verified@example.test" },
  } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "아이디어를 제품 설계로 구체화하세요" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "만들고 싶은 제품이나 해결할 문제" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Blueprint 시작" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "아직 프로젝트가 없습니다" })).toBeVisible();
  await expect(page.locator(".auth-menu")).toBeVisible();
  const brand = await page.locator(".home-shell-brand").boundingBox();
  const menu = await page.locator(".auth-menu-trigger").boundingBox();
  expect(brand && menu && (
    brand.x + brand.width + 12 <= menu.x || menu.x + menu.width + 12 <= brand.x ||
    brand.y + brand.height + 8 <= menu.y || menu.y + menu.height + 8 <= brand.y
  )).toBeTruthy();
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDirectory, `home-${testInfo.project.name}.png`), scale: "css" });
});

test("/login의 첫 키보드 포커스는 Google 로그인 버튼이다", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 401, json: { error: "AUTH_REQUIRED" } }));
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Google로 계속" })).toBeFocused();
});

test("화면 너비에 맞춰 가로 넘침 없이 렌더링된다", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 401, json: { error: "AUTH_REQUIRED" } }));
  await page.goto("/login");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 200, json: {
    authenticated: true,
    user: { issuer: "https://accounts.google.com", subject: "qa-user", email: "verified@example.test" },
  } }));
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

for (const retiredPath of ["/survey", "/prd"]) {
  test(`${retiredPath}는 리다이렉트 없이 공통 404를 표시한다`, async ({ page }) => {
    await page.route("**/api/auth/session", (route) => route.fulfill({ status: 401, json: { error: "AUTH_REQUIRED" } }));
    await page.goto(retiredPath);
    await expect(page).toHaveURL(new RegExp(`${retiredPath}$`));
    await expect(page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" })).toBeVisible();
  });
}

test("공통 404 화면의 데스크톱·모바일 시각 증거를 캡처한다", async ({ page }, testInfo) => {
  await page.goto("/unknown-route");
  await expect(page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" })).toBeVisible();
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDirectory, `not-found-${testInfo.project.name}.png`), scale: "css" });
});
