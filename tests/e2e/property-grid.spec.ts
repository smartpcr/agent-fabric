import { test, expect, type Locator } from "@playwright/test";

/** Safely get a non-null bounding box from a locator. */
async function getBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box");
  return box;
}

/** Drag a palette item onto the canvas to create a node. */
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

test.describe("Property Grid — edit string field, reload, value persists", () => {
  test.beforeEach(async ({ page }) => {
    // Clear persisted graph state so each test starts fresh
    await page["goto"]("/");
    await page.evaluate(() => {
      localStorage.removeItem("agent-fabric:graph");
      localStorage.removeItem("agent-fabric:viewport");
    });
    await page.reload();
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("edit name field, reload, value persists", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    await expect(canvas).toBeVisible();
    const canvasBox = await getBox(canvas);
    const dropX = canvasBox.x + canvasBox.width / 2;
    const dropY = canvasBox.y + canvasBox.height / 2;

    // 1. Drag a TaskNode onto the canvas
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(taskItem, canvas, dropX, dropY);

    // 2. Wait for the node to appear
    const newNode = page.locator(".react-flow__node[data-id]");
    await expect(newNode).toHaveCount(1, { timeout: 5000 });

    // 3. Click the node to select it
    await newNode.click();

    // 4. Wait for the property grid form fields to appear
    const propertyGrid = page.locator('[role="complementary"][aria-label="Property Grid"]');
    await expect(propertyGrid).toBeVisible({ timeout: 10000 });

    const nameInput = propertyGrid.locator('[data-testid="field-name"]');
    await expect(nameInput).toBeVisible({ timeout: 10000 });

    // 5. Clear the field and type a new name
    const uniqueName = `Edited-${String(Date.now())}`;
    await nameInput.focus();
    await nameInput.fill(uniqueName);
    // Blur to ensure react-hook-form processes the change
    await nameInput.blur();

    // 6. Wait for the debounce (300ms) + React render cycle + localStorage write
    await page.waitForTimeout(1500);

    // 7. Verify localStorage was updated before reload
    const saved = await page.evaluate(() => localStorage.getItem("agent-fabric:graph"));
    expect(saved).toBeTruthy();
    expect(saved).toContain(uniqueName);

    // 7b. Verify secret fields (e.g. apiKey) are scrubbed in the persisted payload
    // The apiKey value should be the "<secret>" sentinel, not a raw string
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const parsed = JSON.parse(saved!) as { nodes: Array<{ data: { apiKey: string } }> };
    expect(parsed.nodes[0].data.apiKey).toBe("<secret>");

    // 8. Reload the page
    await page.reload();
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });

    // 9. Verify the node was restored on canvas
    const restoredNode = page.locator(".react-flow__node[data-id]");
    await expect(restoredNode).toHaveCount(1, { timeout: 5000 });

    // 10. Click to select the restored node
    await restoredNode.click();

    // 11. Verify property grid shows the edited name
    const restoredGrid = page.locator('[role="complementary"][aria-label="Property Grid"]');
    const restoredNameInput = restoredGrid.locator('[data-testid="field-name"]');
    await expect(restoredNameInput).toBeVisible({ timeout: 10000 });
    await expect(restoredNameInput).toHaveValue(uniqueName);
  });
});

test.describe("Property Grid — invalid number field; Save disabled; correct re-enables", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.evaluate(() => {
      localStorage.removeItem("agent-fabric:graph");
      localStorage.removeItem("agent-fabric:viewport");
    });
    await page.reload();
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("force invalid number, error visible, Save disabled; correct clears error", async ({
    page,
  }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    await expect(canvas).toBeVisible();
    const canvasBox = await getBox(canvas);
    const dropX = canvasBox.x + canvasBox.width / 2;
    const dropY = canvasBox.y + canvasBox.height / 2;

    // 1. Drag a TaskNode onto the canvas
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(taskItem, canvas, dropX, dropY);

    const newNode = page.locator(".react-flow__node[data-id]");
    await expect(newNode).toHaveCount(1, { timeout: 5000 });

    // 2. Click to select the node
    await newNode.click();

    // 3. Wait for property grid to show fields
    const propertyGrid = page.locator('[role="complementary"][aria-label="Property Grid"]');
    await expect(propertyGrid).toBeVisible({ timeout: 10000 });

    const retriesInput = propertyGrid.locator('[data-testid="field-retries"]');
    await expect(retriesInput).toBeVisible({ timeout: 10000 });

    // Verify default value
    await expect(retriesInput).toHaveValue("3");

    // 4. Save button should be enabled initially (no errors)
    const saveBtn = page.locator('[data-testid="save-button"]').first();
    await expect(saveBtn).not.toHaveAttribute("aria-disabled", "true");

    // 5. Force invalid: enter a negative number (fails min(0) constraint)
    await retriesInput.focus();
    await retriesInput.fill("-1");
    await retriesInput.blur();

    // 6. Wait for validation to propagate
    await page.waitForTimeout(1000);

    // 7. Assert error is visible
    const errorEl = propertyGrid.locator('[data-testid="error-retries"]');
    await expect(errorEl).toBeVisible({ timeout: 5000 });

    // 8. Assert Save button has aria-disabled="true"
    await expect(saveBtn).toHaveAttribute("aria-disabled", "true");

    // 9. Correct the value: enter a valid number
    await retriesInput.focus();
    await retriesInput.fill("5");
    await retriesInput.blur();

    // 10. Wait for validation to clear
    await page.waitForTimeout(500);

    // 11. Assert error is gone
    await expect(errorEl).not.toBeVisible();

    // 12. Assert Save button is re-enabled (no aria-disabled)
    await expect(saveBtn).not.toHaveAttribute("aria-disabled", "true");
  });
});

