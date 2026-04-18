import { describe, it, expect } from "vitest";
import type { StoreApi } from "zustand";
import type { TemporalState } from "zundo";
import { z } from "zod";
import { createStore, type WorkflowState } from "@/store/createStore";
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

describe("createStore partialize — only graph slice tracked", () => {
  it("selection toggle does not create a history entry", () => {
    const store = createTemporalStore();

    // Add a node so we have something to select
    const node = store.getState().addNode(taskSpec, { x: 0, y: 0 });
    const pastAfterAdd = store.temporal.getState().pastStates.length;

    // Toggle selection — should NOT add a history entry
    store.getState().select(node.id, "replace");
    expect(store.temporal.getState().pastStates.length).toBe(pastAfterAdd);

    // Toggle again
    store.getState().select(node.id, "toggle");
    expect(store.temporal.getState().pastStates.length).toBe(pastAfterAdd);
  });

  it("selectMany does not create a history entry", () => {
    const store = createTemporalStore();

    const n1 = store.getState().addNode(taskSpec, { x: 0, y: 0 });
    const n2 = store.getState().addNode(taskSpec, { x: 100, y: 0 });
    const pastAfter = store.temporal.getState().pastStates.length;

    store.getState().selectMany([n1.id, n2.id]);
    expect(store.temporal.getState().pastStates.length).toBe(pastAfter);
  });

  it("clearSelection does not create a history entry", () => {
    const store = createTemporalStore();

    const node = store.getState().addNode(taskSpec, { x: 0, y: 0 });
    store.getState().select(node.id, "replace");
    const pastBefore = store.temporal.getState().pastStates.length;

    store.getState().clear();
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it("edge selection does not create a history entry", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    const pastBefore = store.temporal.getState().pastStates.length;

    store.getState().selectEdge("some-edge", "replace");
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);

    store.getState().clearEdges();
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it("viewport changes (zoom, pan) do not create history entries", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    const pastBefore = store.temporal.getState().pastStates.length;

    store.getState().setZoom(2);
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);

    store.getState().setPan(100, 200);
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it("snap toggle does not create a history entry", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    const pastBefore = store.temporal.getState().pastStates.length;

    store.getState().toggleSnap();
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it("interactive toggle does not create a history entry", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    const pastBefore = store.temporal.getState().pastStates.length;

    store.getState().toggleInteractive();
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it("inspector open does not create a history entry", () => {
    const store = createTemporalStore();

    const node = store.getState().addNode(taskSpec, { x: 0, y: 0 });
    const pastBefore = store.temporal.getState().pastStates.length;

    store.getState().openInspector(node.id);
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it("execution slice changes do not create history entries", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    const pastBefore = store.temporal.getState().pastStates.length;

    // startExecution changes execution state
    store.getState().startExecution();
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);

    // stopExecution changes execution state
    store.getState().stopExecution();
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);

    // startRun creates a run entry
    store.getState().startRun("run-1");
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it("registry changes do not create history entries", async () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    const pastBefore = store.temporal.getState().pastStates.length;

    // setRegistry changes registry state
    const { NodeRegistry } = await import("@/registry/NodeRegistry");
    store.getState().setRegistry(new NodeRegistry());
    expect(store.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it("graph mutations (addNode) DO create history entries", () => {
    const store = createTemporalStore();

    expect(store.temporal.getState().pastStates).toHaveLength(0);

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    expect(store.temporal.getState().pastStates).toHaveLength(1);

    store.getState().addNode(taskSpec, { x: 100, y: 0 });
    expect(store.temporal.getState().pastStates).toHaveLength(2);
  });

  it("removeNode creates a history entry", () => {
    const store = createTemporalStore();

    const node = store.getState().addNode(taskSpec, { x: 0, y: 0 });
    const pastAfterAdd = store.temporal.getState().pastStates.length;

    store.getState().removeNode(node.id);
    expect(store.temporal.getState().pastStates.length).toBe(pastAfterAdd + 1);
  });

  it("partialize captures only nodes and edges in past states", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });

    const pastState = store.temporal.getState().pastStates[0];
    const keys = Object.keys(pastState);

    // Only nodes and edges should be in the partialized state
    expect(keys).toContain("nodes");
    expect(keys).toContain("edges");
    expect(keys).toHaveLength(2);
  });
});
