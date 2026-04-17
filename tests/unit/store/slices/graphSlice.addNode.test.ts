import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createStore } from "@/store/createStore";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";

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

describe("graphSlice.addNode", () => {
  it("starts with empty nodes array", () => {
    const store = createStore();
    expect(store.getState().nodes).toEqual([]);
  });

  it("starts with empty edges array", () => {
    const store = createStore();
    expect(store.getState().edges).toEqual([]);
  });

  it("appends a node to the state", () => {
    const store = createStore();
    store.getState().addNode(startSpec);
    expect(store.getState().nodes).toHaveLength(1);
  });

  it("returns the created WorkflowNode", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec);
    expect(node).toBeDefined();
    expect(node.id).toBeTruthy();
    expect(node.kind).toBe("start");
  });

  it("returned node matches the node in state", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec);
    expect(store.getState().nodes[0]).toBe(node);
  });

  it("uses spec.kind for the node kind", () => {
    const store = createStore();
    const node = store.getState().addNode(taskSpec);
    expect(node.kind).toBe("task");
  });

  it("uses spec.defaultData for the node data", () => {
    const store = createStore();
    const node = store.getState().addNode(taskSpec);
    expect(node.data).toEqual({ name: "Default Task" });
  });

  it("uses default position (0,0) when no position provided", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec);
    expect(node.position).toEqual({ x: 0, y: 0 });
  });

  it("uses provided position when specified", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec, { x: 100, y: 200 });
    expect(node.position).toEqual({ x: 100, y: 200 });
  });

  it("appends multiple nodes", () => {
    const store = createStore();
    const node1 = store.getState().addNode(startSpec);
    const node2 = store.getState().addNode(taskSpec);

    expect(store.getState().nodes).toHaveLength(2);
    expect(store.getState().nodes[0]).toBe(node1);
    expect(store.getState().nodes[1]).toBe(node2);
  });

  it("each added node has a unique id", () => {
    const store = createStore();
    const node1 = store.getState().addNode(startSpec);
    const node2 = store.getState().addNode(startSpec);
    expect(node1.id).not.toBe(node2.id);
  });

  it("does not modify edges when adding a node", () => {
    const store = createStore();
    store.getState().addNode(startSpec);
    expect(store.getState().edges).toEqual([]);
  });
});
