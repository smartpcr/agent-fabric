import { describe, it, expect } from "vitest";
import type { StoreApi } from "zustand";
import type { TemporalState } from "zundo";
import { z } from "zod";
import { createStore, UNDO_LIMIT, type WorkflowState } from "@/store/createStore";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";

// ─── Fixtures ────────────────────────────────────────────────────────

const emptySchema = z.object({});

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

const startSpec: NodeSpec = {
  kind: "start",
  category: "flow",
  label: "Start",
  icon: "play",
  ports: [makeOutputPort({ id: "out", label: "Out", dataType: "any" })],
  propertySchema: emptySchema,
  defaultData: {},
  capabilities: ["isEntry"],
};

// ─── Helpers ─────────────────────────────────────────────────────────

type StoreWithTemporal = StoreApi<WorkflowState> & {
  temporal: StoreApi<TemporalState<Pick<WorkflowState, "nodes" | "edges">>>;
};

function createTemporalStore(): StoreWithTemporal {
  return createStore() as StoreWithTemporal;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("createStore temporal middleware", () => {
  it("exposes a temporal store with undo and redo functions", () => {
    const store = createTemporalStore();
    const temporal = store.temporal.getState();

    expect(typeof temporal.undo).toBe("function");
    expect(typeof temporal.redo).toBe("function");
    expect(typeof temporal.clear).toBe("function");
  });

  it("pastStates and futureStates start empty", () => {
    const store = createTemporalStore();
    const temporal = store.temporal.getState();

    expect(temporal.pastStates).toHaveLength(0);
    expect(temporal.futureStates).toHaveLength(0);
  });

  it("undo reverts addNode", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 10, y: 20 });
    expect(store.getState().nodes).toHaveLength(1);

    store.temporal.getState().undo();
    expect(store.getState().nodes).toHaveLength(0);
  });

  it("redo re-applies after undo", () => {
    const store = createTemporalStore();

    const node = store.getState().addNode(taskSpec, { x: 10, y: 20 });
    store.temporal.getState().undo();
    expect(store.getState().nodes).toHaveLength(0);

    store.temporal.getState().redo();
    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().nodes[0].id).toBe(node.id);
  });

  it("undo records past state after mutation", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });

    const temporal = store.temporal.getState();
    expect(temporal.pastStates).toHaveLength(1);
  });

  it("redo populates futureStates after undo", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    store.temporal.getState().undo();

    const temporal = store.temporal.getState();
    expect(temporal.futureStates).toHaveLength(1);
  });

  it("multiple undo/redo steps work correctly", () => {
    const store = createTemporalStore();

    // Add 3 nodes
    store.getState().addNode(startSpec, { x: 0, y: 0 });
    store.getState().addNode(taskSpec, { x: 100, y: 0 });
    store.getState().addNode(taskSpec, { x: 200, y: 0 });
    expect(store.getState().nodes).toHaveLength(3);

    // Undo all 3
    store.temporal.getState().undo();
    expect(store.getState().nodes).toHaveLength(2);

    store.temporal.getState().undo();
    expect(store.getState().nodes).toHaveLength(1);

    store.temporal.getState().undo();
    expect(store.getState().nodes).toHaveLength(0);

    // Redo all 3
    store.temporal.getState().redo();
    expect(store.getState().nodes).toHaveLength(1);

    store.temporal.getState().redo();
    expect(store.getState().nodes).toHaveLength(2);

    store.temporal.getState().redo();
    expect(store.getState().nodes).toHaveLength(3);
  });

  it("undo after redo clears future states beyond that point", () => {
    const store = createTemporalStore();

    store.getState().addNode(startSpec, { x: 0, y: 0 });
    store.getState().addNode(taskSpec, { x: 100, y: 0 });

    // Undo once → 1 future state
    store.temporal.getState().undo();
    expect(store.temporal.getState().futureStates).toHaveLength(1);

    // New mutation should clear future states
    store.getState().addNode(taskSpec, { x: 200, y: 0 });
    expect(store.temporal.getState().futureStates).toHaveLength(0);
  });

  it("UNDO_LIMIT is exported and equals 50", () => {
    expect(UNDO_LIMIT).toBe(50);
  });

  it("enforces the undo limit of 50 past states", () => {
    const store = createTemporalStore();

    // Perform more mutations than the limit
    for (let i = 0; i < UNDO_LIMIT + 10; i++) {
      store.getState().addNode(taskSpec, { x: i * 10, y: 0 });
    }

    const pastCount = store.temporal.getState().pastStates.length;
    expect(pastCount).toBeLessThanOrEqual(UNDO_LIMIT);
    expect(pastCount).toBe(UNDO_LIMIT);
  });

  it("undo does nothing when pastStates is empty", () => {
    const store = createTemporalStore();
    const before = store.getState().nodes;

    store.temporal.getState().undo();

    expect(store.getState().nodes).toBe(before);
  });

  it("redo does nothing when futureStates is empty", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    const before = store.getState().nodes;

    store.temporal.getState().redo();

    expect(store.getState().nodes).toBe(before);
  });

  it("clear resets past and future states", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    store.getState().addNode(taskSpec, { x: 100, y: 0 });
    store.temporal.getState().undo();

    expect(store.temporal.getState().pastStates.length).toBeGreaterThan(0);
    expect(store.temporal.getState().futureStates.length).toBeGreaterThan(0);

    store.temporal.getState().clear();

    expect(store.temporal.getState().pastStates).toHaveLength(0);
    expect(store.temporal.getState().futureStates).toHaveLength(0);
  });

  it("removeNode is also tracked by temporal", () => {
    const store = createTemporalStore();

    const node = store.getState().addNode(taskSpec, { x: 0, y: 0 });
    store.getState().removeNode(node.id);
    expect(store.getState().nodes).toHaveLength(0);

    store.temporal.getState().undo();
    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().nodes[0].id).toBe(node.id);
  });
});
