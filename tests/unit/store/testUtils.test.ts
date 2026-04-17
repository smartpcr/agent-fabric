import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createStore } from "@/store/createStore";
import { snapshotGraph, restoreGraph } from "@/store/testUtils";
import { makeOutputPort, makeInputPort } from "@/domain/models/port";
import { makeEdge } from "@/domain/models/edge";
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

describe("store testUtils", () => {
  describe("snapshotGraph", () => {
    it("returns plain JSON with nodes and edges", () => {
      const store = createStore();
      store.getState().addNode(startSpec, { x: 10, y: 20 });

      const snap = snapshotGraph(store);

      expect(snap).toHaveProperty("nodes");
      expect(snap).toHaveProperty("edges");
      expect(snap.nodes).toHaveLength(1);
      expect(snap.edges).toHaveLength(0);
    });

    it("captures only graph data, not actions", () => {
      const store = createStore();
      store.getState().addNode(startSpec);

      const snap = snapshotGraph(store);

      expect(snap).not.toHaveProperty("addNode");
      expect(snap).not.toHaveProperty("removeNode");
      expect(snap).not.toHaveProperty("selectedNodeIds");
      expect(snap).not.toHaveProperty("registry");
    });

    it("returns a deep copy (modifying snapshot does not affect store)", () => {
      const store = createStore();
      store.getState().addNode(startSpec);

      const snap = snapshotGraph(store);
      (snap.nodes as unknown[]).push({ id: "fake", kind: "x", position: { x: 0, y: 0 }, data: {} });

      expect(store.getState().nodes).toHaveLength(1);
    });

    it("captures an empty graph correctly", () => {
      const store = createStore();
      const snap = snapshotGraph(store);

      expect(snap.nodes).toEqual([]);
      expect(snap.edges).toEqual([]);
    });

    it("captures edges alongside nodes", () => {
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

      const snap = snapshotGraph(store);

      expect(snap.nodes).toHaveLength(2);
      expect(snap.edges).toHaveLength(1);
      expect(snap.edges[0].source).toBe(n1.id);
      expect(snap.edges[0].target).toBe(n2.id);
    });
  });

  describe("restoreGraph", () => {
    it("restores nodes and edges from snapshot", () => {
      const store = createStore();
      const n1 = store.getState().addNode(startSpec, { x: 10, y: 20 });
      const n2 = store.getState().addNode(endSpec, { x: 100, y: 200 });
      const edge = makeEdge({
        source: n1.id,
        sourcePort: "out",
        target: n2.id,
        targetPort: "in",
      });
      store.getState().applyEdgeChanges([{ type: "add", item: edge }]);
      const snap = snapshotGraph(store);

      // Clear the store
      store.getState().removeNode(n1.id);
      store.getState().removeNode(n2.id);
      expect(store.getState().nodes).toHaveLength(0);
      expect(store.getState().edges).toHaveLength(0);

      // Restore
      restoreGraph(store, snap);

      expect(store.getState().nodes).toHaveLength(2);
      expect(store.getState().edges).toHaveLength(1);
    });

    it("restores to empty when given empty snapshot", () => {
      const store = createStore();
      store.getState().addNode(startSpec);
      expect(store.getState().nodes).toHaveLength(1);

      restoreGraph(store, { nodes: [], edges: [] });

      expect(store.getState().nodes).toHaveLength(0);
      expect(store.getState().edges).toHaveLength(0);
    });

    it("does not affect non-graph state (selection, registry)", () => {
      const store = createStore();
      store.getState().selectBulk(["node-1"], ["edge-1"]);

      restoreGraph(store, { nodes: [], edges: [] });

      expect(store.getState().selectedNodeIds).toEqual(["node-1"]);
      expect(store.getState().selectedEdgeIds).toEqual(["edge-1"]);
    });
  });

  describe("snapshot → restore → deep-equal", () => {
    it("round-trips a graph with nodes and edges", () => {
      const store = createStore();
      const n1 = store.getState().addNode(startSpec, { x: 10, y: 20 });
      const n2 = store.getState().addNode(endSpec, { x: 100, y: 200 });
      const edge = makeEdge({
        source: n1.id,
        sourcePort: "out",
        target: n2.id,
        targetPort: "in",
      });
      store.getState().applyEdgeChanges([{ type: "add", item: edge }]);

      const snap = snapshotGraph(store);

      // Wipe and restore to a fresh store
      const store2 = createStore();
      restoreGraph(store2, snap);

      expect(store2.getState().nodes).toEqual(snap.nodes);
      expect(store2.getState().edges).toEqual(snap.edges);
    });

    it("round-trips an empty graph", () => {
      const store = createStore();
      const snap = snapshotGraph(store);

      const store2 = createStore();
      restoreGraph(store2, snap);

      expect(store2.getState().nodes).toEqual([]);
      expect(store2.getState().edges).toEqual([]);
    });

    it("round-trips preserve node data", () => {
      const store = createStore();
      const n = store.getState().addNode(startSpec, { x: 42, y: 84 });

      const snap = snapshotGraph(store);
      const store2 = createStore();
      restoreGraph(store2, snap);

      const restored = store2.getState().nodes[0];
      expect(restored.id).toBe(n.id);
      expect(restored.kind).toBe(n.kind);
      expect(restored.position).toEqual(n.position);
      expect(restored.data).toEqual(n.data);
    });
  });
});
