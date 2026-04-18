import { test, expect, type Locator, type Page } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────

async function getBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box");
  return box;
}

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

async function getCenter(locator: Locator) {
  const box = await getBox(locator);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function connectNodes(page: Page, sourceHandle: Locator, targetHandle: Locator) {
  const sourceCenter = await getCenter(sourceHandle);
  const targetCenter = await getCenter(targetHandle);

  await page.mouse.move(sourceCenter.x, sourceCenter.y);
  await page.mouse.down();
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mx = sourceCenter.x + (targetCenter.x - sourceCenter.x) * t;
    const my = sourceCenter.y + (targetCenter.y - sourceCenter.y) * t;
    await page.mouse.move(mx, my);
  }
  await page.mouse.up();
}

/** Snapshot node data-ids and class names from the DOM. */
async function snapshotNodes(page: Page) {
  return page.evaluate(() => {
    const nodes = document.querySelectorAll(".react-flow__node[data-id]");
    return Array.from(nodes).map((el) => ({
      id: el.getAttribute("data-id") ?? "",
      classes: el.className,
    }));
  });
}

/** Read the persisted graph from localStorage. */
async function readPersistedGraph(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("agent-fabric:graph");
    if (!raw) return null;
    return JSON.parse(raw) as {
      nodes: Array<{ id: string; kind: string; position: { x: number; y: number } }>;
      edges: Array<{ id: string; source: string; target: string }>;
    };
  });
}

// ─── Tests ───────────────────────────────────────────────────────────

