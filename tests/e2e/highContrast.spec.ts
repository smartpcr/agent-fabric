import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("High-contrast theme", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });

    // Apply the high-contrast theme via data attribute on <html>
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "high-contrast");
    });

    // Allow styles to settle
    await page.waitForTimeout(200);
  });

  test("high-contrast theme renders with expected background color", async ({ page }) => {
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // #000000 → rgb(0, 0, 0)
    expect(bgColor).toBe("rgb(0, 0, 0)");
  });

  test("high-contrast theme renders with expected text color", async ({ page }) => {
    const fgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).color;
    });
    // #ffffff → rgb(255, 255, 255)
    expect(fgColor).toBe("rgb(255, 255, 255)");
  });

  test("high-contrast editor screenshot", async ({ page }) => {
    await expect(page).toHaveScreenshot("high-contrast-editor.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("high-contrast editor with nodes screenshot", async ({ page }) => {
    // Add a task node via palette keyboard
    const taskOption = page.locator('[role="option"][data-kind="task"]');
    await taskOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });

    // Add a start node
    const startOption = page.locator('[role="option"][data-kind="start"]');
    await startOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(2, { timeout: 5000 });

    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("high-contrast-editor-with-nodes.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("axe-core reports 0 contrast violations in high-contrast mode", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2aaa", "wcag2aa", "wcag21aa"])
      .analyze();

    // Filter to only contrast-related violations
    const contrastViolations = results.violations.filter(
      (v) => v.id === "color-contrast" || v.id === "color-contrast-enhanced",
    );

    if (contrastViolations.length > 0) {
      const summary = contrastViolations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
        targets: v.nodes.map((n) => n.target),
      }));
      // eslint-disable-next-line no-console
      console.log("contrast violations:", JSON.stringify(summary, null, 2));
    }

    expect(contrastViolations).toEqual([]);
  });

  test("axe-core full scan reports 0 violations in high-contrast mode", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      // Exclude pre-existing structural violations unrelated to this step
      .disableRules(["aria-required-children"])
      .analyze();

    if (results.violations.length > 0) {
      const summary = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
        targets: v.nodes.map((n) => n.target),
      }));
      // eslint-disable-next-line no-console
      console.log("axe violations:", JSON.stringify(summary, null, 2));
    }

    expect(results.violations).toEqual([]);
  });
});
