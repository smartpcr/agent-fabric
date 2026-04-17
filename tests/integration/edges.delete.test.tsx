import { describe, it, expect, beforeEach } from "vitest";
import type { StoreApi } from "zustand";
import type { TemporalState } from "zundo";
import { createStore, type WorkflowState } from "@/store/createStore";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { StartNodeSpec } from "@/registry/builtins/StartNode.spec";
import { TaskNodeSpec } from "@/registry/builtins/TaskNode.spec";
import { EndNodeSpec } from "@/registry/builtins/EndNode.spec";
import type { WorkflowEdge } from "@/domain/models/edge";

type StoreWithTemporal = StoreApi<WorkflowState> & {
  temporal: StoreApi<TemporalState<Pick<WorkflowState, "nodes" | "edges">>>;
};

/** Safely get an edge by index, failing the test if it doesn't exist. */
function edgeAt(edges: WorkflowEdge[], index: number): WorkflowEdge {
  const e = edges[index];
  expect(e).toBeDefined();
  return e as WorkflowEdge;
}

describe("Integration: edge deletion via keyboard", () => {
  let store: StoreWithTemporal;

  beforeEach(() => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);
    store = createStore() as StoreWithTemporal;
    store.getState().setRegistry(registry);
    store.temporal.getState().clear();
  });

  it("selected edge + Delete → edge removed from state", () => {
    const start = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const task = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });

    store.getState().tryConnect({
      source: start.id,
      sourcePort: "out",
      target: task.id,
      targetPort: "in",
    });
    expect(store.getState().edges).toHaveLength(1);
    const edgeId = edgeAt(store.getState().edges, 0).id;

    // Select the edge (simulates click on edge)
    store.getState().selectEdge(edgeId, "replace");
    expect(store.getState().selectedEdges.has(edgeId)).toBe(true);

    // Delete (simulates Delete/Backspace key handler calling deleteSelected)
    store.getState().deleteSelected();

    expect(store.getState().edges).toHaveLength(0);
    // Nodes remain untouched
    expect(store.getState().nodes).toHaveLength(2);
    // Edge selection is cleared
    expect(store.getState().selectedEdges.size).toBe(0);
    expect(store.getState().selectedEdgeIds).toEqual([]);
  });

  it("selected edge + Delete → undo restores edge", () => {
    const start = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const task = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });

    store.getState().tryConnect({
      source: start.id,
      sourcePort: "out",
      target: task.id,
      targetPort: "in",
    });
    const edgeId = edgeAt(store.getState().edges, 0).id;

    store.getState().selectEdge(edgeId, "replace");
    store.getState().deleteSelected();
    expect(store.getState().edges).toHaveLength(0);

    // Undo → edge is restored
    store.temporal.getState().undo();
    expect(store.getState().edges).toHaveLength(1);
    const restored = edgeAt(store.getState().edges, 0);
    expect(restored.id).toBe(edgeId);
    expect(restored.source).toBe(start.id);
    expect(restored.target).toBe(task.id);
  });

  it("selected edge + Delete → undo → redo re-deletes edge", () => {
    const start = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const task = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });

    store.getState().tryConnect({
      source: start.id,
      sourcePort: "out",
      target: task.id,
      targetPort: "in",
    });
    const edgeId = edgeAt(store.getState().edges, 0).id;

    store.getState().selectEdge(edgeId, "replace");
    store.getState().deleteSelected();

    store.temporal.getState().undo();
    expect(store.getState().edges).toHaveLength(1);

    store.temporal.getState().redo();
    expect(store.getState().edges).toHaveLength(0);
  });

  it("multi-edge selection + Delete removes all selected edges", () => {
    const start = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const task = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });
    const end = store.getState().addNode(EndNodeSpec, { x: 400, y: 0 });

    store.getState().tryConnect({
      source: start.id,
      sourcePort: "out",
      target: task.id,
      targetPort: "in",
    });
    store.getState().tryConnect({
      source: task.id,
      sourcePort: "out",
      target: end.id,
      targetPort: "in",
    });
    expect(store.getState().edges).toHaveLength(2);
    const edge1Id = edgeAt(store.getState().edges, 0).id;
    const edge2Id = edgeAt(store.getState().edges, 1).id;

    // Shift-click both edges
    store.getState().selectEdge(edge1Id, "replace");
    store.getState().selectEdge(edge2Id, "add");
    expect(store.getState().selectedEdges.size).toBe(2);

    store.getState().deleteSelected();
    expect(store.getState().edges).toHaveLength(0);
    expect(store.getState().nodes).toHaveLength(3);
  });

  it("multi-edge deletion is a single undo step", () => {
    const start = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const task = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });
    const end = store.getState().addNode(EndNodeSpec, { x: 400, y: 0 });

    store.getState().tryConnect({
      source: start.id,
      sourcePort: "out",
      target: task.id,
      targetPort: "in",
    });
    store.getState().tryConnect({
      source: task.id,
      sourcePort: "out",
      target: end.id,
      targetPort: "in",
    });

    store.getState().selectEdge(edgeAt(store.getState().edges, 0).id, "replace");
    store.getState().selectEdge(edgeAt(store.getState().edges, 1).id, "add");
    store.getState().deleteSelected();
    expect(store.getState().edges).toHaveLength(0);

    // Single undo restores both edges
    store.temporal.getState().undo();
    expect(store.getState().edges).toHaveLength(2);
  });

  it("deleteSelected with no selection is a no-op", () => {
    const start = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const task = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });

    store.getState().tryConnect({
      source: start.id,
      sourcePort: "out",
      target: task.id,
      targetPort: "in",
    });

    // No selection — deleteSelected should be a no-op
    store.getState().deleteSelected();
    expect(store.getState().edges).toHaveLength(1);
    expect(store.getState().nodes).toHaveLength(2);
  });

  it("mixed node + edge selection deletes both", () => {
    const start = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const task = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });
    const end = store.getState().addNode(EndNodeSpec, { x: 400, y: 0 });

    store.getState().tryConnect({
      source: start.id,
      sourcePort: "out",
      target: task.id,
      targetPort: "in",
    });
    store.getState().tryConnect({
      source: task.id,
      sourcePort: "out",
      target: end.id,
      targetPort: "in",
    });
    expect(store.getState().edges).toHaveLength(2);

    // Select just one edge and a node
    const edge2Id = edgeAt(store.getState().edges, 1).id;
    store.getState().selectEdge(edge2Id, "replace");
    store.getState().select(task.id, "replace");

    store.getState().deleteSelected();

    // task node removed, edge2 removed by edge selection, edge1 removed because task was source/target
    expect(store.getState().nodes).toHaveLength(2);
    expect(store.getState().edges).toHaveLength(0);
  });

  it("Backspace key handler path works the same as Delete (both call deleteSelected)", () => {
    // This test validates the store action itself;
    // Canvas wiring for both Delete and Backspace is identical (same code path).
    const start = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const task = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });

    store.getState().tryConnect({
      source: start.id,
      sourcePort: "out",
      target: task.id,
      targetPort: "in",
    });
    const edgeId = edgeAt(store.getState().edges, 0).id;

    store.getState().selectEdge(edgeId, "replace");
    store.getState().deleteSelected();

    expect(store.getState().edges).toHaveLength(0);
    expect(store.getState().nodes).toHaveLength(2);
  });
});
