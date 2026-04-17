import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createStore } from "@/store/createStore";
import { makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const startSpec: NodeSpec = {
  kind: "start",
  category: "flow",
  label: "Start",
  icon: "play",
  ports: [makeOutputPort({ id: "out", label: "Out", dataType: "any" })],
  propertySchema: z.object({}),
  defaultData: {},
  capabilities: ["isEntry"],
};

describe("graphSlice.updateNodePosition", () => {
  it("sets position on a node", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec);
    store.getState().updateNodePosition(node.id, { x: 100, y: 200 });
    expect(store.getState().nodes[0].position).toEqual({ x: 100, y: 200 });
  });

  it("clamps NaN x to 0", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec);
    store.getState().updateNodePosition(node.id, { x: NaN, y: 50 });
    expect(store.getState().nodes[0].position).toEqual({ x: 0, y: 50 });
  });

  it("clamps NaN y to 0", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec);
    store.getState().updateNodePosition(node.id, { x: 50, y: NaN });
    expect(store.getState().nodes[0].position).toEqual({ x: 50, y: 0 });
  });

  it("clamps Infinity x to 0", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec);
    store.getState().updateNodePosition(node.id, { x: Infinity, y: 10 });
    expect(store.getState().nodes[0].position).toEqual({ x: 0, y: 10 });
  });

  it("clamps -Infinity y to 0", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec);
    store.getState().updateNodePosition(node.id, { x: 10, y: -Infinity });
    expect(store.getState().nodes[0].position).toEqual({ x: 10, y: 0 });
  });

  it("clamps both NaN x and NaN y to 0", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec);
    store.getState().updateNodePosition(node.id, { x: NaN, y: NaN });
    expect(store.getState().nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it("does not affect other nodes", () => {
    const store = createStore();
    const node1 = store.getState().addNode(startSpec);
    const node2 = store.getState().addNode(startSpec, { x: 50, y: 50 });
    store.getState().updateNodePosition(node1.id, { x: 300, y: 400 });
    expect(store.getState().nodes[1].position).toEqual({ x: 50, y: 50 });
    expect(store.getState().nodes[1]).toBe(node2);
  });

  it("does not affect edges", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec);
    const edgesBefore = store.getState().edges;
    store.getState().updateNodePosition(node.id, { x: 10, y: 20 });
    expect(store.getState().edges).toBe(edgesBefore);
  });

  it("is a no-op for missing node id", () => {
    const store = createStore();
    store.getState().addNode(startSpec);
    const nodesBefore = store.getState().nodes;
    store.getState().updateNodePosition("nonexistent", { x: 99, y: 99 });
    expect(store.getState().nodes).toEqual(nodesBefore);
  });

  it("accepts negative coordinates", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec);
    store.getState().updateNodePosition(node.id, { x: -50, y: -100 });
    expect(store.getState().nodes[0].position).toEqual({ x: -50, y: -100 });
  });

  it("accepts zero coordinates", () => {
    const store = createStore();
    const node = store.getState().addNode(startSpec, { x: 100, y: 200 });
    store.getState().updateNodePosition(node.id, { x: 0, y: 0 });
    expect(store.getState().nodes[0].position).toEqual({ x: 0, y: 0 });
  });
});
