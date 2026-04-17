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

  // pointerdown on palette item (triggers setPointerCapture)
  await item.dispatchEvent("pointerdown", {
    clientX: sx,
    clientY: sy,
    pointerId: 1,
    pointerType: "mouse",
    bubbles: true,
  });

  // pointermove past 3px drag threshold (on palette item, since it has capture)
  await item.dispatchEvent("pointermove", {
    clientX: sx + 10,
    clientY: sy + 10,
    pointerId: 1,
    pointerType: "mouse",
    bubbles: true,
  });

  // pointerup on canvas — creates the node via Canvas.handlePointerUp
  await canvas.dispatchEvent("pointerup", {
    clientX: dropX,
    clientY: dropY,
    pointerId: 1,
    pointerType: "mouse",
    bubbles: true,
  });
}

test.describe("Build workflow — drag palette to canvas", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("drag Task from palette, drop on canvas, verify node renders", async ({ page }) => {
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await expect(taskItem).toBeVisible();

    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    await expect(canvas).toBeVisible();

    const canvasBox = await getBox(canvas);
    const dropX = canvasBox.x + canvasBox.width / 2;
    const dropY = canvasBox.y + canvasBox.height / 2;

    await dragPaletteToCanvas(taskItem, canvas, dropX, dropY);

    // Verify a node with [data-id] appeared (xyflow wraps each node this way)
    const newNode = page.locator(".react-flow__node[data-id]");
    await expect(newNode).toHaveCount(1, { timeout: 5000 });

    // Verify the data-id is a non-empty string
    const dataId = await newNode.getAttribute("data-id");
    expect(dataId).toBeTruthy();
    expect(typeof dataId).toBe("string");

    // Verify the node is the correct type (task)
    await expect(newNode).toHaveClass(/react-flow__node-task/);

    // Verify BaseNode content rendered
    const nodeTitle = newNode.locator('[data-testid="node-header"]');
    await expect(nodeTitle).toBeVisible();
  });

  test("drag Start and End from palette, both nodes render on canvas", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drag Start
    const startItem = page.locator('[role="option"][data-kind="start"]');
    await expect(startItem).toBeVisible();
    await dragPaletteToCanvas(
      startItem,
      canvas,
      canvasBox.x + canvasBox.width / 3,
      canvasBox.y + canvasBox.height / 2,
    );

    // Drag End
    const endItem = page.locator('[role="option"][data-kind="end"]');
    await expect(endItem).toBeVisible();
    await dragPaletteToCanvas(
      endItem,
      canvas,
      canvasBox.x + (canvasBox.width * 2) / 3,
      canvasBox.y + canvasBox.height / 2,
    );

    // Both nodes should render
    const nodes = page.locator(".react-flow__node[data-id]");
    await expect(nodes).toHaveCount(2, { timeout: 5000 });

    // Verify types
    await expect(page.locator(".react-flow__node-start")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-end")).toHaveCount(1);
  });
});

test.describe("Select + delete a node via keyboard", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("Tab-focus node then Delete removes it (keyboard-only flow)", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drop a task node onto the canvas
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2,
    );

    // Verify node exists
    const nodeLocator = page.locator(".react-flow__node[data-id]");
    await expect(nodeLocator).toHaveCount(1, { timeout: 5000 });
    const dataId = await nodeLocator.getAttribute("data-id");

    // Focus the canvas area first
    await canvas.focus();

    // Tab until the xyflow node receives focus (xyflow nodes have tabindex=0)
    // The node may need several Tab presses to reach depending on DOM order
    let focused = false;
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const activeId = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.getAttribute("data-id") ?? el?.closest("[data-id]")?.getAttribute("data-id");
      });
      if (activeId === dataId) {
        focused = true;
        break;
      }
    }
    expect(focused).toBe(true);

    // Press Delete while the node is focused — keydown bubbles to canvas handler
    await page.keyboard.press("Delete");

    // Assert node is gone
    await expect(nodeLocator).toHaveCount(0, { timeout: 5000 });
  });

  test("click node to select, press Delete, node is removed", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drop a task node onto the canvas
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2,
    );

    // Verify node exists
    const nodeLocator = page.locator(".react-flow__node[data-id]");
    await expect(nodeLocator).toHaveCount(1, { timeout: 5000 });

    // Click the node to select it (fires onNodeClick → selectAction in store)
    await nodeLocator.click();

    // Focus the canvas wrapper so Delete keydown fires on the canvas handler
    await canvas.focus();

    // Press Delete to remove the selected node
    await page.keyboard.press("Delete");

    // Assert node is gone
    await expect(nodeLocator).toHaveCount(0, { timeout: 5000 });
  });

  test("drop two nodes, select one, delete it, other remains", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drop Start node
    const startItem = page.locator('[role="option"][data-kind="start"]');
    await dragPaletteToCanvas(
      startItem,
      canvas,
      canvasBox.x + canvasBox.width / 3,
      canvasBox.y + canvasBox.height / 2,
    );

    // Drop Task node
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + (canvasBox.width * 2) / 3,
      canvasBox.y + canvasBox.height / 2,
    );

    // Verify both nodes exist
    const allNodes = page.locator(".react-flow__node[data-id]");
    await expect(allNodes).toHaveCount(2, { timeout: 5000 });

    // Click the task node to select it
    const taskNode = page.locator(".react-flow__node-task");
    await taskNode.click();

    // Focus canvas and press Delete
    await canvas.focus();
    await page.keyboard.press("Delete");

    // Task node removed, Start node remains
    await expect(allNodes).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator(".react-flow__node-start")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-task")).toHaveCount(0);
  });

  test("Backspace also deletes a selected node", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drop a node
    const endItem = page.locator('[role="option"][data-kind="end"]');
    await dragPaletteToCanvas(
      endItem,
      canvas,
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2,
    );

    const nodeLocator = page.locator(".react-flow__node[data-id]");
    await expect(nodeLocator).toHaveCount(1, { timeout: 5000 });

    // Click to select
    await nodeLocator.click();

    // Focus canvas and press Backspace
    await canvas.focus();
    await page.keyboard.press("Backspace");

    // Node removed
    await expect(nodeLocator).toHaveCount(0, { timeout: 5000 });
  });
});

