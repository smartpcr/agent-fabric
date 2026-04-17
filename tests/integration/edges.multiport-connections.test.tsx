import { describe, it, expect, beforeEach } from "vitest";
import type { StoreApi } from "zustand";
import { createStore, type WorkflowState } from "@/store/createStore";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { MultiPortTaskNodeSpec } from "@/registry/builtins/MultiPortTaskNode.spec";
import { EndNodeSpec } from "@/registry/builtins/EndNode.spec";
import { TaskNodeSpec } from "@/registry/builtins/TaskNode.spec";

describe("Integration: multi-port connections (2-in / 3-out TaskNode)", () => {
  let store: StoreApi<WorkflowState>;

  beforeEach(() => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);
    registry.register(MultiPortTaskNodeSpec);
    store = createStore();
    store.getState().setRegistry(registry);
  });

  it("connects 3 output ports to 3 distinct target nodes", () => {
    const multiPort = store.getState().addNode(MultiPortTaskNodeSpec, { x: 0, y: 0 });
    const target1 = store.getState().addNode(EndNodeSpec, { x: 200, y: 0 });
    const target2 = store.getState().addNode(EndNodeSpec, { x: 200, y: 100 });
    const target3 = store.getState().addNode(EndNodeSpec, { x: 200, y: 200 });

    // Connect outA → target1
    const r1 = store.getState().tryConnect({
      source: multiPort.id,
      sourcePort: "outA",
      target: target1.id,
      targetPort: "in",
    });
    expect(r1.ok).toBe(true);

    // Connect outB → target2
    const r2 = store.getState().tryConnect({
      source: multiPort.id,
      sourcePort: "outB",
      target: target2.id,
      targetPort: "in",
    });
    expect(r2.ok).toBe(true);

    // Connect outC → target3
    const r3 = store.getState().tryConnect({
      source: multiPort.id,
      sourcePort: "outC",
      target: target3.id,
      targetPort: "in",
    });
    expect(r3.ok).toBe(true);

    // Assert 3 distinct edges
    const edges = store.getState().edges;
    expect(edges).toHaveLength(3);

    // All edge IDs are unique
    const edgeIds = new Set(edges.map((e) => e.id));
    expect(edgeIds.size).toBe(3);

    // All source ports are unique
    const sourcePorts = new Set(edges.map((e) => e.sourcePort));
    expect(sourcePorts.size).toBe(3);
    expect(sourcePorts.has("outA")).toBe(true);
    expect(sourcePorts.has("outB")).toBe(true);
    expect(sourcePorts.has("outC")).toBe(true);

    // All edges originate from the multi-port node
    for (const edge of edges) {
      expect(edge.source).toBe(multiPort.id);
    }
  });

  it("each edge connects to a distinct target node with unique target port id", () => {
    const multiPort = store.getState().addNode(MultiPortTaskNodeSpec, { x: 0, y: 0 });
    const t1 = store.getState().addNode(EndNodeSpec, { x: 200, y: 0 });
    const t2 = store.getState().addNode(EndNodeSpec, { x: 200, y: 100 });
    const t3 = store.getState().addNode(EndNodeSpec, { x: 200, y: 200 });

    store
      .getState()
      .tryConnect({ source: multiPort.id, sourcePort: "outA", target: t1.id, targetPort: "in" });
    store
      .getState()
      .tryConnect({ source: multiPort.id, sourcePort: "outB", target: t2.id, targetPort: "in" });
    store
      .getState()
      .tryConnect({ source: multiPort.id, sourcePort: "outC", target: t3.id, targetPort: "in" });

    const edges = store.getState().edges;

    // Each edge targets a different node
    const targetNodeIds = edges.map((e) => e.target);
    expect(new Set(targetNodeIds).size).toBe(3);
    expect(targetNodeIds).toContain(t1.id);
    expect(targetNodeIds).toContain(t2.id);
    expect(targetNodeIds).toContain(t3.id);
  });

  it("multi-port node also accepts 2 inbound connections", () => {
    const multiPort = store.getState().addNode(MultiPortTaskNodeSpec, { x: 200, y: 0 });
    const src1 = store.getState().addNode(TaskNodeSpec, { x: 0, y: 0 });
    const src2 = store.getState().addNode(TaskNodeSpec, { x: 0, y: 100 });

    // Connect src1.out → multiPort.inA (string ← any: assignable)
    const r1 = store.getState().tryConnect({
      source: src1.id,
      sourcePort: "out",
      target: multiPort.id,
      targetPort: "inA",
    });
    expect(r1.ok).toBe(true);

    // Connect src2.out → multiPort.inB (json ← any: assignable)
    const r2 = store.getState().tryConnect({
      source: src2.id,
      sourcePort: "out",
      target: multiPort.id,
      targetPort: "inB",
    });
    expect(r2.ok).toBe(true);

    expect(store.getState().edges).toHaveLength(2);
  });

  it("full pipeline: 2 sources → multi-port → 3 targets yields 5 edges", () => {
    const src1 = store.getState().addNode(TaskNodeSpec, { x: 0, y: 0 });
    const src2 = store.getState().addNode(TaskNodeSpec, { x: 0, y: 100 });
    const multiPort = store.getState().addNode(MultiPortTaskNodeSpec, { x: 200, y: 50 });
    const t1 = store.getState().addNode(EndNodeSpec, { x: 400, y: 0 });
    const t2 = store.getState().addNode(EndNodeSpec, { x: 400, y: 100 });
    const t3 = store.getState().addNode(EndNodeSpec, { x: 400, y: 200 });

    // 2 inbound connections
    store
      .getState()
      .tryConnect({ source: src1.id, sourcePort: "out", target: multiPort.id, targetPort: "inA" });
    store
      .getState()
      .tryConnect({ source: src2.id, sourcePort: "out", target: multiPort.id, targetPort: "inB" });

    // 3 outbound connections
    store
      .getState()
      .tryConnect({ source: multiPort.id, sourcePort: "outA", target: t1.id, targetPort: "in" });
    store
      .getState()
      .tryConnect({ source: multiPort.id, sourcePort: "outB", target: t2.id, targetPort: "in" });
    store
      .getState()
      .tryConnect({ source: multiPort.id, sourcePort: "outC", target: t3.id, targetPort: "in" });

    const edges = store.getState().edges;
    expect(edges).toHaveLength(5);

    // All edges have unique IDs
    expect(new Set(edges.map((e) => e.id)).size).toBe(5);

    // All 6 nodes remain
    expect(store.getState().nodes).toHaveLength(6);
  });

  it("rejects duplicate connection to single-cardinality input port", () => {
    const multiPort = store.getState().addNode(MultiPortTaskNodeSpec, { x: 200, y: 0 });
    const src1 = store.getState().addNode(TaskNodeSpec, { x: 0, y: 0 });
    const src2 = store.getState().addNode(TaskNodeSpec, { x: 0, y: 100 });

    // First connection to inA succeeds
    const r1 = store.getState().tryConnect({
      source: src1.id,
      sourcePort: "out",
      target: multiPort.id,
      targetPort: "inA",
    });
    expect(r1.ok).toBe(true);

    // Second connection to same inA port is rejected (single cardinality)
    const r2 = store.getState().tryConnect({
      source: src2.id,
      sourcePort: "out",
      target: multiPort.id,
      targetPort: "inA",
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.error.code).toBe("CARDINALITY_EXCEEDED");
    }

    // Only 1 edge exists
    expect(store.getState().edges).toHaveLength(1);
  });
});