test.describe("Property Grid — array field (add, remove, reorder)", () => {
  test.beforeEach(async ({ page }) => {
    await page["goto"]("/");
    await page.evaluate(() => {
      localStorage.removeItem("agent-fabric:graph");
      localStorage.removeItem("agent-fabric:viewport");
    });
    await page.reload();
    await page.waitForSelector('[role="option"][data-kind="task"]', { timeout: 10000 });
  });

  test("add 3 params items, remove middle, drag to reorder, verify order", async ({ page }) => {
    const canvas = page.locator('[role="application"][aria-label="Workflow Canvas"]');
    await expect(canvas).toBeVisible();
    const canvasBox = await getBox(canvas);
    const dropX = canvasBox.x + canvasBox.width / 2;
    const dropY = canvasBox.y + canvasBox.height / 2;

    // 1. Drag a TaskNode onto the canvas
    const taskItem = page.locator('[role="option"][data-kind="task"]');
    await dragPaletteToCanvas(taskItem, canvas, dropX, dropY);

    const newNode = page.locator(".react-flow__node[data-id]");
    await expect(newNode).toHaveCount(1, { timeout: 5000 });

    // 2. Click to select
    await newNode.click();

    // 3. Wait for property grid
    const propertyGrid = page.locator('[role="complementary"][aria-label="Property Grid"]');
    await expect(propertyGrid).toBeVisible({ timeout: 10000 });

    // 4. Find the params array field
    const paramsField = propertyGrid.locator('[data-testid="array-field-params"]');
    await expect(paramsField).toBeVisible({ timeout: 10000 });

    const addBtn = paramsField.locator('[data-testid="add-params"]');

    // 5. Add 3 items
    await addBtn.click();
    await page.waitForTimeout(200);
    await addBtn.click();
    await page.waitForTimeout(200);
    await addBtn.click();
    await page.waitForTimeout(200);

    // Verify 3 items exist
    const items = paramsField.locator('[role="listitem"]');
    await expect(items).toHaveCount(3, { timeout: 5000 });

    // 6. Type values into each item
    const input0 = paramsField.locator('[data-testid="array-input-params-0"]');
    const input1 = paramsField.locator('[data-testid="array-input-params-1"]');
    const input2 = paramsField.locator('[data-testid="array-input-params-2"]');

    await input0.fill("alpha");
    await input1.fill("beta");
    await input2.fill("gamma");

    // 7. Remove the middle item (index 1 = "beta")
    const removeBtn1 = paramsField.locator('[data-testid="remove-params-1"]');
    await removeBtn1.click();
    await page.waitForTimeout(300);

    // Verify 2 items remain
    await expect(items).toHaveCount(2, { timeout: 5000 });

    // After removing "beta", items should be: ["alpha", "gamma"]
    const updatedInput0 = paramsField.locator('[data-testid="array-input-params-0"]');
    const updatedInput1 = paramsField.locator('[data-testid="array-input-params-1"]');
    await expect(updatedInput0).toHaveValue("alpha");
    await expect(updatedInput1).toHaveValue("gamma");

    // 8. Reorder: drag item 1 ("gamma") above item 0 ("alpha")
    const dragHandle1 = paramsField.locator('[data-testid="drag-handle-params-1"]');
    const dragHandle0 = paramsField.locator('[data-testid="drag-handle-params-0"]');

    const handle1Box = await getBox(dragHandle1);
    const handle0Box = await getBox(dragHandle0);

    // Perform drag: pick up handle1, drag to handle0's position
    await page.mouse.move(
      handle1Box.x + handle1Box.width / 2,
      handle1Box.y + handle1Box.height / 2,
    );
    await page.mouse.down();
    // Move to above handle0 position to trigger reorder
    await page.mouse.move(handle0Box.x + handle0Box.width / 2, handle0Box.y - 5, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // 9. Verify final order: should now be ["gamma", "alpha"]
    const finalInput0 = paramsField.locator('[data-testid="array-input-params-0"]');
    const finalInput1 = paramsField.locator('[data-testid="array-input-params-1"]');
    await expect(finalInput0).toHaveValue("gamma");
    await expect(finalInput1).toHaveValue("alpha");
  });
});
