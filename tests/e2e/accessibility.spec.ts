import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility audit — editor page", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/editor");
    // Wait for the palette to render with registry items
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("axe-core reports 0 violations on /editor", async ({ page }) => {
    // Verify we are on the /editor URL
    expect(page.url()).toContain("/editor");

    const results = await new AxeBuilder({ page }).analyze();

    // Log violations for debugging if any are found
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
