import { describe, it, expect, beforeEach } from "vitest";
import type { StoreApi } from "zustand";
import type { TemporalState } from "zundo";
import { createStore, type WorkflowState } from "@/store/createStore";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { StartNodeSpec } from "@/registry/builtins/StartNode.spec";
import { TaskNodeSpec } from "@/registry/builtins/TaskNode.spec";
import { EndNodeSpec } from "@/registry/builtins/EndNode.spec";

type StoreWithTemporal = StoreApi<WorkflowState> & {
  temporal: StoreApi<TemporalState<Pick<WorkflowState, "nodes" | "edges">>>;
};

describe("Integration: undo connect + disconnect", () => {
  let store: StoreWithTemporal;

  beforeEach(() => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);
    store = createStore() as StoreWithTemporal;
    store.getState().setRegistry(registry);
    // Clear undo history so baseline state is clean
    store.temporal.getState().clear();
  });

  it("connect → undo → edge is gone", () => {
    const startNode = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const taskNode = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });

    // Connect start → task
    const result = store.getState().tryConnect({
      source: startNode.id,
      sourcePort: "out",
      target: taskNode.id,
      targetPort: "in",
    });
    expect(result.ok).toBe(true);
    expect(store.getState().edges).toHaveLength(1);

    // Undo the connection
    store.temporal.getState().undo();

    // Edge should be gone
    expect(store.getState().edges).toHaveLength(0);
    // Nodes remain
    expect(store.getState().nodes).toHaveLength(2);
  });

  it("connect → undo → redo → edge is restored", () => {
    const startNode = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const taskNode = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });

    const result = store.getState().tryConnect({
      source: startNode.id,
      sourcePort: "out",
      target: taskNode.id,
      targetPort: "in",
    });
    expect(result.ok).toBe(true);

    store.temporal.getState().undo();
    expect(store.getState().edges).toHaveLength(0);

    store.temporal.getState().redo();
    expect(store.getState().edges).toHaveLength(1);
    expect(store.getState().edges[0]?.source).toBe(startNode.id);
    expect(store.getState().edges[0]?.target).toBe(taskNode.id);
  });

  it("disconnect (delete edge) → undo → edge is restored", () => {
    const startNode = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const taskNode = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });

    const result = store.getState().tryConnect({
      source: startNode.id,
      sourcePort: "out",
      target: taskNode.id,
      targetPort: "in",
    });
    expect(result.ok).toBe(true);

    // Delete the edge via applyEdgeChanges (simulating user deleting an edge)
    const edge = store.getState().edges[0];
    expect(edge).toBeDefined();
    store.getState().applyEdgeChanges([{ type: "remove", id: edge?.id ?? "" }]);
    expect(store.getState().edges).toHaveLength(0);

    // Undo the deletion
    store.temporal.getState().undo();

    // Edge is restored
    expect(store.getState().edges).toHaveLength(1);
    expect(store.getState().edges[0]?.id).toBe(edge?.id);
    expect(store.getState().edges[0]?.source).toBe(startNode.id);
    expect(store.getState().edges[0]?.target).toBe(taskNode.id);
  });

  it("disconnect via deleteSelected → undo → edge + selection state restored", () => {
    const startNode = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const taskNode = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });
    const endNode = store.getState().addNode(EndNodeSpec, { x: 400, y: 0 });

    // Build a 2-edge pipeline: start → task → end
    store.getState().tryConnect({
      source: startNode.id,
      sourcePort: "out",
      target: taskNode.id,
      targetPort: "in",
    });
    store.getState().tryConnect({
      source: taskNode.id,
      sourcePort: "out",
      target: endNode.id,
      targetPort: "in",
    });
    expect(store.getState().edges).toHaveLength(2);

    // Select the task node and delete it (removes node + connected edges)
    store.getState().select(taskNode.id, "replace");
    store.getState().deleteSelected();

    expect(store.getState().nodes).toHaveLength(2);
    expect(store.getState().edges).toHaveLength(0);

    // Undo → task node and its edges are restored
    store.temporal.getState().undo();

    expect(store.getState().nodes).toHaveLength(3);
    expect(store.getState().edges).toHaveLength(2);
    expect(store.getState().nodes.some((n) => n.id === taskNode.id)).toBe(true);
  });

  it("multiple connect → undo steps → progressive rollback", () => {
    const startNode = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const taskNode = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });
    const endNode = store.getState().addNode(EndNodeSpec, { x: 400, y: 0 });

    store.getState().tryConnect({
      source: startNode.id,
      sourcePort: "out",
      target: taskNode.id,
      targetPort: "in",
    });
    expect(store.getState().edges).toHaveLength(1);

    store.getState().tryConnect({
      source: taskNode.id,
      sourcePort: "out",
      target: endNode.id,
      targetPort: "in",
    });
    expect(store.getState().edges).toHaveLength(2);

    // Undo last connection
    store.temporal.getState().undo();
    expect(store.getState().edges).toHaveLength(1);

    // Undo first connection
    store.temporal.getState().undo();
    expect(store.getState().edges).toHaveLength(0);
  });
});
