import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { StoreApi } from "zustand";
import type { TemporalState } from "zundo";
import { z } from "zod";
import { createStore, UNDO_LIMIT, type WorkflowState } from "@/store/createStore";
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

describe("Integration: 50-step undo/redo chain", () => {
  let store: StoreWithTemporal;

  beforeEach(() => {
    vi.useFakeTimers();
    store = createTemporalStore();
    store.temporal.getState().clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("UNDO_LIMIT is 50", () => {
    expect(UNDO_LIMIT).toBe(50);
  });

  it("50 mutations → undo 50 → initial state; redo 50 → final state", () => {
    // Capture the initial state (empty graph)
    const initialNodes = store.getState().nodes;
    const initialEdges = store.getState().edges;
    expect(initialNodes).toHaveLength(0);
    expect(initialEdges).toHaveLength(0);

    // Perform exactly 50 mutations (addNode)
    const nodeIds: string[] = [];
    for (let i = 0; i < UNDO_LIMIT; i++) {
      const node = store.getState().addNode(taskSpec, { x: i * 20, y: i * 10 });
      nodeIds.push(node.id);
    }

    // Verify: 50 nodes present
    expect(store.getState().nodes).toHaveLength(UNDO_LIMIT);

    // Capture the final state snapshot
    const finalNodeIds = store.getState().nodes.map((n) => n.id);
    expect(finalNodeIds).toEqual(nodeIds);

    // Verify: 50 past states
    expect(store.temporal.getState().pastStates).toHaveLength(UNDO_LIMIT);
    expect(store.temporal.getState().futureStates).toHaveLength(0);

    // Undo all 50
    for (let i = 0; i < UNDO_LIMIT; i++) {
      store.temporal.getState().undo();
    }

    // Assert: back to initial state (empty)
    expect(store.getState().nodes).toHaveLength(0);
    expect(store.getState().edges).toHaveLength(0);
    expect(store.temporal.getState().pastStates).toHaveLength(0);
    expect(store.temporal.getState().futureStates).toHaveLength(UNDO_LIMIT);

    // Redo all 50
    for (let i = 0; i < UNDO_LIMIT; i++) {
      store.temporal.getState().redo();
    }

    // Assert: back to final state
    expect(store.getState().nodes).toHaveLength(UNDO_LIMIT);
    const restoredIds = store.getState().nodes.map((n) => n.id);
    expect(restoredIds).toEqual(nodeIds);
    expect(store.temporal.getState().pastStates).toHaveLength(UNDO_LIMIT);
    expect(store.temporal.getState().futureStates).toHaveLength(0);
  });

  it("intermediate undo + new mutation clears future states", () => {
    // Add 50 nodes
    for (let i = 0; i < UNDO_LIMIT; i++) {
      store.getState().addNode(taskSpec, { x: i * 20, y: 0 });
    }
    expect(store.getState().nodes).toHaveLength(UNDO_LIMIT);

    // Undo 10 steps
    for (let i = 0; i < 10; i++) {
      store.temporal.getState().undo();
    }
    expect(store.getState().nodes).toHaveLength(40);
    expect(store.temporal.getState().futureStates).toHaveLength(10);

    // New mutation should clear future states
    store.getState().addNode(taskSpec, { x: 999, y: 999 });
    expect(store.getState().nodes).toHaveLength(41);
    expect(store.temporal.getState().futureStates).toHaveLength(0);
  });

  it("each undo step removes exactly one node", () => {
    // Add 50 nodes
    for (let i = 0; i < UNDO_LIMIT; i++) {
      store.getState().addNode(taskSpec, { x: i * 20, y: 0 });
    }

    // Undo one at a time, verifying node count decreases by 1
    for (let i = UNDO_LIMIT; i > 0; i--) {
      expect(store.getState().nodes).toHaveLength(i);
      store.temporal.getState().undo();
    }
    expect(store.getState().nodes).toHaveLength(0);
  });

  it("each redo step restores exactly one node", () => {
    // Add 50 nodes then undo all
    for (let i = 0; i < UNDO_LIMIT; i++) {
      store.getState().addNode(taskSpec, { x: i * 20, y: 0 });
    }
    for (let i = 0; i < UNDO_LIMIT; i++) {
      store.temporal.getState().undo();
    }
    expect(store.getState().nodes).toHaveLength(0);

    // Redo one at a time, verifying node count increases by 1
    for (let i = 1; i <= UNDO_LIMIT; i++) {
      store.temporal.getState().redo();
      expect(store.getState().nodes).toHaveLength(i);
    }
  });

  it("node positions are preserved through full undo/redo cycle", () => {
    // Add 50 nodes with distinct positions
    const expectedPositions: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < UNDO_LIMIT; i++) {
      const pos = { x: i * 20, y: i * 10 };
      expectedPositions.push(pos);
      store.getState().addNode(taskSpec, pos);
    }

    // Undo all, then redo all
    for (let i = 0; i < UNDO_LIMIT; i++) {
      store.temporal.getState().undo();
    }
    for (let i = 0; i < UNDO_LIMIT; i++) {
      store.temporal.getState().redo();
    }

    // Verify every position is preserved
    const nodes = store.getState().nodes;
    expect(nodes).toHaveLength(UNDO_LIMIT);
    for (let i = 0; i < UNDO_LIMIT; i++) {
      expect(nodes[i].position).toEqual(expectedPositions[i]);
    }
  });
});
