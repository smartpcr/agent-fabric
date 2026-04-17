import { describe, it, expect } from "vitest";
import { createStore } from "@/store/createStore";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { StartNodeSpec } from "@/registry/builtins/StartNode.spec";
import { EndNodeSpec } from "@/registry/builtins/EndNode.spec";
import { TaskNodeSpec } from "@/registry/builtins/TaskNode.spec";
import { snapshotGraph } from "@/store/testUtils";

describe("Integration: store + registry + validation end-to-end", () => {
  function setupStore() {
    const registry = new NodeRegistry();
    registerBuiltins(registry);
    const store = createStore();
    store.getState().setRegistry(registry);
    return { store, registry };
  }

  it("register builtins → add nodes → connect valid → snapshot matches fixture", () => {
    const { store, registry } = setupStore();

    // Add nodes via store actions
    const startNode = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const taskNode = store.getState().addNode(TaskNodeSpec, { x: 200, y: 0 });
    const endNode = store.getState().addNode(EndNodeSpec, { x: 400, y: 0 });

    // Valid connection: start → task
    const conn1 = store.getState().connectPorts({
      source: { nodeId: startNode.id, portId: "out" },
      target: { nodeId: taskNode.id, portId: "in" },
      registry,
    });
    expect(conn1.ok).toBe(true);

    // Valid connection: task → end
    const conn2 = store.getState().connectPorts({
      source: { nodeId: taskNode.id, portId: "out" },
      target: { nodeId: endNode.id, portId: "in" },
      registry,
    });
    expect(conn2.ok).toBe(true);

    // Verify graph state
    const state = store.getState();
    expect(state.nodes).toHaveLength(3);
    expect(state.edges).toHaveLength(2);

    // Snapshot matches expected fixture
    const snap = snapshotGraph(store);
    expect(snap.nodes).toHaveLength(3);
    expect(snap.edges).toHaveLength(2);

    // Verify node identities in snapshot
    expect(snap.nodes.map((n) => n.kind)).toEqual(["start", "task", "end"]);

    // Verify edge connectivity in snapshot
    const edge1 = snap.edges.find((e) => e.source === startNode.id);
    expect(edge1).toBeDefined();
    expect(edge1?.target).toBe(taskNode.id);
    expect(edge1?.sourcePort).toBe("out");
    expect(edge1?.targetPort).toBe("in");

    const edge2 = snap.edges.find((e) => e.source === taskNode.id);
    expect(edge2).toBeDefined();
    expect(edge2?.target).toBe(endNode.id);
  });

  it("rejects invalid connection: wrong direction (input → input)", () => {
    const { store, registry } = setupStore();

    const taskNode = store.getState().addNode(TaskNodeSpec, { x: 0, y: 0 });
    const endNode = store.getState().addNode(EndNodeSpec, { x: 200, y: 0 });

    // Attempt connection from input port to input port
    const result = store.getState().connectPorts({
      source: { nodeId: taskNode.id, portId: "in" },
      target: { nodeId: endNode.id, portId: "in" },
      registry,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("WRONG_DIRECTION");
    }
    // State unchanged
    expect(store.getState().edges).toHaveLength(0);
  });

  it("rejects invalid connection: nonexistent port", () => {
    const { store, registry } = setupStore();

    const startNode = store.getState().addNode(StartNodeSpec);
    const endNode = store.getState().addNode(EndNodeSpec);

    const result = store.getState().connectPorts({
      source: { nodeId: startNode.id, portId: "nonexistent" },
      target: { nodeId: endNode.id, portId: "in" },
      registry,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SOURCE_PORT_NOT_FOUND");
    }
    expect(store.getState().edges).toHaveLength(0);
  });

  it("rejects invalid connection: self-loop same port", () => {
    const { store, registry } = setupStore();

    const taskNode = store.getState().addNode(TaskNodeSpec);

    const result = store.getState().connectPorts({
      source: { nodeId: taskNode.id, portId: "out" },
      target: { nodeId: taskNode.id, portId: "out" },
      registry,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SELF_LOOP_SAME_PORT");
    }
    expect(store.getState().edges).toHaveLength(0);
  });

  it("rejects connection to nonexistent target node", () => {
    const { store, registry } = setupStore();

    const startNode = store.getState().addNode(StartNodeSpec);

    const result = store.getState().connectPorts({
      source: { nodeId: startNode.id, portId: "out" },
      target: { nodeId: "ghost", portId: "in" },
      registry,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TARGET_NODE_NOT_FOUND");
    }
    expect(store.getState().edges).toHaveLength(0);
  });

  it("full pipeline: add, connect, reject invalid, snapshot fixture", () => {
    const { store, registry } = setupStore();

    // Build a 3-node pipeline
    const s = store.getState().addNode(StartNodeSpec, { x: 0, y: 0 });
    const t = store.getState().addNode(TaskNodeSpec, { x: 100, y: 0 });
    const e = store.getState().addNode(EndNodeSpec, { x: 200, y: 0 });

    // Valid connections
    const c1 = store.getState().connectPorts({
      source: { nodeId: s.id, portId: "out" },
      target: { nodeId: t.id, portId: "in" },
      registry,
    });
    expect(c1.ok).toBe(true);

    const c2 = store.getState().connectPorts({
      source: { nodeId: t.id, portId: "out" },
      target: { nodeId: e.id, portId: "in" },
      registry,
    });
    expect(c2.ok).toBe(true);

    // Reject: end has no output port
    const bad = store.getState().connectPorts({
      source: { nodeId: e.id, portId: "out" },
      target: { nodeId: s.id, portId: "out" },
      registry,
    });
    expect(bad.ok).toBe(false);

    // Final snapshot matches expected fixture
    const snap = snapshotGraph(store);

    expect(snap.nodes).toHaveLength(3);
    expect(snap.edges).toHaveLength(2);

    // Fixture: node kinds in order
    expect(snap.nodes[0].kind).toBe("start");
    expect(snap.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(snap.nodes[1].kind).toBe("task");
    expect(snap.nodes[1].position).toEqual({ x: 100, y: 0 });
    expect(snap.nodes[2].kind).toBe("end");
    expect(snap.nodes[2].position).toEqual({ x: 200, y: 0 });

    // Fixture: edges connect the pipeline
    expect(snap.edges[0].source).toBe(s.id);
    expect(snap.edges[0].target).toBe(t.id);
    expect(snap.edges[1].source).toBe(t.id);
    expect(snap.edges[1].target).toBe(e.id);
  });
});
