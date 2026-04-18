import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Known pre-existing structural violations that are not contrast-related
 * and are tracked separately from this accessibility gate.
 */
const EXCLUDED_RULES = ["aria-required-children", "region"];

/** Run axe-core and assert 0 violations, logging details on failure. */
async function assertNoAxeViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).disableRules(EXCLUDED_RULES).analyze();

  if (results.violations.length > 0) {
    const summary = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
      targets: v.nodes.map((n) => n.target),
    }));
    // eslint-disable-next-line no-console
    console.log(`axe violations (${context}):`, JSON.stringify(summary, null, 2));
  }

  expect(results.violations).toEqual([]);
}

// ── Editor view (empty) ──────────────────────────────────────────────

test.describe("Accessibility audit — editor page", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("axe-core reports 0 violations on editor (empty canvas)", async ({ page }) => {
    await assertNoAxeViolations(page, "editor-empty");
  });
});

// ── Run view (editor with running workflow) ──────────────────────────

test.describe("Accessibility audit — run view", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("axe-core reports 0 violations while workflow is running", async ({ page }) => {
    // Add nodes via palette keyboard
    const startOption = page.locator('[role="option"][data-kind="start"]');
    await startOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node-start")).toHaveCount(1, { timeout: 5000 });

    const taskOption = page.locator('[role="option"][data-kind="task"]');
    await taskOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node-task")).toHaveCount(1, { timeout: 5000 });

    const endOption = page.locator('[role="option"][data-kind="end"]');
    await endOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node-end")).toHaveCount(1, { timeout: 5000 });

    // Start a run via test harness
    const runId = "a11y-run-1";
    await page.evaluate((rid) => {
      const harness = (
        window as unknown as { __TEST_HARNESS__: { startRun: (id: string) => void } }
      ).__TEST_HARNESS__;
      harness.startRun(rid);
    }, runId);

    // Collect node IDs and emit started events
    const nodeIds = await page.evaluate(() => {
      const els = document.querySelectorAll(".react-flow__node[data-id]");
      return Array.from(els).map((el) => el.getAttribute("data-id") ?? "");
    });

    for (let i = 0; i < nodeIds.length; i++) {
      await page.evaluate(
        (ev) => {
          const harness = (
            window as unknown as {
              __TEST_HARNESS__: { emit: (e: typeof ev) => void };
            }
          ).__TEST_HARNESS__;
          harness.emit(ev);
        },
        { type: "node.started", runId, nodeId: nodeIds[i], at: 1000 + i * 100 },
      );
    }

    await page.waitForTimeout(300);

    // Verify running badges are visible
    const runningBadge = page.locator('[data-testid="status-badge"][data-status="running"]');
    await expect(runningBadge.first()).toBeVisible({ timeout: 5000 });

    // Scan for a11y violations while nodes show running state
    await assertNoAxeViolations(page, "run-view-running");

    // Transition to success
    for (let i = 0; i < nodeIds.length; i++) {
      await page.evaluate(
        (ev) => {
          const harness = (
            window as unknown as {
              __TEST_HARNESS__: { emit: (e: typeof ev) => void };
            }
          ).__TEST_HARNESS__;
          harness.emit(ev);
        },
        { type: "node.succeeded", runId, nodeId: nodeIds[i], at: 2000 + i * 100 },
      );
    }

    await page.waitForTimeout(300);

    // Scan for a11y violations after success
    await assertNoAxeViolations(page, "run-view-success");
  });
});

// ── Imported workflow view (editor with pre-loaded graph) ────────────

test.describe("Accessibility audit — imported workflow view", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("axe-core reports 0 violations on imported workflow with nodes and edges", async ({
    page,
  }) => {
    // Build a small workflow: start → task → end
    const startOption = page.locator('[role="option"][data-kind="start"]');
    await startOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node-start")).toHaveCount(1, { timeout: 5000 });

    const taskOption = page.locator('[role="option"][data-kind="task"]');
    await taskOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node-task")).toHaveCount(1, { timeout: 5000 });

    const endOption = page.locator('[role="option"][data-kind="end"]');
    await endOption.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node-end")).toHaveCount(1, { timeout: 5000 });

    // Connect start → task via keyboard
    const startNode = page.locator(".react-flow__node-start");
    const startHandle = startNode.locator("[data-port-id]").first();
    await expect(startHandle).toBeVisible({ timeout: 5000 });
    await startHandle.focus({ timeout: 5000 });
    await page.keyboard.press("Enter");
    const announcement = page.locator('[data-testid="connect-announcement"]');
    await expect(announcement).not.toBeEmpty({ timeout: 3000 });
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, { timeout: 5000 });

    // Connect task → end via keyboard
    const taskNode = page.locator(".react-flow__node-task");
    const taskHandle = taskNode.locator(".source[data-port-id]").first();
    await expect(taskHandle).toBeVisible({ timeout: 5000 });
    await taskHandle.focus({ timeout: 5000 });
    await page.keyboard.press("Enter");
    await expect(announcement).not.toBeEmpty({ timeout: 3000 });
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__edge")).toHaveCount(2, { timeout: 5000 });

    // Save the workflow
    const saveBtn = page.locator('[data-testid="save-button"]');
    await saveBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Reload to simulate "imported" / restored workflow
    await page.reload();
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });

    // Verify the workflow was restored
    await expect(page.locator(".react-flow__node[data-id]")).toHaveCount(3, { timeout: 5000 });
    await expect(page.locator(".react-flow__edge")).toHaveCount(2, { timeout: 5000 });

    // Select a node to show property grid content
    const restoredNode = page.locator(".react-flow__node-task");
    await restoredNode.click({ force: true });
    await page.waitForTimeout(300);

    // Scan for a11y violations on the restored workflow view
    await assertNoAxeViolations(page, "imported-workflow-view");
  });
});
