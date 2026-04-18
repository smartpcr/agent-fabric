import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility — property grid panel", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/editor");
    // Wait for the palette to render with registry items
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("axe-core reports 0 violations on property grid panel with a node selected", async ({
    page,
  }) => {
    // Add a TaskNode by clicking the palette item
    const taskOption = page.locator('[role="option"][data-kind="task"]');
    await taskOption.click();

    // Wait for the property grid to show fields (a node should be auto-selected)
    await page.waitForSelector('[data-testid="property-grid-fields"]', { timeout: 10000 });

    // Run axe-core scoped to the property grid panel
    const results = await new AxeBuilder({ page })
      .include('[data-testid="property-grid"]')
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
      console.log("axe violations (property grid):", JSON.stringify(summary, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test("axe-core reports 0 violations on property grid empty state", async ({ page }) => {
    // Without selecting a node, the grid shows empty state
    await page.waitForSelector('[data-testid="property-grid"]', { timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .include('[data-testid="property-grid"]')
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
      console.log("axe violations (empty state):", JSON.stringify(summary, null, 2));
    }

    expect(results.violations).toEqual([]);
  });
});
