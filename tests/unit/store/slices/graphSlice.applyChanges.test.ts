import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createStore } from "@/store/createStore";
import { makeOutputPort, makeInputPort } from "@/domain/models/port";
import { makeNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import type { NodeChange, EdgeChange } from "@/store/slices/graphSlice";

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

const endSpec: NodeSpec = {
  kind: "end",
  category: "flow",
  label: "End",
  icon: "stop",
  ports: [makeInputPort({ id: "in", label: "In", dataType: "any" })],
  propertySchema: z.object({}),
  defaultData: {},
  capabilities: ["isTerminal"],
};

// ---------- applyNodeChanges ----------

describe("graphSlice.applyNodeChanges", () => {
  describe("add", () => {
    it("appends a new node", () => {
      const store = createStore();
      const node = makeNode({ kind: "start", data: {}, position: { x: 10, y: 20 } });

      store.getState().applyNodeChanges([{ type: "add", item: node }]);

      expect(store.getState().nodes).toHaveLength(1);
      expect(store.getState().nodes[0].id).toBe(node.id);
      expect(store.getState().nodes[0].position).toEqual({ x: 10, y: 20 });
    });

    it("preserves existing nodes when adding", () => {
      const store = createStore();
      const existing = store.getState().addNode(startSpec);
      const newNode = makeNode({ kind: "end", data: {} });

      store.getState().applyNodeChanges([{ type: "add", item: newNode }]);

      expect(store.getState().nodes).toHaveLength(2);
      expect(store.getState().nodes[0].id).toBe(existing.id);
      expect(store.getState().nodes[1].id).toBe(newNode.id);
    });
  });

  describe("remove", () => {
    it("removes a node by id", () => {
      const store = createStore();
      const node = store.getState().addNode(startSpec);

      store.getState().applyNodeChanges([{ type: "remove", id: node.id }]);

      expect(store.getState().nodes).toHaveLength(0);
    });

    it("cascades edge removal when node is removed", () => {
      const store = createStore();
      const n1 = store.getState().addNode(startSpec, { x: 0, y: 0 });
      const n2 = store.getState().addNode(endSpec, { x: 100, y: 0 });
      const edge = makeEdge({
        source: n1.id,
        sourcePort: "out",
        target: n2.id,
        targetPort: "in",
      });
      store.getState().applyEdgeChanges([{ type: "add", item: edge }]);
      expect(store.getState().edges).toHaveLength(1);

      store.getState().applyNodeChanges([{ type: "remove", id: n1.id }]);

      expect(store.getState().nodes).toHaveLength(1);
      expect(store.getState().edges).toHaveLength(0);
    });

    it("is a no-op for missing node id", () => {
      const store = createStore();
      store.getState().addNode(startSpec);
      const nodesBefore = store.getState().nodes;

      store.getState().applyNodeChanges([{ type: "remove", id: "nonexistent" }]);

      expect(store.getState().nodes).toEqual(nodesBefore);
    });
  });

  describe("position", () => {
    it("updates node position", () => {
      const store = createStore();
      const node = store.getState().addNode(startSpec);

      store
        .getState()
        .applyNodeChanges([{ type: "position", id: node.id, position: { x: 200, y: 300 } }]);

      expect(store.getState().nodes[0].position).toEqual({ x: 200, y: 300 });
    });

    it("clamps NaN to 0", () => {
      const store = createStore();
      const node = store.getState().addNode(startSpec);

      store
        .getState()
        .applyNodeChanges([{ type: "position", id: node.id, position: { x: NaN, y: NaN } }]);

      expect(store.getState().nodes[0].position).toEqual({ x: 0, y: 0 });
    });

    it("clamps Infinity to 0", () => {
      const store = createStore();
      const node = store.getState().addNode(startSpec);

      store
        .getState()
        .applyNodeChanges([
          { type: "position", id: node.id, position: { x: Infinity, y: -Infinity } },
        ]);

      expect(store.getState().nodes[0].position).toEqual({ x: 0, y: 0 });
    });

    it("is a no-op when position is undefined", () => {
      const store = createStore();
      const node = store.getState().addNode(startSpec, { x: 10, y: 20 });

      store.getState().applyNodeChanges([{ type: "position", id: node.id }]);

      expect(store.getState().nodes[0].position).toEqual({ x: 10, y: 20 });
    });

    it("does not affect other nodes", () => {
      const store = createStore();
      store.getState().addNode(startSpec, { x: 0, y: 0 });
      const node2 = store.getState().addNode(endSpec, { x: 50, y: 50 });

      store
        .getState()
        .applyNodeChanges([{ type: "position", id: node2.id, position: { x: 99, y: 99 } }]);

      expect(store.getState().nodes[0].position).toEqual({ x: 0, y: 0 });
      expect(store.getState().nodes[1].position).toEqual({ x: 99, y: 99 });
    });
  });

  describe("select", () => {
    it("sets selected to true on a node", () => {
      const store = createStore();
      const node = store.getState().addNode(startSpec);

      store.getState().applyNodeChanges([{ type: "select", id: node.id, selected: true }]);

      expect(store.getState().nodes[0].selected).toBe(true);
    });

    it("sets selected to false on a node", () => {
      const store = createStore();
      const node = store.getState().addNode(startSpec);
      store.getState().applyNodeChanges([{ type: "select", id: node.id, selected: true }]);

      store.getState().applyNodeChanges([{ type: "select", id: node.id, selected: false }]);

      expect(store.getState().nodes[0].selected).toBe(false);
    });

    it("only affects the targeted node", () => {
      const store = createStore();
      const n1 = store.getState().addNode(startSpec);
      store.getState().addNode(endSpec);

      store.getState().applyNodeChanges([{ type: "select", id: n1.id, selected: true }]);

      expect(store.getState().nodes[0].selected).toBe(true);
      expect(store.getState().nodes[1].selected).toBeUndefined();
    });
  });

  describe("dimensions", () => {
    it("sets width and height on a node", () => {
      const store = createStore();
      const node = store.getState().addNode(startSpec);

      store
        .getState()
        .applyNodeChanges([
          { type: "dimensions", id: node.id, dimensions: { width: 150, height: 80 } },
        ]);

      expect(store.getState().nodes[0].width).toBe(150);
      expect(store.getState().nodes[0].height).toBe(80);
    });

    it("is a no-op when dimensions is undefined", () => {
      const store = createStore();
      const node = store.getState().addNode(startSpec);

      store.getState().applyNodeChanges([{ type: "dimensions", id: node.id }]);

      expect(store.getState().nodes[0].width).toBeUndefined();
      expect(store.getState().nodes[0].height).toBeUndefined();
    });

    it("updates existing dimensions", () => {
      const store = createStore();
      const node = store.getState().addNode(startSpec);
      store
        .getState()
        .applyNodeChanges([
          { type: "dimensions", id: node.id, dimensions: { width: 100, height: 50 } },
        ]);

      store
        .getState()
        .applyNodeChanges([
          { type: "dimensions", id: node.id, dimensions: { width: 200, height: 100 } },
        ]);

      expect(store.getState().nodes[0].width).toBe(200);
      expect(store.getState().nodes[0].height).toBe(100);
    });
  });

  describe("mixed batch", () => {
    it("applies multiple change kinds in one call", () => {
      const store = createStore();
      const n1 = store.getState().addNode(startSpec, { x: 0, y: 0 });
      const n2 = store.getState().addNode(endSpec, { x: 50, y: 50 });
      const newNode = makeNode({
        kind: "task",
        data: { label: "T" },
        position: { x: 300, y: 300 },
      });

      const changes: NodeChange[] = [
        { type: "add", item: newNode },
        { type: "position", id: n1.id, position: { x: 10, y: 20 } },
        { type: "select", id: n2.id, selected: true },
        { type: "dimensions", id: n1.id, dimensions: { width: 120, height: 60 } },
      ];

      store.getState().applyNodeChanges(changes);

      const state = store.getState();
      expect(state.nodes).toHaveLength(3);
      // n1 moved and dimensioned
      const updatedN1 = state.nodes.find((n) => n.id === n1.id);
      expect(updatedN1).toBeDefined();
      expect(updatedN1?.position).toEqual({ x: 10, y: 20 });
      expect(updatedN1?.width).toBe(120);
      expect(updatedN1?.height).toBe(60);
      // n2 selected
      const updatedN2 = state.nodes.find((n) => n.id === n2.id);
      expect(updatedN2).toBeDefined();
      expect(updatedN2?.selected).toBe(true);
      // newNode added
      const addedNode = state.nodes.find((n) => n.id === newNode.id);
      expect(addedNode).toBeDefined();
      expect(addedNode?.kind).toBe("task");
    });

    it("processes removes before other changes on remaining nodes", () => {
      const store = createStore();
      const n1 = store.getState().addNode(startSpec);
      const n2 = store.getState().addNode(endSpec, { x: 50, y: 50 });

      const changes: NodeChange[] = [
        { type: "remove", id: n1.id },
        { type: "position", id: n2.id, position: { x: 99, y: 99 } },
      ];

      store.getState().applyNodeChanges(changes);

      expect(store.getState().nodes).toHaveLength(1);
      expect(store.getState().nodes[0].id).toBe(n2.id);
      expect(store.getState().nodes[0].position).toEqual({ x: 99, y: 99 });
    });

    it("applies empty changes array as a no-op", () => {
      const store = createStore();
      store.getState().addNode(startSpec);
      const nodesBefore = store.getState().nodes;

      store.getState().applyNodeChanges([]);

      expect(store.getState().nodes).toEqual(nodesBefore);
    });
  });
});

// ---------- applyEdgeChanges ----------

describe("graphSlice.applyEdgeChanges", () => {
  describe("add", () => {
    it("appends a new edge", () => {
      const store = createStore();
      const edge = makeEdge({
        source: "n1",
        sourcePort: "out",
        target: "n2",
        targetPort: "in",
      });

      store.getState().applyEdgeChanges([{ type: "add", item: edge }]);

      expect(store.getState().edges).toHaveLength(1);
      expect(store.getState().edges[0].id).toBe(edge.id);
    });
  });

  describe("remove", () => {
    it("removes an edge by id", () => {
      const store = createStore();
      const edge = makeEdge({
        source: "n1",
        sourcePort: "out",
        target: "n2",
        targetPort: "in",
      });
      store.getState().applyEdgeChanges([{ type: "add", item: edge }]);

      store.getState().applyEdgeChanges([{ type: "remove", id: edge.id }]);

      expect(store.getState().edges).toHaveLength(0);
    });

    it("is a no-op for missing edge id", () => {
      const store = createStore();
      const edge = makeEdge({
        source: "n1",
        sourcePort: "out",
        target: "n2",
        targetPort: "in",
      });
      store.getState().applyEdgeChanges([{ type: "add", item: edge }]);

      store.getState().applyEdgeChanges([{ type: "remove", id: "nonexistent" }]);

      expect(store.getState().edges).toHaveLength(1);
    });
  });

  describe("select", () => {
    it("sets selected to true on an edge", () => {
      const store = createStore();
      const edge = makeEdge({
        source: "n1",
        sourcePort: "out",
        target: "n2",
        targetPort: "in",
      });
      store.getState().applyEdgeChanges([{ type: "add", item: edge }]);

      store.getState().applyEdgeChanges([{ type: "select", id: edge.id, selected: true }]);

      expect(store.getState().edges[0].selected).toBe(true);
    });

    it("sets selected to false on an edge", () => {
      const store = createStore();
      const edge = makeEdge({
        source: "n1",
        sourcePort: "out",
        target: "n2",
        targetPort: "in",
      });
      store.getState().applyEdgeChanges([{ type: "add", item: edge }]);
      store.getState().applyEdgeChanges([{ type: "select", id: edge.id, selected: true }]);

      store.getState().applyEdgeChanges([{ type: "select", id: edge.id, selected: false }]);

      expect(store.getState().edges[0].selected).toBe(false);
    });
  });

  describe("mixed batch", () => {
    it("applies multiple edge change kinds in one call", () => {
      const store = createStore();
      const e1 = makeEdge({
        source: "n1",
        sourcePort: "out",
        target: "n2",
        targetPort: "in",
      });
      const e2 = makeEdge({
        source: "n2",
        sourcePort: "out",
        target: "n3",
        targetPort: "in",
      });
      store.getState().applyEdgeChanges([{ type: "add", item: e1 }]);

      const changes: EdgeChange[] = [
        { type: "add", item: e2 },
        { type: "select", id: e1.id, selected: true },
      ];

      store.getState().applyEdgeChanges(changes);

      expect(store.getState().edges).toHaveLength(2);
      expect(store.getState().edges[0].selected).toBe(true);
      expect(store.getState().edges[1].id).toBe(e2.id);
    });

    it("applies empty changes array as a no-op", () => {
      const store = createStore();
      const edgesBefore = store.getState().edges;

      store.getState().applyEdgeChanges([]);

      expect(store.getState().edges).toBe(edgesBefore);
    });

    it("handles add then remove in same batch", () => {
      const store = createStore();
      const edge = makeEdge({
        source: "n1",
        sourcePort: "out",
        target: "n2",
        targetPort: "in",
      });

      store.getState().applyEdgeChanges([
        { type: "add", item: edge },
        { type: "remove", id: edge.id },
      ]);

      expect(store.getState().edges).toHaveLength(0);
    });
  });
});
