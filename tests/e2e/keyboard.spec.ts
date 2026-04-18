import { test, expect, type Page } from "@playwright/test";

/**
 * Press Tab and return the focused element's testid or tag+role for identification.
 */
async function tabForward(page: Page) {
  await page.keyboard.press("Tab");
}

async function shiftTab(page: Page) {
  await page.keyboard.press("Shift+Tab");
}

/** Get a descriptor of the currently focused element for debugging/assertions. */
async function focusedInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return { tag: "none", testid: null, role: null, label: null };
    return {
      tag: el.tagName.toLowerCase(),
      testid: el.getAttribute("data-testid"),
      role: el.getAttribute("role"),
      label: el.getAttribute("aria-label"),
    };
  });
}

// ─── Tests ───────────────────────────────────────────────────────────

test.describe("Keyboard navigation — author + run workflow without mouse", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.evaluate(() => {
      localStorage.removeItem("agent-fabric:graph");
      localStorage.removeItem("agent-fabric:viewport");
    });
    await page.reload();
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("Tab reaches all major regions in sensible order", async ({ page }) => {
    // Tab through the page and collect landmark testids/roles
    const visited: Array<{ testid: string | null; role: string | null; label: string | null }> = [];
    const MAX_TABS = 40;

    for (let i = 0; i < MAX_TABS; i++) {
      await tabForward(page);
      const info = await focusedInfo(page);
      visited.push({ testid: info.testid, role: info.role, label: info.label });

      // Stop once we've cycled through all main areas
      if (info.role === "application" && info.label === "Workflow Canvas") break;
    }

    // Verify we reached: toolbar buttons, palette search, palette listbox, canvas
    const labels = visited.map((v) => v.label).filter(Boolean);
    const testids = visited.map((v) => v.testid).filter(Boolean);

    // Toolbar buttons should be reachable (undo/redo may be disabled and thus skipped)
    expect(testids).toContain("save-button");

    // Palette search input should be reachable
    expect(labels).toContain("Search palette");

    // Canvas should be reachable via Tab (not trapped before it)
    expect(labels).toContain("Workflow Canvas");
  });

  test("no keyboard trap — can Tab past canvas and Shift+Tab back", async ({ page }) => {
    // Focus the canvas
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    await canvas.focus();

    let info = await focusedInfo(page);
    expect(info.label).toBe("Workflow Canvas");

    // Tab past canvas — should reach property grid or another element
    await tabForward(page);
    info = await focusedInfo(page);
    expect(info.label).not.toBe("Workflow Canvas");

    // Shift+Tab back — should return near canvas area
    await shiftTab(page);
    // We don't assert exact element but verify we didn't get stuck
    info = await focusedInfo(page);
    expect(info.tag).not.toBe("none");
  });

  test("Escape closes property grid selection (clears selection)", async ({ page }) => {
    // Add a node via keyboard (palette Enter)
    const paletteListbox = page.locator('[role="listbox"][aria-label="Node types"]');
    await paletteListbox.focus();

    // Focus first palette item and press Enter to add node
    const firstItem = page.locator('[role="option"][data-kind="task"]');
    await firstItem.focus();
    await page.keyboard.press("Enter");

    // Wait for node to appear
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });

    // Click node to select it (this opens property grid)
    const node = page.locator(".react-flow__node[data-id]");
    await node.click();

    // Property grid should be visible
    const propertyGrid = page.locator('[role="complementary"][aria-label="Property Grid"]');
    await expect(propertyGrid).toBeVisible({ timeout: 5000 });

    // Press Escape on the canvas — should clear selection
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    await canvas.focus();
    await page.keyboard.press("Escape");

    // Wait a moment for deselection to propagate
    await page.waitForTimeout(300);

    // Verify no node is selected (property grid shows empty state)
    const selectedNodes = await page.evaluate(() => {
      const els = document.querySelectorAll('.react-flow__node[data-id][data-selected="true"]');
      return els.length;
    });
    // Either 0 selected nodes or selection cleared via Escape on canvas
    expect(selectedNodes).toBeLessThanOrEqual(0);
  });

  test("author workflow using only keyboard — add nodes via palette Enter", async ({ page }) => {
    // Step 1: Focus palette and add a Start node via Enter
    const startOption = page.locator('[role="option"][data-kind="start"]');
    await startOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });

    // Step 2: Add a Task node via palette Enter
    const taskOption = page.locator('[role="option"][data-kind="task"]');
    await taskOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(2, { timeout: 5000 });

    // Step 3: Add an End node via palette Enter
    const endOption = page.locator('[role="option"][data-kind="end"]');
    await endOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(3, { timeout: 5000 });

    // Verify node types
    await expect(page.locator(".react-flow__node-start")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-task")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-end")).toHaveCount(1);
  });

  test("keyboard connect — Enter on source handle initiates connection", async ({ page }) => {
    // Add two nodes via palette
    const startOption = page.locator('[role="option"][data-kind="start"]');
    await startOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });

    const taskOption = page.locator('[role="option"][data-kind="task"]');
    await taskOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(2, { timeout: 5000 });

    // Focus the source (output) handle of the start node
    const startNode = page.locator(".react-flow__node-start");
    const sourceHandle = startNode.locator("[data-port-id]").first();
    await expect(sourceHandle).toBeVisible({ timeout: 5000 });
    await sourceHandle.focus({ timeout: 5000 });

    // Press Enter to enter connect mode
    await page.keyboard.press("Enter");

    // Verify connect-mode announcement appears
    const announcement = page.locator('[data-testid="connect-announcement"]');
    await expect(announcement).not.toBeEmpty({ timeout: 3000 });
    const text = await announcement.textContent();
    expect(text).toContain("Connect mode");

    // Press Enter to confirm connection to first target
    await page.keyboard.press("Enter");

    // Verify edge was created
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, { timeout: 5000 });
  });

  test("keyboard connect — Escape cancels connection mode", async ({ page }) => {
    // Add two nodes
    const startOption = page.locator('[role="option"][data-kind="start"]');
    await startOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });

    const taskOption = page.locator('[role="option"][data-kind="task"]');
    await taskOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(2, { timeout: 5000 });

    // Enter connect mode
    const startNode = page.locator(".react-flow__node-start");
    const sourceHandle = startNode.locator("[data-port-id]").first();
    await expect(sourceHandle).toBeVisible({ timeout: 5000 });
    await sourceHandle.focus({ timeout: 5000 });
    await page.keyboard.press("Enter");

    // Verify connect mode is active
    const announcement = page.locator('[data-testid="connect-announcement"]');
    await expect(announcement).not.toBeEmpty({ timeout: 3000 });

    // Press Escape to cancel
    await page.keyboard.press("Escape");

    // Announcement should indicate cancellation
    await page.waitForTimeout(300);
    const cancelText = await announcement.textContent();
    expect(cancelText).toContain("cancelled");

    // No edge should have been created
    await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  });

  test("Delete key removes selected node", async ({ page }) => {
    // Add a node
    const taskOption = page.locator('[role="option"][data-kind="task"]');
    await taskOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });

    // Click to select the node
    const node = page.locator(".react-flow__node[data-id]");
    await node.click();

    // Focus the canvas and press Delete
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    await canvas.focus();
    await page.keyboard.press("Delete");

    // Node should be removed
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(0, { timeout: 5000 });
  });

  test("Ctrl+Z undoes and Ctrl+Y redoes via keyboard", async ({ page }) => {
    // Add a node
    const taskOption = page.locator('[role="option"][data-kind="task"]');
    await taskOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });

    // Focus canvas to ensure shortcuts work
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    await canvas.focus();

    // Undo — node should be removed
    await page.keyboard.press("Control+z");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(0, { timeout: 5000 });

    // Redo — node should reappear
    await page.keyboard.press("Control+y");
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(1, { timeout: 5000 });
  });

  test("full keyboard-only workflow: add nodes, connect, save", async ({ page }) => {
    // 1. Add Start node via palette keyboard
    const startOption = page.locator('[role="option"][data-kind="start"]');
    await startOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node-start")).toHaveCount(1, { timeout: 5000 });

    // 2. Add Task node
    const taskOption = page.locator('[role="option"][data-kind="task"]');
    await taskOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node-task")).toHaveCount(1, { timeout: 5000 });

    // 3. Add End node
    const endOption = page.locator('[role="option"][data-kind="end"]');
    await endOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node-end")).toHaveCount(1, { timeout: 5000 });

    // 4. Connect Start → Task via keyboard
    const startNode = page.locator(".react-flow__node-start");
    const startSourceHandle = startNode.locator("[data-port-id]").first();
    await expect(startSourceHandle).toBeVisible({ timeout: 5000 });
    await startSourceHandle.focus({ timeout: 5000 });
    await page.keyboard.press("Enter");
    // Wait for connect mode
    const announcement = page.locator('[data-testid="connect-announcement"]');
    await expect(announcement).not.toBeEmpty({ timeout: 3000 });
    // Confirm first target (Task)
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, { timeout: 5000 });

    // 5. Connect Task → End via keyboard
    const taskNode = page.locator(".react-flow__node-task");
    const taskSourceHandle = taskNode.locator(".source[data-port-id]").first();
    await expect(taskSourceHandle).toBeVisible({ timeout: 5000 });
    await taskSourceHandle.focus({ timeout: 5000 });
    await page.keyboard.press("Enter");
    await expect(announcement).not.toBeEmpty({ timeout: 3000 });
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__edge")).toHaveCount(2, { timeout: 5000 });

    // 6. Save via keyboard — Tab to Save button and press Enter
    const saveBtn = page.locator('[data-testid="save-button"]');
    await saveBtn.focus();
    await page.keyboard.press("Enter");

    // 7. Verify the workflow was persisted
    await page.waitForTimeout(500);
    const persisted = await page.evaluate(() => {
      const raw = localStorage.getItem("agent-fabric:graph");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { nodes: unknown[]; edges: unknown[] };
      return { nodeCount: parsed.nodes.length, edgeCount: parsed.edges.length };
    });
    expect(persisted).not.toBeNull();
    if (persisted) {
      expect(persisted.nodeCount).toBe(3);
      expect(persisted.edgeCount).toBe(2);
    }
  });
});
