import { test, expect, type Locator, type Page } from "@playwright/test";

// ── Helpers ────────────────────────────────────────────────────────────

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

/** Drop N task nodes across the canvas. */
async function dropTaskNodes(page: Page, count: number) {
  const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
  await expect(canvas).toBeVisible();
  const canvasBox = await getBox(canvas);

  const taskItem = page.locator('[role="option"][data-kind="task"]');
  await expect(taskItem).toBeVisible();

  for (let i = 0; i < count; i++) {
    const dropX = canvasBox.x + ((i + 1) * canvasBox.width) / (count + 1);
    const dropY = canvasBox.y + canvasBox.height / 2;
    await dragPaletteToCanvas(taskItem, canvas, dropX, dropY);
  }

  // Wait for all nodes to render
  const nodes = page.locator(".react-flow__node[data-id]");
  await expect(nodes).toHaveCount(count, { timeout: 10000 });

  // Collect node IDs
  const nodeIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = await nodes.nth(i).getAttribute("data-id");
    if (id) nodeIds.push(id);
  }
  return nodeIds;
}

/** Start a run via the test harness. */
async function startRun(page: Page, runId: string) {
  await page.evaluate((rid) => {
    const harness = (window as unknown as { __TEST_HARNESS__: { startRun: (id: string) => void } })
      .__TEST_HARNESS__;
    harness.startRun(rid);
  }, runId);
}

/** Emit an execution event via the test harness. */
async function emitEvent(
  page: Page,
  event: {
    type: string;
    runId: string;
    nodeId?: string;
    at: number;
    payload?: Record<string, unknown>;
  },
) {
  await page.evaluate((ev) => {
    const harness = (
      window as unknown as {
        __TEST_HARNESS__: { emit: (e: typeof ev) => void };
      }
    ).__TEST_HARNESS__;
    harness.emit(ev);
  }, event);
}

/** Get the badge data-status attribute for a node, or null if no badge. */
async function getBadgeStatus(page: Page, nodeId: string): Promise<string | null> {
  return page.evaluate((nid) => {
    const nodeEl = document.querySelector(`[data-id="${nid}"]`);
    if (!nodeEl) return null;
    const badge = nodeEl.querySelector('[data-testid="status-badge"]');
    if (!badge) return null;
    return badge.getAttribute("data-status");
  }, nodeId);
}

// ── Test suite ─────────────────────────────────────────────────────────

test.describe("E2E: Scripted 5-node run — running → success", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("5 nodes transition running → success via FakeExecutionEventSource", async ({ page }) => {
    const RUN_ID = "e2e-run-1";
    const nodeIds = await dropTaskNodes(page, 5);
    expect(nodeIds).toHaveLength(5);

    // Start the run
    await startRun(page, RUN_ID);

    // Initially no badges should be visible (nodes haven't received events yet)
    for (const nodeId of nodeIds) {
      const status = await getBadgeStatus(page, nodeId);
      expect(status).toBeNull();
    }

    // Emit node.started for each node sequentially and verify running badge
    for (let i = 0; i < nodeIds.length; i++) {
      await emitEvent(page, {
        type: "node.started",
        runId: RUN_ID,
        nodeId: nodeIds[i],
        at: 1000 + i * 100,
      });

      // Wait for React to re-render
      await page.waitForTimeout(100);

      const status = await getBadgeStatus(page, nodeIds[i]);
      expect(status).toBe("running");
    }

    // Verify all nodes show running
    for (const nodeId of nodeIds) {
      const status = await getBadgeStatus(page, nodeId);
      expect(status).toBe("running");
    }

    // Emit node.succeeded for each node and verify success badge
    for (let i = 0; i < nodeIds.length; i++) {
      await emitEvent(page, {
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: nodeIds[i],
        at: 2000 + i * 100,
      });

      await page.waitForTimeout(100);

      const status = await getBadgeStatus(page, nodeIds[i]);
      expect(status).toBe("success");
    }

    // Final verification: all 5 show success
    for (const nodeId of nodeIds) {
      const status = await getBadgeStatus(page, nodeId);
      expect(status).toBe("success");
    }

    // Verify badge labels are visible in the DOM
    const successBadges = page.locator('[data-testid="status-badge"][data-status="success"]');
    await expect(successBadges).toHaveCount(5);
  });

  test("nodes show running badge text while in progress", async ({ page }) => {
    const RUN_ID = "e2e-run-2";
    const nodeIds = await dropTaskNodes(page, 5);

    await startRun(page, RUN_ID);

    // Start all 5 nodes
    for (let i = 0; i < nodeIds.length; i++) {
      await emitEvent(page, {
        type: "node.started",
        runId: RUN_ID,
        nodeId: nodeIds[i],
        at: 1000 + i * 50,
      });
    }

    await page.waitForTimeout(200);

    // All running badges should display "Running" text
    const runningBadges = page.locator('[data-testid="badge-label"]');
    const runningTexts: string[] = [];
    for (let i = 0; i < 5; i++) {
      const text = await runningBadges.nth(i).textContent();
      runningTexts.push(text ?? "");
    }
    expect(runningTexts.every((t) => t === "Running")).toBe(true);
  });

  test("succeed nodes one by one — partial running / partial success", async ({ page }) => {
    const RUN_ID = "e2e-run-3";
    const nodeIds = await dropTaskNodes(page, 5);

    await startRun(page, RUN_ID);

    // Start all 5
    for (let i = 0; i < nodeIds.length; i++) {
      await emitEvent(page, {
        type: "node.started",
        runId: RUN_ID,
        nodeId: nodeIds[i],
        at: 1000 + i * 50,
      });
    }
    await page.waitForTimeout(200);

    // Succeed first 3, leave last 2 running
    for (let i = 0; i < 3; i++) {
      await emitEvent(page, {
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: nodeIds[i],
        at: 2000 + i * 100,
      });
    }
    await page.waitForTimeout(200);

    // First 3: success, last 2: running
    for (let i = 0; i < 3; i++) {
      expect(await getBadgeStatus(page, nodeIds[i])).toBe("success");
    }
    for (let i = 3; i < 5; i++) {
      expect(await getBadgeStatus(page, nodeIds[i])).toBe("running");
    }

    // Succeed the remaining
    for (let i = 3; i < 5; i++) {
      await emitEvent(page, {
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: nodeIds[i],
        at: 3000 + i * 100,
      });
    }
    await page.waitForTimeout(200);

    for (const nodeId of nodeIds) {
      expect(await getBadgeStatus(page, nodeId)).toBe("success");
    }
  });
});

