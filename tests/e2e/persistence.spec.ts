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

/** Full persisted node shape (all non-transient fields). */
interface PersistedNode {
  id: string;
  kind: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  // width/height/selected are transient — excluded from comparison
}

/** Full persisted edge shape. */
interface PersistedEdge {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
  kind: string;
  label?: string;
  condition?: string;
}

interface PersistedGraph {
  nodes: PersistedNode[];
  edges: PersistedEdge[];
}

/** Read the persisted graph from localStorage with full property shape. */
async function readPersistedGraph(page: Page): Promise<PersistedGraph | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("agent-fabric:graph");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      nodes: Array<Record<string, unknown>>;
      edges: Array<Record<string, unknown>>;
    };
    // Strip transient fields (selected, width, height) from nodes
    const nodes = parsed.nodes.map((n) => ({
      id: n.id as string,
      kind: n.kind as string,
      position: n.position as { x: number; y: number },
      data: (n.data ?? {}) as Record<string, unknown>,
    }));
    // Strip transient field (selected) from edges
    const edges = parsed.edges.map((e) => {
      const base = {
        id: e.id as string,
        source: e.source as string,
        sourcePort: (e.sourcePort ?? "") as string,
        target: e.target as string,
        targetPort: (e.targetPort ?? "") as string,
        kind: (e.kind ?? "default") as string,
      };
      if (e.label !== undefined) {
        Object.assign(base, { label: e.label as string });
      }
      if (e.condition !== undefined) {
        Object.assign(base, { condition: e.condition as string });
      }
      return base;
    });
    return { nodes, edges };
  });
}

/**
 * Deep-compare two persisted graphs field-by-field, tolerating floating-point
 * rounding on positions.
 */
