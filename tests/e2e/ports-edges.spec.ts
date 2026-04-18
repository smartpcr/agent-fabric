import { test, expect, type Locator } from "@playwright/test";

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

/** Get the center coordinates of a locator's bounding box. */
async function getCenter(locator: Locator) {
  const box = await getBox(locator);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("Ports & Edges — drag connection between valid ports", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("drag from output handle to compatible input handle renders an edge path", async ({
    page,
  }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drop first task node (left side)
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + canvasBox.width / 3,
      canvasBox.y + canvasBox.height / 3,
    );

    // Drop second task node (right side, lower)
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + (canvasBox.width * 2) / 3,
      canvasBox.y + (canvasBox.height * 2) / 3,
    );

    // Verify both nodes are rendered
    const allNodes = page.locator(".react-flow__node[data-id]");
    await expect(allNodes).toHaveCount(2, { timeout: 5000 });

    // Locate the output handle (source) of the first node and input handle (target) of the second
    const firstNode = allNodes.nth(0);
    const secondNode = allNodes.nth(1);

    const sourceHandle = firstNode.locator(".react-flow__handle.source");
    const targetHandle = secondNode.locator(".react-flow__handle.target");

    await expect(sourceHandle).toBeVisible({ timeout: 5000 });
    await expect(targetHandle).toBeVisible({ timeout: 5000 });

    // Get center positions for drag
    const sourceCenter = await getCenter(sourceHandle);
    const targetCenter = await getCenter(targetHandle);

    // Perform a mouse drag from source handle to target handle
    // xyflow uses mousedown/mousemove/mouseup for connection dragging
    await page.mouse.move(sourceCenter.x, sourceCenter.y);
    await page.mouse.down();
    // Move in steps to trigger xyflow's connection detection
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mx = sourceCenter.x + (targetCenter.x - sourceCenter.x) * t;
      const my = sourceCenter.y + (targetCenter.y - sourceCenter.y) * t;
      await page.mouse.move(mx, my);
    }
    await page.mouse.up();

    // Wait for the edge to appear in the DOM
    // xyflow renders edges as SVG paths inside .react-flow__edge elements
    const edgeLocator = page.locator(".react-flow__edge");
    await expect(edgeLocator).toHaveCount(1, { timeout: 5000 });

    // Verify the edge contains an SVG path element (skip marker defs paths)
    const edgePath = edgeLocator.locator(".react-flow__edge-path");
    await expect(edgePath).toBeVisible();

    // Verify the path has a non-empty 'd' attribute (actual bezier path data)
    const pathD = await edgePath.getAttribute("d");
    expect(pathD).toBeTruthy();
    expect(typeof pathD === "string" && pathD.length > 0).toBe(true);
  });

  test("edge connects the correct source and target nodes", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drop a Start node and a Task node
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

    const allNodes = page.locator(".react-flow__node[data-id]");
    await expect(allNodes).toHaveCount(2, { timeout: 5000 });

    // Identify the Start and Task nodes
    const startNode = page.locator(".react-flow__node-start");
    const taskNode = page.locator(".react-flow__node-task");
    await expect(startNode).toBeVisible();
    await expect(taskNode).toBeVisible();

    const startId = await startNode.getAttribute("data-id");
    expect(startId).toBeTruthy();

    // Get the source handle from Start and target handle from Task
    const sourceHandle = startNode.locator(".react-flow__handle.source");
    const targetHandle = taskNode.locator(".react-flow__handle.target");

    await expect(sourceHandle).toBeVisible();
    await expect(targetHandle).toBeVisible();

    const sourceCenter = await getCenter(sourceHandle);
    const targetCenter = await getCenter(targetHandle);

    // Drag connection
    await page.mouse.move(sourceCenter.x, sourceCenter.y);
    await page.mouse.down();
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await page.mouse.move(
        sourceCenter.x + (targetCenter.x - sourceCenter.x) * t,
        sourceCenter.y + (targetCenter.y - sourceCenter.y) * t,
      );
    }
    await page.mouse.up();

    // Verify edge rendered
    const edgeLocator = page.locator(".react-flow__edge");
    await expect(edgeLocator).toHaveCount(1, { timeout: 5000 });

    // Verify the edge references the correct source node via aria-label
    const edgeAriaLabel = await edgeLocator.getAttribute("aria-label");
    expect(edgeAriaLabel).toBeTruthy();
    expect(startId).toBeTruthy();
    expect(edgeAriaLabel).toContain(startId as string);

    // Verify edge path is visible
    const edgePath = edgeLocator.locator(".react-flow__edge-path");
    await expect(edgePath).toBeVisible();
  });
});