// ── Loop iteration badge E2E ──────────────────────────────────────────

/** Get the iteration badge text for a node, or null if no badge. */
async function getIterationText(page: Page, nodeId: string): Promise<string | null> {
  return page.evaluate((nid) => {
    const nodeEl = document.querySelector(`[data-id="${nid}"]`);
    if (!nodeEl) return null;
    const text = nodeEl.querySelector('[data-testid="iteration-text"]');
    if (!text) return null;
    return text.textContent;
  }, nodeId);
}

test.describe("E2E: Loop node iteration badge increments across 3 iterations", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("iteration badge shows 1/?, 2/?, 3/? across 3 iterations", async ({ page }) => {
    const RUN_ID = "e2e-loop-1";
    const nodeIds = await dropTaskNodes(page, 1);
    expect(nodeIds).toHaveLength(1);
    const nodeId = nodeIds[0] as string;

    await startRun(page, RUN_ID);

    // Iteration 1: node.started with iteration=1
    await emitEvent(page, {
      type: "node.started",
      runId: RUN_ID,
      nodeId,
      at: 1000,
      payload: { iteration: 1 },
    });
    await page.waitForTimeout(200);

    expect(await getIterationText(page, nodeId)).toBe("1 / ?");
    expect(await getBadgeStatus(page, nodeId)).toBe("running");

    // Complete iteration 1, start iteration 2
    await emitEvent(page, {
      type: "node.succeeded",
      runId: RUN_ID,
      nodeId,
      at: 1500,
    });
    await emitEvent(page, {
      type: "node.started",
      runId: RUN_ID,
      nodeId,
      at: 2000,
      payload: { iteration: 2 },
    });
    await page.waitForTimeout(200);

    expect(await getIterationText(page, nodeId)).toBe("2 / ?");
    expect(await getBadgeStatus(page, nodeId)).toBe("running");

    // Complete iteration 2, start iteration 3
    await emitEvent(page, {
      type: "node.succeeded",
      runId: RUN_ID,
      nodeId,
      at: 2500,
    });
    await emitEvent(page, {
      type: "node.started",
      runId: RUN_ID,
      nodeId,
      at: 3000,
      payload: { iteration: 3 },
    });
    await page.waitForTimeout(200);

    expect(await getIterationText(page, nodeId)).toBe("3 / ?");
    expect(await getBadgeStatus(page, nodeId)).toBe("running");

    // Final succeed
    await emitEvent(page, {
      type: "node.succeeded",
      runId: RUN_ID,
      nodeId,
      at: 3500,
    });
    await page.waitForTimeout(200);

    expect(await getBadgeStatus(page, nodeId)).toBe("success");
  });

  test("iteration badge is not present for non-loop nodes", async ({ page }) => {
    const RUN_ID = "e2e-loop-2";
    const nodeIds = await dropTaskNodes(page, 1);
    const nodeId = nodeIds[0] as string;

    await startRun(page, RUN_ID);

    // Start without iteration payload — not a loop node
    await emitEvent(page, {
      type: "node.started",
      runId: RUN_ID,
      nodeId,
      at: 1000,
    });
    await page.waitForTimeout(200);

    // Iteration badge should not be present
    expect(await getIterationText(page, nodeId)).toBeNull();
    // Status badge should still be running
    expect(await getBadgeStatus(page, nodeId)).toBe("running");
  });

  test("iteration badge updates in real-time as iterations progress", async ({ page }) => {
    const RUN_ID = "e2e-loop-3";
    const nodeIds = await dropTaskNodes(page, 1);
    const nodeId = nodeIds[0] as string;

    await startRun(page, RUN_ID);

    // Emit all 3 iterations rapidly
    for (let i = 1; i <= 3; i++) {
      if (i > 1) {
        await emitEvent(page, {
          type: "node.succeeded",
          runId: RUN_ID,
          nodeId,
          at: 1000 + (i - 1) * 1000 - 500,
        });
      }
      await emitEvent(page, {
        type: "node.started",
        runId: RUN_ID,
        nodeId,
        at: 1000 + (i - 1) * 1000,
        payload: { iteration: i },
      });
    }
    await page.waitForTimeout(200);

    // After rapid updates, should show the latest iteration
    expect(await getIterationText(page, nodeId)).toBe("3 / ?");

    // Iteration badge icon should be visible
    const iterationBadge = page.locator(`[data-id="${nodeId}"] [data-testid="iteration-badge"]`);
    await expect(iterationBadge).toBeVisible();
  });
});