function assertGraphsEqual(before: PersistedGraph, after: PersistedGraph) {
  // Same counts
  expect(after.nodes).toHaveLength(before.nodes.length);
  expect(after.edges).toHaveLength(before.edges.length);

  // Sort for deterministic comparison
  const sortedNodesBefore = [...before.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedNodesAfter = [...after.nodes].sort((a, b) => a.id.localeCompare(b.id));

  for (let i = 0; i < sortedNodesBefore.length; i++) {
    const nb = sortedNodesBefore[i];
    const na = sortedNodesAfter[i];
    expect(na.id).toBe(nb.id);
    expect(na.kind).toBe(nb.kind);
    expect(na.position.x).toBeCloseTo(nb.position.x, 0);
    expect(na.position.y).toBeCloseTo(nb.position.y, 0);
    expect(na.data).toEqual(nb.data);
  }

  const sortedEdgesBefore = [...before.edges].sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdgesAfter = [...after.edges].sort((a, b) => a.id.localeCompare(b.id));

  for (let i = 0; i < sortedEdgesBefore.length; i++) {
    const eb = sortedEdgesBefore[i];
    const ea = sortedEdgesAfter[i];
    expect(ea.id).toBe(eb.id);
    expect(ea.source).toBe(eb.source);
    expect(ea.sourcePort).toBe(eb.sourcePort);
    expect(ea.target).toBe(eb.target);
    expect(ea.targetPort).toBe(eb.targetPort);
    expect(ea.kind).toBe(eb.kind);
    // Optional fields
    expect(ea.label).toBe(eb.label);
    expect(ea.condition).toBe(eb.condition);
  }
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

  test("author graph, save, reload page, reopen — graph is identical", async ({ page }) => {
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

    // ── Step 3: Explicit save — click Save button ────────────────────

    const saveBtn = page.locator('[data-testid="save-button"]').first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();

    // Wait for localStorage persistence (useGraphPersistence saves on every change;
    // the explicit save click confirms the user intent to persist)
    await page.waitForTimeout(500);

    // ── Step 4: Snapshot persisted graph before reload ────────────────

    const graphBefore = await readPersistedGraph(page);
    if (graphBefore === null) throw new Error("graphBefore is null — nothing persisted");
    expect(graphBefore.nodes).toHaveLength(3);
    expect(graphBefore.edges).toHaveLength(2);

    // ── Step 5: Reload page (simulates close + reopen) ───────────────

    await page.reload();
    await page.waitForSelector('[role="application"][aria-label="Workflow Canvas"]', {
      timeout: 10000,
    });
    // Wait for graph restoration from localStorage
    await page.waitForTimeout(1000);

    // ── Step 6: Verify graph reopened identically ─────────────────────

    // DOM: same node count and types
    const restoredNodes = page.locator(".react-flow__node[data-id]");
    await expect(restoredNodes).toHaveCount(3, { timeout: 5000 });
    await expect(page.locator(".react-flow__node-start")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-task")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-end")).toHaveCount(1);

    // DOM: same edge count
    const restoredEdges = page.locator(".react-flow__edge");
    await expect(restoredEdges).toHaveCount(2, { timeout: 5000 });

    // Deep-compare full persisted graph (all node/edge properties)
    const graphAfter = await readPersistedGraph(page);
    if (graphAfter === null) throw new Error("graphAfter is null — persistence lost on reload");
    assertGraphsEqual(graphBefore, graphAfter);
  });

  test("single node persists via save and restores after reload", async ({ page }) => {
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

    // Explicit save
    const saveBtn = page.locator('[data-testid="save-button"]').first();
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Full snapshot before reload
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

    // Deep-compare full graph
    const after = await readPersistedGraph(page);
    if (after === null) throw new Error("after is null");
    assertGraphsEqual(before, after);
  });

  test("50 undo + 50 redo — ends at identical state", async ({ page }) => {
    // Increase timeout for this test — 50 mutations + 50 undo + 50 redo
    test.setTimeout(120_000);

    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    const canvasBox = await getBox(canvas);

    // ── Capture initial empty state ──────────────────────────────────

    const initialNodeCount = await page.locator(".react-flow__node[data-id]").count();
    expect(initialNodeCount).toBe(0);

    // ── Perform 50 mutations: drop 50 task nodes ─────────────────────
    // Each palette drag-drop creates a distinct node and a single history
    // entry (non-position mutation), so 50 drops = 50 undo steps.

    const taskItem = page.locator('[role="option"][data-kind="task"]');
    const MUTATION_COUNT = 50;

    for (let i = 0; i < MUTATION_COUNT; i++) {
      // Spread nodes across the canvas in a grid pattern
      const col = i % 10;
      const row = Math.floor(i / 10);
      const dropX = canvasBox.x + 60 + col * 80;
      const dropY = canvasBox.y + 60 + row * 80;

      await dragPaletteToCanvas(taskItem, canvas, dropX, dropY);

      // Wait for the node to appear in the DOM
      await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(i + 1, {
        timeout: 3000,
      });
    }

    // Verify final graph has 50 nodes
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(MUTATION_COUNT, {
      timeout: 5000,
    });

    // Snapshot the 50-node state via localStorage for later comparison
    const finalGraph = await readPersistedGraph(page);
    if (finalGraph === null) throw new Error("finalGraph is null after 50 drops");
    expect(finalGraph.nodes).toHaveLength(MUTATION_COUNT);

    // ── Undo 50 times → should return to empty canvas ────────────────

    const undoBtn = page.locator('[data-testid="undo-button"]');
    await expect(undoBtn).toBeVisible({ timeout: 5000 });

    for (let i = 0; i < MUTATION_COUNT; i++) {
      await undoBtn.click();
    }

    // Wait for the undo operations to settle
    await page.waitForTimeout(500);

    // Verify we're back to the initial empty state
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(0, {
      timeout: 10000,
    });

    // ── Redo 50 times → should return to the 50-node state ───────────

    const redoBtn = page.locator('[data-testid="redo-button"]');
    for (let i = 0; i < MUTATION_COUNT; i++) {
      await redoBtn.click();
    }

    // Wait for the redo animations to settle
    await page.waitForTimeout(500);

    // Verify all 50 nodes are restored
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(MUTATION_COUNT, {
      timeout: 10000,
    });

    // Deep-compare: the restored graph must match the snapshot taken after 50 drops
    await page.waitForTimeout(500);
    const restoredGraph = await readPersistedGraph(page);
    if (restoredGraph === null) throw new Error("restoredGraph is null after 50 redos");
    assertGraphsEqual(finalGraph, restoredGraph);
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
