import { test, expect } from "@playwright/test";

test("앱 셸이 로드된다", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("#root")).toBeVisible();
});