test.describe("Pan/zoom/fit-view — viewport persists across reload", () => {
  test.beforeEach(async ({ page }) => {
    // Clear viewport localStorage before each test
    await page["goto"]("/");
    await page.evaluate(() => {
      localStorage.removeItem("agent-fabric:viewport");
    });
    await page.reload();
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("wheel zoom changes viewport zoom level", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;

    // Read initial viewport transform
    const initialTransform = await page.evaluate(() => {
      const pane = document.querySelector(".react-flow__viewport");
      return pane ? getComputedStyle(pane).transform : "";
    });

    // Ctrl+wheel zoom in (panOnScroll mode requires Ctrl for zoom)
    await page.mouse.move(cx, cy);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -300);
    await page.keyboard.up("Control");
    await page.waitForTimeout(500);

    // Viewport transform should have changed
    const afterTransform = await page.evaluate(() => {
      const pane = document.querySelector(".react-flow__viewport");
      return pane ? getComputedStyle(pane).transform : "";
    });

    expect(afterTransform).not.toBe(initialTransform);
  });

  test("fit-view button adjusts viewport", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drop a node so fit-view has something to fit to
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2,
    );
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });

    // Read current viewport transform
    const beforeTransform = await page.evaluate(() => {
      const pane = document.querySelector(".react-flow__viewport");
      return pane ? getComputedStyle(pane).transform : "";
    });

    // Click fit-view button
    const fitViewBtn = page.locator('[data-testid="fit-view"]');
    await fitViewBtn.click();
    await page.waitForTimeout(500);

    // Viewport should have changed
    const afterTransform = await page.evaluate(() => {
      const pane = document.querySelector(".react-flow__viewport");
      return pane ? getComputedStyle(pane).transform : "";
    });

    expect(afterTransform).not.toBe(beforeTransform);
  });

  test("viewport persists across page reload", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;

    // Ctrl+wheel zoom to change the viewport from defaults (panOnScroll mode)
    await page.mouse.move(cx, cy);
    await page.keyboard.down("Control");
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(100);
    }
    await page.keyboard.up("Control");
    // Wait for xyflow to settle and onMoveEnd to sync to store → localStorage
    await page.waitForTimeout(1000);

    // Read the saved viewport from localStorage
    const savedBefore = await page.evaluate(() => {
      return localStorage.getItem("agent-fabric:viewport");
    });
    expect(savedBefore).toBeTruthy();
    const vpBefore = JSON.parse(savedBefore as string) as { x: number; y: number; zoom: number };

    // Verify zoom actually changed (should be > 1 after zooming in)
    expect(vpBefore.zoom).toBeGreaterThan(1);

    // Reload the page
    await page.reload();
    await page.waitForSelector('[role="application"][aria-label="Workflow Canvas"]', {
      timeout: 10000,
    });
    await page.waitForTimeout(500);

    // Read viewport from localStorage after reload
    const savedAfter = await page.evaluate(() => {
      return localStorage.getItem("agent-fabric:viewport");
    });
    expect(savedAfter).toBeTruthy();
    const vpAfter = JSON.parse(savedAfter as string) as { x: number; y: number; zoom: number };

    // Viewport should match what was saved before reload
    expect(vpAfter.zoom).toBeCloseTo(vpBefore.zoom, 1);
    expect(vpAfter.x).toBeCloseTo(vpBefore.x, 0);
    expect(vpAfter.y).toBeCloseTo(vpBefore.y, 0);
  });
});
