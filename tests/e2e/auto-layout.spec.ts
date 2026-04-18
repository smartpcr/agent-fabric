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

interface BoundingRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Check whether two rectangles intersect.
 * A small tolerance (in px) prevents false positives from sub-pixel rounding.
 */
function boxesOverlap(a: BoundingRect, b: BoundingRect, tolerance = 2): boolean {
  return !(
    a.x + a.width <= b.x + tolerance ||
    b.x + b.width <= a.x + tolerance ||
    a.y + a.height <= b.y + tolerance ||
    b.y + b.height <= a.y + tolerance
  );
}

/**
 * 20-node mixed graph — node kinds to drop.
 * Uses all registered builtins: start, end, task, decision,
 * decision-switch, loop-while, loop-foreach.
 */
const NODE_KINDS: readonly string[] = [
  "start",
  "end",
  "task",
  "task",
  "task",
  "task",
  "task",
  "task",
  "task",
  "task",
  "task",
  "task",
  "decision",
  "decision",
  "decision",
  "decision-switch",
  "decision-switch",
  "loop-while",
  "loop-while",
  "loop-foreach",
];

test.describe("Auto-layout — 20-node mixed graph produces no overlap", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("scripted 20-node build → auto-layout → no bounding-box intersections", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    await expect(canvas).toBeVisible();
    const canvasBox = await getBox(canvas);

    // Drop all 20 nodes clustered near the canvas center so they
    // deliberately overlap before auto-layout runs.
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;

    // Deterministic offsets (seeded grid around center) so the test is stable.
    for (let i = 0; i < NODE_KINDS.length; i++) {
      const kind = NODE_KINDS[i] as string;
      const item = page.locator(`[role="option"][data-kind="${kind}"]`);
      await expect(item).toBeVisible({ timeout: 5000 });

      // Small deterministic grid offset (4 columns × 5 rows, 20px apart)
      const col = i % 4;
      const row = Math.floor(i / 4);
      const dropX = cx + (col - 1.5) * 20;
      const dropY = cy + (row - 2) * 20;

      await dragPaletteToCanvas(item, canvas, dropX, dropY);
    }

    // Verify all 20 nodes rendered
    const allNodes = page.locator(".react-flow__node[data-id]");
    await expect(allNodes).toHaveCount(NODE_KINDS.length, { timeout: 10000 });

    // Click auto-layout
    const layoutBtn = page.locator('[data-testid="auto-layout-button"]');
    await expect(layoutBtn).toBeEnabled();
    await layoutBtn.click();

    // Wait for layout to finish (button re-enables after async ELK run)
    await expect(layoutBtn).toBeEnabled({ timeout: 30000 });

    // Allow xyflow to render the repositioned nodes
    await page.waitForTimeout(1000);

    // Collect bounding boxes of all rendered nodes
    const nodeCount = await allNodes.count();
    expect(nodeCount).toBe(NODE_KINDS.length);

    const boxes: BoundingRect[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const box = await allNodes.nth(i).boundingBox();
      if (!box) throw new Error(`Node ${String(i)} has no bounding box`);
      boxes.push(box);
    }

    // Assert no pair of bounding boxes overlap
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j];
        if (a && b && boxesOverlap(a, b)) {
          overlaps.push(
            `Node ${String(i)} (${a.x.toFixed(0)},${a.y.toFixed(0)} ${a.width.toFixed(0)}×${a.height.toFixed(0)}) ` +
              `overlaps Node ${String(j)} (${b.x.toFixed(0)},${b.y.toFixed(0)} ${b.width.toFixed(0)}×${b.height.toFixed(0)})`,
          );
        }
      }
    }

    expect(overlaps).toEqual([]);
  });
});