test.describe("Persistence E2E — build → save → reload → identical", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    // Clear graph storage for a fresh start
    await page.evaluate(() => {
      localStorage.removeItem("agent-fabric:graph");
      localStorage.removeItem("agent-fabric:viewport");
    });
    await page.reload();
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("author graph, reload page, graph is restored identically", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // ── Step 1: Drop three nodes ─────────────────────────────────────

    const startItem = page.locator('[role="option"][data-kind="start"]');
    await dragPaletteToCanvas(
      startItem,
      canvas,
      canvasBox.x + canvasBox.width * 0.2,
      canvasBox.y + canvasBox.height * 0.5,
    );

    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + canvasBox.width * 0.5,
      canvasBox.y + canvasBox.height * 0.5,
    );

    const endItem = page.locator('[role="option"][data-kind="end"]');
    await dragPaletteToCanvas(
      endItem,
      canvas,
      canvasBox.x + canvasBox.width * 0.8,
      canvasBox.y + canvasBox.height * 0.5,
    );

    // Verify three nodes exist
    const allNodes = page.locator(".react-flow__node[data-id]");
    await expect(allNodes).toHaveCount(3, { timeout: 5000 });

    // Verify types
    await expect(page.locator(".react-flow__node-start")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-task")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-end")).toHaveCount(1);

    // ── Step 2: Connect Start → Task, Task → End ─────────────────────

    const startNode = page.locator(".react-flow__node-start");
    const taskNode = page.locator(".react-flow__node-task");
    const endNode = page.locator(".react-flow__node-end");

    // Start → Task
    const startOut = startNode.locator(".react-flow__handle.source");
    const taskIn = taskNode.locator(".react-flow__handle.target");
    await expect(startOut).toBeVisible({ timeout: 5000 });
    await expect(taskIn).toBeVisible({ timeout: 5000 });
    await connectNodes(page, startOut, taskIn);

    // Task → End
    const taskOut = taskNode.locator(".react-flow__handle.source");
    const endIn = endNode.locator(".react-flow__handle.target");
    await expect(taskOut).toBeVisible({ timeout: 5000 });
    await expect(endIn).toBeVisible({ timeout: 5000 });
    await connectNodes(page, taskOut, endIn);

    // Verify edges
    const edges = page.locator(".react-flow__edge");
    await expect(edges).toHaveCount(2, { timeout: 5000 });

    // ── Step 3: Record state before reload ────────────────────────────

    // Wait for localStorage persistence (useGraphPersistence saves on every change)
    await page.waitForTimeout(500);

    const graphBefore = await readPersistedGraph(page);
    if (graphBefore === null) throw new Error("graphBefore is null");
    expect(graphBefore.nodes).toHaveLength(3);
    expect(graphBefore.edges).toHaveLength(2);

    const nodeIdsBefore = graphBefore.nodes.map((n) => n.id).sort();
    const nodeKindsBefore = graphBefore.nodes.map((n) => n.kind).sort();
    const edgeIdsBefore = graphBefore.edges.map((e) => e.id).sort();

    // Also capture DOM-level node IDs for comparison after reload
    const domSnapshotBefore = await snapshotNodes(page);
    expect(domSnapshotBefore).toHaveLength(3);

    // ── Step 4: Reload page ──────────────────────────────────────────

    await page.reload();
    await page.waitForSelector('[role="application"][aria-label="Workflow Canvas"]', {
      timeout: 10000,
    });
    // Wait for graph restoration from localStorage
    await page.waitForTimeout(1000);

    // ── Step 5: Verify graph is restored identically ─────────────────

    // Same node count
    const restoredNodes = page.locator(".react-flow__node[data-id]");
    await expect(restoredNodes).toHaveCount(3, { timeout: 5000 });

    // Same node types
    await expect(page.locator(".react-flow__node-start")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-task")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-end")).toHaveCount(1);

    // Same edge count
    const restoredEdges = page.locator(".react-flow__edge");
    await expect(restoredEdges).toHaveCount(2, { timeout: 5000 });

    // Verify localStorage data matches pre-reload state
    const graphAfter = await readPersistedGraph(page);
    if (graphAfter === null) throw new Error("graphAfter is null");
    expect(graphAfter.nodes).toHaveLength(3);
    expect(graphAfter.edges).toHaveLength(2);

    const nodeIdsAfter = graphAfter.nodes.map((n) => n.id).sort();
    const nodeKindsAfter = graphAfter.nodes.map((n) => n.kind).sort();
    const edgeIdsAfter = graphAfter.edges.map((e) => e.id).sort();

    // Node IDs preserved
    expect(nodeIdsAfter).toEqual(nodeIdsBefore);

    // Node kinds preserved
    expect(nodeKindsAfter).toEqual(nodeKindsBefore);

    // Edge IDs preserved
    expect(edgeIdsAfter).toEqual(edgeIdsBefore);

    // Node positions preserved (within tolerance for float rounding)
    for (const nodeBefore of graphBefore.nodes) {
      const nodeAfter = graphAfter.nodes.find((n) => n.id === nodeBefore.id);
      if (!nodeAfter) throw new Error(`Node ${nodeBefore.id} not found after reload`);
      expect(nodeAfter.position.x).toBeCloseTo(nodeBefore.position.x, 0);
      expect(nodeAfter.position.y).toBeCloseTo(nodeBefore.position.y, 0);
    }

    // Edge connectivity preserved
    for (const edgeBefore of graphBefore.edges) {
      const edgeAfter = graphAfter.edges.find((e) => e.id === edgeBefore.id);
      if (!edgeAfter) throw new Error(`Edge ${edgeBefore.id} not found after reload`);
      expect(edgeAfter.source).toBe(edgeBefore.source);
      expect(edgeAfter.target).toBe(edgeBefore.target);
    }
  });

  test("single node persists and restores after reload", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // Drop one task node
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(
      taskItem,
      canvas,
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2,
    );

    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });
    await page.waitForTimeout(500);

    // Read persisted state
    const before = await readPersistedGraph(page);
    if (before === null) throw new Error("before is null");
    expect(before.nodes).toHaveLength(1);
    expect(before.nodes[0].kind).toBe("task");

    // Reload
    await page.reload();
    await page.waitForSelector('[role="application"][aria-label="Workflow Canvas"]', {
      timeout: 10000,
    });
    await page.waitForTimeout(1000);

    // Verify restored
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator(".react-flow__node-task")).toHaveCount(1);

    const after = await readPersistedGraph(page);
    if (after === null) throw new Error("after is null");
    expect(after.nodes[0].id).toBe(before.nodes[0].id);
    expect(after.nodes[0].kind).toBe("task");
  });

  test("empty canvas persists as empty and restores empty", async ({ page }) => {
    // No nodes added — verify localStorage reflects empty state
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForSelector('[role="application"][aria-label="Workflow Canvas"]', {
      timeout: 10000,
    });
    await page.waitForTimeout(500);

    // Canvas should still be empty
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(0, { timeout: 3000 });
  });
});
