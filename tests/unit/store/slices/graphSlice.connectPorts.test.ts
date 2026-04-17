import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createStore } from "@/store/createStore";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";

const emptySchema = z.object({});

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

const taskSpec: NodeSpec = {
  kind: "task",
  category: "flow",
  label: "Task",
  icon: "cog",
  ports: [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
  ],
  propertySchema: emptySchema,
  defaultData: {},
  capabilities: [],
};

const endSpec: NodeSpec = {
  kind: "end",
  category: "flow",
  label: "End",
  icon: "stop",
  ports: [makeInputPort({ id: "in", label: "In", dataType: "any" })],
  propertySchema: emptySchema,
  defaultData: {},
  capabilities: ["isTerminal"],
};

function makeRegistry(): NodeSpecRegistry {
  const map = new Map<string, NodeSpec>([
    ["start", startSpec],
    ["task", taskSpec],
    ["end", endSpec],
  ]);
  return { get: (kind: string) => map.get(kind) };
}

describe("graphSlice.connectPorts", () => {
  it("appends an edge on valid connection", () => {
    const store = createStore();
    const registry = makeRegistry();
    const start = store.getState().addNode(startSpec);
    const task = store.getState().addNode(taskSpec);

    const result = store.getState().connectPorts({
      source: { nodeId: start.id, portId: "out" },
      target: { nodeId: task.id, portId: "in" },
      registry,
    });

    expect(result.ok).toBe(true);
    expect(store.getState().edges).toHaveLength(1);
  });

  it("returns the created WorkflowEdge on success", () => {
    const store = createStore();
    const registry = makeRegistry();
    const start = store.getState().addNode(startSpec);
    const task = store.getState().addNode(taskSpec);

    const result = store.getState().connectPorts({
      source: { nodeId: start.id, portId: "out" },
      target: { nodeId: task.id, portId: "in" },
      registry,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toBe(start.id);
      expect(result.value.sourcePort).toBe("out");
      expect(result.value.target).toBe(task.id);
      expect(result.value.targetPort).toBe("in");
      expect(result.value.id).toBeTruthy();
    }
  });

  it("returned edge matches the edge in state", () => {
    const store = createStore();
    const registry = makeRegistry();
    const start = store.getState().addNode(startSpec);
    const task = store.getState().addNode(taskSpec);

    const result = store.getState().connectPorts({
      source: { nodeId: start.id, portId: "out" },
      target: { nodeId: task.id, portId: "in" },
      registry,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(store.getState().edges[0]).toBe(result.value);
    }
  });

  it("returns error when source node does not exist", () => {
    const store = createStore();
    const registry = makeRegistry();
    const task = store.getState().addNode(taskSpec);

    const result = store.getState().connectPorts({
      source: { nodeId: "nonexistent", portId: "out" },
      target: { nodeId: task.id, portId: "in" },
      registry,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SOURCE_NODE_NOT_FOUND");
    }
  });

  it("returns error when target node does not exist", () => {
    const store = createStore();
    const registry = makeRegistry();
    const start = store.getState().addNode(startSpec);

    const result = store.getState().connectPorts({
      source: { nodeId: start.id, portId: "out" },
      target: { nodeId: "nonexistent", portId: "in" },
      registry,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TARGET_NODE_NOT_FOUND");
    }
  });

  it("does not mutate state on failure", () => {
    const store = createStore();
    const registry = makeRegistry();
    store.getState().addNode(startSpec);

    const edgesBefore = store.getState().edges;

    store.getState().connectPorts({
      source: { nodeId: "nonexistent", portId: "out" },
      target: { nodeId: "nonexistent", portId: "in" },
      registry,
    });

    expect(store.getState().edges).toBe(edgesBefore);
    expect(store.getState().edges).toHaveLength(0);
  });

  it("returns error for wrong port direction", () => {
    const store = createStore();
    const registry = makeRegistry();
    const task1 = store.getState().addNode(taskSpec);
    const task2 = store.getState().addNode(taskSpec);

    const result = store.getState().connectPorts({
      source: { nodeId: task1.id, portId: "in" },
      target: { nodeId: task2.id, portId: "in" },
      registry,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("WRONG_DIRECTION");
    }
  });

  it("returns error for cardinality exceeded (single port)", () => {
    const store = createStore();
    const registry = makeRegistry();
    const start = store.getState().addNode(startSpec);
    const task = store.getState().addNode(taskSpec);
    const start2 = store.getState().addNode(startSpec);

    store.getState().connectPorts({
      source: { nodeId: start.id, portId: "out" },
      target: { nodeId: task.id, portId: "in" },
      registry,
    });

    const result = store.getState().connectPorts({
      source: { nodeId: start2.id, portId: "out" },
      target: { nodeId: task.id, portId: "in" },
      registry,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CARDINALITY_EXCEEDED");
    }
    expect(store.getState().edges).toHaveLength(1);
  });

  it("allows multiple valid connections", () => {
    const store = createStore();
    const registry = makeRegistry();
    const start = store.getState().addNode(startSpec);
    const task = store.getState().addNode(taskSpec);
    const end = store.getState().addNode(endSpec);

    const r1 = store.getState().connectPorts({
      source: { nodeId: start.id, portId: "out" },
      target: { nodeId: task.id, portId: "in" },
      registry,
    });

    const r2 = store.getState().connectPorts({
      source: { nodeId: task.id, portId: "out" },
      target: { nodeId: end.id, portId: "in" },
      registry,
    });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(store.getState().edges).toHaveLength(2);
  });

  it("nodes are unchanged after connectPorts", () => {
    const store = createStore();
    const registry = makeRegistry();
    const start = store.getState().addNode(startSpec);
    const task = store.getState().addNode(taskSpec);
    const nodesBefore = store.getState().nodes;

    store.getState().connectPorts({
      source: { nodeId: start.id, portId: "out" },
      target: { nodeId: task.id, portId: "in" },
      registry,
    });

    expect(store.getState().nodes).toBe(nodesBefore);
  });
});
