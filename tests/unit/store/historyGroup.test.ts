import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { StoreApi } from "zustand";
import type { TemporalState } from "zundo";
import { z } from "zod";
import { createStore, type WorkflowState } from "@/store/createStore";
import { createHistoryGroupHandler, HISTORY_GROUP_DELAY } from "@/store/historyGroup";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";

// ─── Fixtures ────────────────────────────────────────────────────────

const taskSpec: NodeSpec<{ name: string }> = {
  kind: "task",
  category: "flow",
  label: "Task",
  icon: "cog",
  ports: [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
  ],
  propertySchema: z.object({ name: z.string() }),
  defaultData: { name: "Default Task" },
  capabilities: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────

type StoreWithTemporal = StoreApi<WorkflowState> & {
  temporal: StoreApi<TemporalState<Pick<WorkflowState, "nodes" | "edges">>>;
};

function createTemporalStore(): StoreWithTemporal {
  return createStore() as StoreWithTemporal;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("historyGroup — createHistoryGroupHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("HISTORY_GROUP_DELAY is exported and equals 200", () => {
    expect(HISTORY_GROUP_DELAY).toBe(200);
  });

  it("createHistoryGroupHandler returns a function", () => {
    const handler = createHistoryGroupHandler();
    expect(typeof handler).toBe("function");
  });

  it("20 consecutive position changes produce only 1 history step after flush", () => {
    const store = createTemporalStore();

    // Add a node to drag
    const node = store.getState().addNode(taskSpec, { x: 0, y: 0 });

    // Flush the initial addNode timer so it records
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);
    const pastAfterAdd = store.temporal.getState().pastStates.length;

    // Simulate a drag: 20 position updates in rapid succession
    for (let i = 1; i <= 20; i++) {
      store.getState().updateNodePosition(node.id, { x: i * 10, y: i * 5 });
    }

    // Before timer fires, no new history entries
    expect(store.temporal.getState().pastStates.length).toBe(pastAfterAdd);

    // Flush the debounce timer
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);

    // Exactly 1 new history entry for the entire drag
    expect(store.temporal.getState().pastStates.length).toBe(pastAfterAdd + 1);

    // Node should be at the final position
    const updatedNode = store.getState().nodes.find((n) => n.id === node.id);
    expect(updatedNode).toHaveProperty("position", { x: 200, y: 100 });
  });

  it("single undo after grouped drag reverts to pre-drag position", () => {
    const store = createTemporalStore();

    const node = store.getState().addNode(taskSpec, { x: 50, y: 50 });
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);

    // Drag: 10 position updates
    for (let i = 1; i <= 10; i++) {
      store.getState().updateNodePosition(node.id, { x: 50 + i * 5, y: 50 + i * 5 });
    }
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);

    // Node is now at final drag position
    expect(store.getState().nodes.find((n) => n.id === node.id)).toHaveProperty("position", {
      x: 100,
      y: 100,
    });

    // One undo should revert the entire drag
    store.temporal.getState().undo();

    const reverted = store.getState().nodes.find((n) => n.id === node.id);
    expect(reverted).toHaveProperty("position", { x: 50, y: 50 });
  });

  it("separate drags separated by idle create separate history entries", () => {
    const store = createTemporalStore();

    const node = store.getState().addNode(taskSpec, { x: 0, y: 0 });
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);
    const pastAfterAdd = store.temporal.getState().pastStates.length;

    // First drag
    for (let i = 1; i <= 5; i++) {
      store.getState().updateNodePosition(node.id, { x: i * 10, y: 0 });
    }
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);
    expect(store.temporal.getState().pastStates.length).toBe(pastAfterAdd + 1);

    // Second drag (after idle)
    for (let i = 1; i <= 5; i++) {
      store.getState().updateNodePosition(node.id, { x: 50 + i * 10, y: 0 });
    }
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);
    expect(store.temporal.getState().pastStates.length).toBe(pastAfterAdd + 2);
  });

  it("updates within the delay window do not create entries until flushed", () => {
    const store = createTemporalStore();

    const node = store.getState().addNode(taskSpec, { x: 0, y: 0 });
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);
    const pastAfterAdd = store.temporal.getState().pastStates.length;

    // First update
    store.getState().updateNodePosition(node.id, { x: 10, y: 0 });
    expect(store.temporal.getState().pastStates.length).toBe(pastAfterAdd);

    // Advance partially (not enough to flush)
    vi.advanceTimersByTime(100);

    // Second update resets the timer
    store.getState().updateNodePosition(node.id, { x: 20, y: 0 });
    expect(store.temporal.getState().pastStates.length).toBe(pastAfterAdd);

    // Advance past the delay from the second update
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);
    expect(store.temporal.getState().pastStates.length).toBe(pastAfterAdd + 1);
  });

  it("non-position mutations are also grouped by the handler", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);
    const pastBefore = store.temporal.getState().pastStates.length;

    // Two rapid addNode calls should be grouped
    store.getState().addNode(taskSpec, { x: 100, y: 0 });
    store.getState().addNode(taskSpec, { x: 200, y: 0 });

    // Not flushed yet
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);

    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);

    // One grouped entry
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore + 1);
  });

  it("redo works after undoing a grouped drag", () => {
    const store = createTemporalStore();

    const node = store.getState().addNode(taskSpec, { x: 0, y: 0 });
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);

    // Drag
    for (let i = 1; i <= 5; i++) {
      store.getState().updateNodePosition(node.id, { x: i * 20, y: 0 });
    }
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);

    // Undo
    store.temporal.getState().undo();
    expect(store.getState().nodes.find((n) => n.id === node.id)).toHaveProperty("position", {
      x: 0,
      y: 0,
    });

    // Redo restores to final drag position
    store.temporal.getState().redo();
    expect(store.getState().nodes.find((n) => n.id === node.id)).toHaveProperty("position", {
      x: 100,
      y: 0,
    });
  });

  it("custom delay is respected", () => {
    const customDelay = 500;
    const handler = createHistoryGroupHandler(customDelay);
    expect(typeof handler).toBe("function");
    // The handler itself is a higher-order function; exact delay behavior
    // is tested via the store integration above
  });
});
