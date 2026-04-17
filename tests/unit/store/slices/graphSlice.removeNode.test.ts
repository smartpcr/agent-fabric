import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createStore } from "@/store/createStore";
import { makeEdge } from "@/domain/models/edge";
import { makeOutputPort, makeInputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

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

function buildGraphWithEdges() {
  const store = createStore();
  const start = store.getState().addNode(startSpec);
  const task = store.getState().addNode(taskSpec);
  const end = store.getState().addNode(endSpec);

  const edge1 = makeEdge({
    source: start.id,
    sourcePort: "out",
    target: task.id,
    targetPort: "in",
  });
  const edge2 = makeEdge({
    source: task.id,
    sourcePort: "out",
    target: end.id,
    targetPort: "in",
  });

  store.setState((state) => ({
    edges: [...state.edges, edge1, edge2],
  }));

  return { store, start, task, end, edge1, edge2 };
}

describe("graphSlice.removeNode", () => {
  it("removes a node by id", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec);
    store.getState().removeNode(node.id);
    expect(store.getState().nodes).toHaveLength(0);
  });

  it("missing id is a no-op", () => {
    const store = createStore();
    store.getState().addNode(startSpec);
    store.getState().removeNode("nonexistent");
    expect(store.getState().nodes).toHaveLength(1);
  });

  it("does not affect other nodes", () => {
    const store = createStore();
    const node1 = store.getState().addNode(startSpec);
    const node2 = store.getState().addNode(taskSpec);
    store.getState().removeNode(node1.id);
    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().nodes[0]).toBe(node2);
  });

  it("cascades removal of edges where node is source", () => {
    const { store, start } = buildGraphWithEdges();
    expect(store.getState().edges).toHaveLength(2);

    store.getState().removeNode(start.id);

    expect(store.getState().edges).toHaveLength(1);
    expect(store.getState().edges[0].source).not.toBe(start.id);
  });

  it("cascades removal of edges where node is target", () => {
    const { store, end } = buildGraphWithEdges();
    expect(store.getState().edges).toHaveLength(2);

    store.getState().removeNode(end.id);

    expect(store.getState().edges).toHaveLength(1);
    expect(store.getState().edges[0].target).not.toBe(end.id);
  });

  it("cascades removal of all edges connected to a middle node", () => {
    const { store, task } = buildGraphWithEdges();
    expect(store.getState().edges).toHaveLength(2);

    store.getState().removeNode(task.id);

    expect(store.getState().edges).toHaveLength(0);
  });

  it("preserves edges unrelated to the removed node", () => {
    const { store, start, edge2 } = buildGraphWithEdges();

    store.getState().removeNode(start.id);

    expect(store.getState().edges).toHaveLength(1);
    expect(store.getState().edges[0].id).toBe(edge2.id);
  });

  it("no-op on missing id does not affect edges", () => {
    const { store } = buildGraphWithEdges();
    store.getState().removeNode("nonexistent");
    expect(store.getState().edges).toHaveLength(2);
  });
});
