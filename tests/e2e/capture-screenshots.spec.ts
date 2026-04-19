import { test, expect, type Locator } from "@playwright/test";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCREENSHOT_DIR = resolve(__dirname, "../../docs/user-guide/screenshots");

/** Safely get a non-null bounding box from a locator. */
async function getBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box");
  return box;
}

/** Drag a palette item onto the canvas at the given absolute coordinates. */
async function dragPaletteToCanvas(item: Locator, canvas: Locator, dropX: number, dropY: number) {
  const itemBox = await getBox(item);
  const sx = itemBox.x + itemBox.width / 2;
  const sy = itemBox.y + itemBox.height / 2;

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

test.describe("Capture user-guide screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("agent-fabric:graph");
      localStorage.removeItem("agent-fabric:viewport");
    });
    await page.reload();
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("editor-layout — full editor with palette, canvas, property grid", async ({ page }) => {
    await page.waitForTimeout(500);
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "editor-layout.png"),
      fullPage: false,
    });
  });

  test("add-node — drag a task node from the palette onto the canvas", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2,
    );

    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });
    await page.waitForTimeout(300);

    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "add-node.png"),
      fullPage: false,
    });
  });

  test("connect-nodes — Start and Task connected via edge", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drop Start node
    const startItem = page.locator('[role="option"][data-kind="start"]');
    await dragPaletteToCanvas(
      startItem,
      canvas,
      canvasBox.x + canvasBox.width / 4,
      canvasBox.y + canvasBox.height / 2,
    );

    // Drop Task node
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + (canvasBox.width * 3) / 4,
      canvasBox.y + canvasBox.height / 2,
    );

    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(2, { timeout: 5000 });

    // Use xyflow standard handle classes for connection
    const startNode = page.locator(".react-flow__node-start");
    const taskNode = page.locator(".react-flow__node-task");

    // Source handle (any .react-flow__handle on the Start node)
    const sourceHandle = startNode.locator(".react-flow__handle").first();
    // Target handle (any .react-flow__handle on the Task node)
    const targetHandle = taskNode.locator(".react-flow__handle").first();

    await expect(sourceHandle).toBeVisible({ timeout: 5000 });
    await expect(targetHandle).toBeVisible({ timeout: 5000 });

    const sourceBox = await getBox(sourceHandle);
    const targetBox = await getBox(targetHandle);

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 10,
    });
    await page.mouse.up();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "connect-nodes.png"),
      fullPage: false,
    });
  });

  test("property-grid — Task node selected showing fields", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drop a Task node
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2,
    );

    const node = page.locator(".react-flow__node-task");
    await expect(node).toBeVisible({ timeout: 5000 });

    // Click node to select it and open property grid
    await node.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "property-grid.png"),
      fullPage: false,
    });
  });

  test("save-workflow — toolbar visible after save", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drop a node so the workflow has content
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2,
    );

    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });

    // Trigger save with Ctrl+S
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(500);

    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "save-workflow.png"),
      fullPage: false,
    });
  });

  test("run-workflow — workflow with nodes showing toolbar run state", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drop Start and Task nodes
    const startItem = page.locator('[role="option"][data-kind="start"]');
    await dragPaletteToCanvas(
      startItem,
      canvas,
      canvasBox.x + canvasBox.width / 3,
      canvasBox.y + canvasBox.height / 2,
    );

    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + (canvasBox.width * 2) / 3,
      canvasBox.y + canvasBox.height / 2,
    );

    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(2, { timeout: 5000 });
    await page.waitForTimeout(300);

    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "run-workflow.png"),
      fullPage: false,
    });
  });
});
