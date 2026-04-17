import { test, expect } from "@playwright/test";

test("page title contains Workflow Editor", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Workflow Editor/);
});
