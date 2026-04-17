import { describe, it, expect } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  makeGraph,
  addNodeToGraph,
  removeNodeFromGraph,
  addEdgeToGraph,
  removeEdgeFromGraph,
} from "@/domain/models/graph";
import { makeNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";

describe("WorkflowGraph", () => {
  describe("makeGraph", () => {
    it("creates an empty graph with the current schema version", () => {
      const g = makeGraph("Test");
      expect(g.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(g.name).toBe("Test");
      expect(g.nodes).toEqual([]);
      expect(g.edges).toEqual([]);
      expect(g.id).toMatch(/^graph_/);
    });

    it("returns a frozen object", () => {
      const g = makeGraph("Test");
      expect(Object.isFrozen(g)).toBe(true);
      expect(Object.isFrozen(g.nodes)).toBe(true);
      expect(Object.isFrozen(g.edges)).toBe(true);
    });
  });

  describe("CURRENT_SCHEMA_VERSION", () => {
    it("equals 1", () => {
      expect(CURRENT_SCHEMA_VERSION).toBe(1);
    });
  });

  describe("addNodeToGraph", () => {
    it("returns a new graph containing the added node", () => {
      const g = makeGraph("G");
      const node = makeNode({ kind: "task", data: {} });
      const g2 = addNodeToGraph(g, node);

      expect(g2.nodes).toHaveLength(1);
      expect(g2.nodes[0]).toBe(node);
    });

    it("does not mutate the original graph", () => {
      const g = makeGraph("G");
      const node = makeNode({ kind: "task", data: {} });
      const g2 = addNodeToGraph(g, node);

      expect(g.nodes).toHaveLength(0);
      expect(g2).not.toBe(g);
    });

    it("preserves existing nodes", () => {
      const g = makeGraph("G");
      const n1 = makeNode({ kind: "a", data: {} });
      const n2 = makeNode({ kind: "b", data: {} });
      const g2 = addNodeToGraph(addNodeToGraph(g, n1), n2);

      expect(g2.nodes).toHaveLength(2);
      expect(g2.nodes[0]).toBe(n1);
      expect(g2.nodes[1]).toBe(n2);
    });

    it("returns a frozen graph", () => {
      const g2 = addNodeToGraph(makeGraph("G"), makeNode({ kind: "t", data: {} }));
      expect(Object.isFrozen(g2)).toBe(true);
      expect(Object.isFrozen(g2.nodes)).toBe(true);
    });
  });

  describe("removeNodeFromGraph", () => {
    it("removes the node by id", () => {
      const g = makeGraph("G");
      const node = makeNode({ kind: "task", data: {} });
      const g2 = addNodeToGraph(g, node);
      const g3 = removeNodeFromGraph(g2, node.id);

      expect(g3.nodes).toHaveLength(0);
    });

    it("cascades removal to incident edges", () => {
      const n1 = makeNode({ kind: "a", data: {} });
      const n2 = makeNode({ kind: "b", data: {} });
      const n3 = makeNode({ kind: "c", data: {} });
      const e1 = makeEdge({
        source: n1.id,
        sourcePort: "out",
        target: n2.id,
        targetPort: "in",
      });
      const e2 = makeEdge({
        source: n2.id,
        sourcePort: "out",
        target: n3.id,
        targetPort: "in",
      });

      let g = makeGraph("G");
      g = addNodeToGraph(g, n1);
      g = addNodeToGraph(g, n2);
      g = addNodeToGraph(g, n3);
      g = addEdgeToGraph(g, e1);
      g = addEdgeToGraph(g, e2);

      const g2 = removeNodeFromGraph(g, n2.id);

      expect(g2.nodes).toHaveLength(2);
      expect(g2.edges).toHaveLength(0);
    });

    it("does not mutate the original graph", () => {
      const node = makeNode({ kind: "t", data: {} });
      const g = addNodeToGraph(makeGraph("G"), node);
      const g2 = removeNodeFromGraph(g, node.id);

      expect(g.nodes).toHaveLength(1);
      expect(g2).not.toBe(g);
    });

    it("returns a frozen graph", () => {
      const node = makeNode({ kind: "t", data: {} });
      const g = addNodeToGraph(makeGraph("G"), node);
      const g2 = removeNodeFromGraph(g, node.id);
      expect(Object.isFrozen(g2)).toBe(true);
      expect(Object.isFrozen(g2.nodes)).toBe(true);
      expect(Object.isFrozen(g2.edges)).toBe(true);
    });

    it("leaves unrelated edges intact", () => {
      const n1 = makeNode({ kind: "a", data: {} });
      const n2 = makeNode({ kind: "b", data: {} });
      const n3 = makeNode({ kind: "c", data: {} });
      const e = makeEdge({
        source: n1.id,
        sourcePort: "out",
        target: n2.id,
        targetPort: "in",
      });

      let g = makeGraph("G");
      g = addNodeToGraph(g, n1);
      g = addNodeToGraph(g, n2);
      g = addNodeToGraph(g, n3);
      g = addEdgeToGraph(g, e);

      const g2 = removeNodeFromGraph(g, n3.id);
      expect(g2.edges).toHaveLength(1);
      expect(g2.edges[0]).toBe(e);
    });
  });

  describe("addEdgeToGraph", () => {
    it("returns a new graph containing the added edge", () => {
      const n1 = makeNode({ kind: "a", data: {} });
      const n2 = makeNode({ kind: "b", data: {} });
      const edge = makeEdge({
        source: n1.id,
        sourcePort: "out",
        target: n2.id,
        targetPort: "in",
      });
      let g = makeGraph("G");
      g = addNodeToGraph(g, n1);
      g = addNodeToGraph(g, n2);
      const g2 = addEdgeToGraph(g, edge);

      expect(g2.edges).toHaveLength(1);
      expect(g2.edges[0]).toBe(edge);
    });

    it("does not mutate the original graph", () => {
      const edge = makeEdge({
        source: "a",
        sourcePort: "out",
        target: "b",
        targetPort: "in",
      });
      const g = makeGraph("G");
      const g2 = addEdgeToGraph(g, edge);

      expect(g.edges).toHaveLength(0);
      expect(g2).not.toBe(g);
    });

    it("returns a frozen graph", () => {
      const g2 = addEdgeToGraph(
        makeGraph("G"),
        makeEdge({ source: "a", sourcePort: "o", target: "b", targetPort: "i" }),
      );
      expect(Object.isFrozen(g2)).toBe(true);
      expect(Object.isFrozen(g2.edges)).toBe(true);
    });
  });

  describe("removeEdgeFromGraph", () => {
    it("removes the edge by id", () => {
      const edge = makeEdge({
        source: "a",
        sourcePort: "out",
        target: "b",
        targetPort: "in",
      });
      const g = addEdgeToGraph(makeGraph("G"), edge);
      const g2 = removeEdgeFromGraph(g, edge.id);

      expect(g2.edges).toHaveLength(0);
    });

    it("does not mutate the original graph", () => {
      const edge = makeEdge({
        source: "a",
        sourcePort: "out",
        target: "b",
        targetPort: "in",
      });
      const g = addEdgeToGraph(makeGraph("G"), edge);
      const g2 = removeEdgeFromGraph(g, edge.id);

      expect(g.edges).toHaveLength(1);
      expect(g2).not.toBe(g);
    });

    it("preserves unrelated edges", () => {
      const e1 = makeEdge({ source: "a", sourcePort: "o", target: "b", targetPort: "i" });
      const e2 = makeEdge({ source: "c", sourcePort: "o", target: "d", targetPort: "i" });
      let g = makeGraph("G");
      g = addEdgeToGraph(g, e1);
      g = addEdgeToGraph(g, e2);
      const g2 = removeEdgeFromGraph(g, e1.id);

      expect(g2.edges).toHaveLength(1);
      expect(g2.edges[0]).toBe(e2);
    });

    it("returns a frozen graph", () => {
      const edge = makeEdge({
        source: "a",
        sourcePort: "out",
        target: "b",
        targetPort: "in",
      });
      const g2 = removeEdgeFromGraph(addEdgeToGraph(makeGraph("G"), edge), edge.id);
      expect(Object.isFrozen(g2)).toBe(true);
      expect(Object.isFrozen(g2.edges)).toBe(true);
    });
  });

  describe("immutability verification", () => {
    it("structural equality but reference inequality after add/remove round trip", () => {
      const g1 = makeGraph("G");
      const node = makeNode({ kind: "t", data: { x: 1 } });
      const g2 = addNodeToGraph(g1, node);
      const g3 = removeNodeFromGraph(g2, node.id);

      // Structurally equal (same nodes/edges content)
      expect(g3.nodes).toEqual(g1.nodes);
      expect(g3.edges).toEqual(g1.edges);
      expect(g3.name).toBe(g1.name);
      expect(g3.schemaVersion).toBe(g1.schemaVersion);

      // Reference inequality
      expect(g3).not.toBe(g1);
      expect(g3.nodes).not.toBe(g1.nodes);
    });
  });
});
