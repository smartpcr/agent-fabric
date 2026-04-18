import { test, expect, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Safely get a non-null bounding box from a locator. */
async function getBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box");
  return box;
}

/** Drag a palette item onto the canvas to create a node. */
async function dragPaletteToCanvas(item: Locator, canvas: Locator) {
  const itemBox = await getBox(item);
  const canvasBox = await getBox(canvas);
  const sx = itemBox.x + itemBox.width / 2;
  const sy = itemBox.y + itemBox.height / 2;
  const dropX = canvasBox.x + canvasBox.width / 2;
  const dropY = canvasBox.y + canvasBox.height / 2;

  await item.dispatchEvent("pointerdown", {
    clientX: sx,
    clientY: sy,
    pointerId: 1,
    pointerType: "mouse",
    bubbles: true,
  });

  await item.dispatchEvent("pointermove", {
    clientX: sx + 10,
    clientY: sy + 10,
    pointerId: 1,
    pointerType: "mouse",
    bubbles: true,
  });

  await canvas.dispatchEvent("pointerup", {
    clientX: dropX,
    clientY: dropY,
    pointerId: 1,
    pointerType: "mouse",
    bubbles: true,
  });
}

test.describe("Accessibility — property grid panel", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/editor");
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("axe-core reports 0 violations on property grid panel with a node selected", async ({
    page,
  }) => {
    // Drag a TaskNode onto the canvas to create + select it
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    await dragPaletteToCanvas(taskItem, canvas);

    // Wait for the node to appear on canvas and be selected
    const newNode = page.locator(".react-flow__node[data-id]");
    await expect(newNode).toHaveCount(1, { timeout: 5000 });

    // Click the node to ensure it's selected
    await newNode.click();

    // Wait for the property grid to show form fields
    const propertyGrid = page.locator('[role="complementary"][aria-label="Property Grid"]');
    await expect(propertyGrid).toBeVisible({ timeout: 10000 });

    // Wait for a form or field to appear inside the property grid
    const formField = propertyGrid.locator("input, select, textarea").first();
    await expect(formField).toBeVisible({ timeout: 10000 });

    // Run axe-core scoped to the property grid panel
    const results = await new AxeBuilder({ page })
      .include('[role="complementary"][aria-label="Property Grid"]')
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
    // The property grid should be visible with empty state (no node selected)
    const propertyGrid = page.locator('[role="complementary"][aria-label="Property Grid"]');
    await expect(propertyGrid).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .include('[role="complementary"][aria-label="Property Grid"]')
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
