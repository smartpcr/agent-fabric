import { describe, it, expect } from "vitest";
import type { ElkNode } from "elkjs/lib/elk-api";
import { fromElkLayout } from "@/domain/layout/elkAdapter";
import { makeGraph, addNodeToGraph, addEdgeToGraph } from "@/domain/models/graph";
import { makeNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";

describe("fromElkLayout", () => {
  describe("empty / no-op cases", () => {
    it("returns the original graph when it has no nodes", () => {
      const g = makeGraph("Empty");
      const elkResult: ElkNode = { id: g.id, children: [] };

      const result = fromElkLayout(elkResult, g);

      expect(result).toBe(g);
    });

    it("returns the original graph when ELK result has no children", () => {
      const start = makeNode({ kind: "start", data: {} });
      let g = makeGraph("No Children");
      g = addNodeToGraph(g, start);

      const elkResult: ElkNode = { id: g.id };

      const result = fromElkLayout(elkResult, g);

      expect(result).toBe(g);
    });

    it("returns the original graph when ELK children is empty array", () => {
      const g = makeGraph("Empty Children");
      const elkResult: ElkNode = { id: g.id, children: [] };

      const result = fromElkLayout(elkResult, g);

      expect(result).toBe(g);
    });
  });

  describe("position application", () => {
    it("applies ELK x,y to each node position", () => {
      const start = makeNode({ kind: "start", data: {}, position: { x: 0, y: 0 } });
      const end = makeNode({ kind: "end", data: {}, position: { x: 0, y: 0 } });
      let g = makeGraph("Positions");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, end);

      const elkResult: ElkNode = {
        id: g.id,
        children: [
          { id: start.id, x: 100, y: 200 },
          { id: end.id, x: 400, y: 200 },
        ],
      };

      const result = fromElkLayout(elkResult, g);

      const startNode = result.nodes.find((n) => n.id === start.id);
      const endNode = result.nodes.find((n) => n.id === end.id);

      expect(startNode?.position).toEqual({ x: 100, y: 200 });
      expect(endNode?.position).toEqual({ x: 400, y: 200 });
    });

    it("defaults to x:0,y:0 when ELK child has no coordinates", () => {
      const start = makeNode({ kind: "start", data: {}, position: { x: 50, y: 50 } });
      let g = makeGraph("No Coords");
      g = addNodeToGraph(g, start);

      const elkResult: ElkNode = {
        id: g.id,
        children: [{ id: start.id }],
      };

      const result = fromElkLayout(elkResult, g);

      const node = result.nodes.find((n) => n.id === start.id);
      expect(node?.position).toEqual({ x: 0, y: 0 });
    });

    it("leaves node unchanged when ELK has no matching child", () => {
      const start = makeNode({ kind: "start", data: {}, position: { x: 10, y: 20 } });
      let g = makeGraph("No Match");
      g = addNodeToGraph(g, start);

      const elkResult: ElkNode = {
        id: g.id,
        children: [{ id: "some-other-id", x: 999, y: 999 }],
      };

      const result = fromElkLayout(elkResult, g);

      const node = result.nodes.find((n) => n.id === start.id);
      expect(node?.position).toEqual({ x: 10, y: 20 });
    });

    it("handles fractional coordinates", () => {
      const task = makeNode({ kind: "task", data: {} });
      let g = makeGraph("Fractional");
      g = addNodeToGraph(g, task);

      const elkResult: ElkNode = {
        id: g.id,
        children: [{ id: task.id, x: 12.5, y: 37.75 }],
      };

      const result = fromElkLayout(elkResult, g);

      const node = result.nodes.find((n) => n.id === task.id);
      expect(node?.position).toEqual({ x: 12.5, y: 37.75 });
    });
  });

  describe("edges untouched", () => {
    it("preserves all edges without modification", () => {
      const start = makeNode({ kind: "start", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("Edges Preserved");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, end);
      const edge = makeEdge({
        source: start.id,
        sourcePort: "out",
        target: end.id,
        targetPort: "in",
        label: "next",
      });
      g = addEdgeToGraph(g, edge);

      const elkResult: ElkNode = {
        id: g.id,
        children: [
          { id: start.id, x: 100, y: 100 },
          { id: end.id, x: 300, y: 100 },
        ],
      };

      const result = fromElkLayout(elkResult, g);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].id).toBe(edge.id);
      expect(result.edges[0].source).toBe(edge.source);
      expect(result.edges[0].target).toBe(edge.target);
      expect(result.edges[0].sourcePort).toBe(edge.sourcePort);
      expect(result.edges[0].targetPort).toBe(edge.targetPort);
      expect(result.edges[0].label).toBe(edge.label);
      expect(result.edges[0].kind).toBe(edge.kind);
    });

    it("preserves loop-back edge metadata", () => {
      const loop = makeNode({ kind: "loop-while", data: { condition: "x" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("Loop Edges");
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, end);
      const backEdge = makeEdge({
        source: loop.id,
        sourcePort: "body-out",
        target: loop.id,
        targetPort: "body-in",
        kind: "loop-back",
      });
      const doneEdge = makeEdge({
        source: loop.id,
        sourcePort: "done",
        target: end.id,
        targetPort: "in",
      });
      g = addEdgeToGraph(g, backEdge);
      g = addEdgeToGraph(g, doneEdge);

      const elkResult: ElkNode = {
        id: g.id,
        children: [
          { id: loop.id, x: 50, y: 50 },
          { id: end.id, x: 300, y: 50 },
        ],
      };

      const result = fromElkLayout(elkResult, g);

      expect(result.edges).toHaveLength(2);
      const back = result.edges.find((e) => e.kind === "loop-back");
      expect(back).toBeDefined();
      expect(back?.source).toBe(loop.id);
      expect(back?.targetPort).toBe("body-in");
    });
  });

  describe("preserves non-position data", () => {
    it("preserves node kind, data, and other properties", () => {
      const task = makeNode({
        kind: "task",
        data: { name: "Process", params: { delay: 100 } },
        position: { x: 0, y: 0 },
      });
      let g = makeGraph("Node Data");
      g = addNodeToGraph(g, task);

      const elkResult: ElkNode = {
        id: g.id,
        children: [{ id: task.id, x: 200, y: 300 }],
      };

      const result = fromElkLayout(elkResult, g);

      const node = result.nodes.find((n) => n.id === task.id);
      expect(node?.kind).toBe("task");
      expect(node?.data).toEqual({ name: "Process", params: { delay: 100 } });
      expect(node?.position).toEqual({ x: 200, y: 300 });
    });

    it("preserves graph id, name, and schemaVersion", () => {
      const start = makeNode({ kind: "start", data: {} });
      let g = makeGraph("Metadata");
      g = addNodeToGraph(g, start);

      const elkResult: ElkNode = {
        id: g.id,
        children: [{ id: start.id, x: 10, y: 20 }],
      };

      const result = fromElkLayout(elkResult, g);

      expect(result.id).toBe(g.id);
      expect(result.name).toBe(g.name);
      expect(result.schemaVersion).toBe(g.schemaVersion);
    });
  });

  describe("multi-node graphs", () => {
    it("applies positions to a 3-node linear graph", () => {
      const start = makeNode({ kind: "start", data: {} });
      const task = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("Linear");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, task);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: start.id,
          sourcePort: "out",
          target: task.id,
          targetPort: "in",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: task.id,
          sourcePort: "out",
          target: end.id,
          targetPort: "in",
        }),
      );

      const elkResult: ElkNode = {
        id: g.id,
        children: [
          { id: start.id, x: 0, y: 50 },
          { id: task.id, x: 250, y: 50 },
          { id: end.id, x: 500, y: 50 },
        ],
      };

      const result = fromElkLayout(elkResult, g);

      expect(result.nodes).toHaveLength(3);
      expect(result.nodes.find((n) => n.id === start.id)?.position).toEqual({ x: 0, y: 50 });
      expect(result.nodes.find((n) => n.id === task.id)?.position).toEqual({ x: 250, y: 50 });
      expect(result.nodes.find((n) => n.id === end.id)?.position).toEqual({ x: 500, y: 50 });
      expect(result.edges).toHaveLength(2);
    });
  });
});
