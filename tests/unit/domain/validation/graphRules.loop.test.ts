import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateGraph, type GraphValidationError } from "@/domain/validation/graphRules";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";
import { makeGraph, addNodeToGraph, addEdgeToGraph } from "@/domain/models/graph";
import { makeNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const emptySchema = z.object({});

function spec(
  kind: string,
  ports: NodeSpec["ports"],
  opts: { capabilities?: readonly string[] } = {},
): NodeSpec {
  return {
    kind,
    category: "test",
    label: kind,
    icon: "box",
    ports,
    propertySchema: emptySchema,
    defaultData: {},
    capabilities: opts.capabilities ?? [],
  };
}

const startSpec = spec("start", [makeOutputPort({ id: "out", label: "Out", dataType: "any" })]);
const endSpec = spec("end", [makeInputPort({ id: "in", label: "In", dataType: "any" })]);

const loopWhileSpec = spec(
  "loop-while",
  [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "body-out", label: "Body Out", dataType: "any" }),
    makeInputPort({ id: "body-in", label: "Body In", dataType: "any" }),
    makeOutputPort({ id: "done", label: "Done", dataType: "any" }),
  ],
  { capabilities: ["canHaveBackEdge"] },
);

const loopForEachSpec = spec(
  "loop-foreach",
  [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "body-out", label: "Body Out", dataType: "any" }),
    makeInputPort({ id: "body-in", label: "Body In", dataType: "any" }),
    makeOutputPort({ id: "done", label: "Done", dataType: "any" }),
    makeOutputPort({ id: "break", label: "Break", dataType: "any" }),
  ],
  { capabilities: ["canHaveBackEdge"] },
);

const taskSpec = spec("task", [
  makeInputPort({ id: "in", label: "In", dataType: "any" }),
  makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
]);

function makeRegistry(specs: NodeSpec[]): NodeSpecRegistry {
  const map = new Map(specs.map((s) => [s.kind, s]));
  return { get: (kind: string) => map.get(kind) };
}

const registry = makeRegistry([startSpec, endSpec, loopWhileSpec, loopForEachSpec, taskSpec]);

describe("validateGraph — loop node rules", () => {
  describe("exactly one loop-back edge", () => {
    it("accepts a while-loop with exactly one back-edge targeting body-in", () => {
      const start = makeNode({ kind: "start", data: {} });
      const loop = makeNode({ kind: "loop-while", data: { condition: "x < 10" } });
      const task = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("valid-while-loop");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, task);
      g = addNodeToGraph(g, end);
      // start → loop
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
      );
      // loop body-out → task
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop.id, sourcePort: "body-out", target: task.id, targetPort: "in" }),
      );
      // task → loop body-in (the back-edge)
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: loop.id,
          sourcePort: "body-out",
          target: loop.id,
          targetPort: "body-in",
          kind: "loop-back",
        }),
      );
      // loop done → end
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop.id, sourcePort: "done", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(true);
    });

    it("rejects when loop node has 0 back-edges", () => {
      const start = makeNode({ kind: "start", data: {} });
      const loop = makeNode({ kind: "loop-while", data: { condition: "x < 10" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("no-back-edge");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop.id, sourcePort: "done", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const missing = result.error.filter(
          (e: GraphValidationError) => e.code === "LOOP_NODE_MISSING_BACK_EDGE",
        );
        expect(missing.length).toBe(1);
        expect(missing[0].message).toContain(loop.id);
      }
    });

    it("rejects when loop node has 2 back-edges", () => {
      const start = makeNode({ kind: "start", data: {} });
      const loop = makeNode({ kind: "loop-while", data: { condition: "x < 10" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("two-back-edges");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
      );
      // Two back-edges
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: loop.id,
          sourcePort: "body-out",
          target: loop.id,
          targetPort: "body-in",
          kind: "loop-back",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: loop.id,
          sourcePort: "body-out",
          target: loop.id,
          targetPort: "body-in",
          kind: "loop-back",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop.id, sourcePort: "done", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const multiple = result.error.filter(
          (e: GraphValidationError) => e.code === "LOOP_NODE_MULTIPLE_BACK_EDGES",
        );
        expect(multiple.length).toBe(1);
        expect(multiple[0].message).toContain("2");
      }
    });
  });

  describe("back-edge target must be body-in", () => {
    it("rejects when back-edge targets 'in' instead of 'body-in'", () => {
      const start = makeNode({ kind: "start", data: {} });
      const loop = makeNode({ kind: "loop-while", data: { condition: "x < 10" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("wrong-target-in");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
      );
      // Back-edge targets "in" instead of "body-in"
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: loop.id,
          sourcePort: "body-out",
          target: loop.id,
          targetPort: "in",
          kind: "loop-back",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop.id, sourcePort: "done", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const wrongTarget = result.error.filter(
          (e: GraphValidationError) => e.code === "LOOP_BACK_EDGE_WRONG_TARGET",
        );
        expect(wrongTarget.length).toBe(1);
        expect(wrongTarget[0].message).toContain("in");
        expect(wrongTarget[0].message).toContain("body-in");
      }
    });

    it("rejects when back-edge targets an arbitrary port", () => {
      const start = makeNode({ kind: "start", data: {} });
      const loop = makeNode({ kind: "loop-while", data: { condition: "x < 10" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("wrong-target-arbitrary");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
      );
      // Back-edge targets "done" (wrong port)
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: loop.id,
          sourcePort: "body-out",
          target: loop.id,
          targetPort: "done",
          kind: "loop-back",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop.id, sourcePort: "done", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const wrongTarget = result.error.filter(
          (e: GraphValidationError) => e.code === "LOOP_BACK_EDGE_WRONG_TARGET",
        );
        expect(wrongTarget.length).toBe(1);
        expect(wrongTarget[0].message).toContain("done");
        expect(wrongTarget[0].message).toContain("body-in");
      }
    });

    it("accepts correct body-in target", () => {
      const start = makeNode({ kind: "start", data: {} });
      const loop = makeNode({ kind: "loop-while", data: { condition: "x < 10" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("correct-target");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: loop.id,
          sourcePort: "body-out",
          target: loop.id,
          targetPort: "body-in",
          kind: "loop-back",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop.id, sourcePort: "done", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(true);
    });
  });

  describe("for-each variant", () => {
    it("accepts a foreach-loop with correct back-edge", () => {
      const start = makeNode({ kind: "start", data: {} });
      const loop = makeNode({ kind: "loop-foreach", data: { iterable: "items", item: "item" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("valid-foreach");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: loop.id,
          sourcePort: "body-out",
          target: loop.id,
          targetPort: "body-in",
          kind: "loop-back",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop.id, sourcePort: "done", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(true);
    });

    it("rejects foreach-loop with wrong back-edge target", () => {
      const start = makeNode({ kind: "start", data: {} });
      const loop = makeNode({ kind: "loop-foreach", data: { iterable: "items", item: "item" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("foreach-wrong-target");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: loop.id,
          sourcePort: "body-out",
          target: loop.id,
          targetPort: "in",
          kind: "loop-back",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop.id, sourcePort: "done", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const wrongTarget = result.error.filter(
          (e: GraphValidationError) => e.code === "LOOP_BACK_EDGE_WRONG_TARGET",
        );
        expect(wrongTarget.length).toBe(1);
      }
    });
  });

  describe("edge cases", () => {
    it("collects both missing-back-edge and wrong-target errors on different nodes", () => {
      const start = makeNode({ kind: "start", data: {} });
      const loop1 = makeNode({ kind: "loop-while", data: { condition: "a" } });
      const loop2 = makeNode({ kind: "loop-while", data: { condition: "b" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("multi-loop-errors");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, loop1);
      g = addNodeToGraph(g, loop2);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: loop1.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop1.id, sourcePort: "done", target: loop2.id, targetPort: "in" }),
      );
      // loop1: no back-edge (missing)
      // loop2: back-edge to wrong port
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: loop2.id,
          sourcePort: "body-out",
          target: loop2.id,
          targetPort: "in",
          kind: "loop-back",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop2.id, sourcePort: "done", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const missing = result.error.filter(
          (e: GraphValidationError) => e.code === "LOOP_NODE_MISSING_BACK_EDGE",
        );
        const wrongTarget = result.error.filter(
          (e: GraphValidationError) => e.code === "LOOP_BACK_EDGE_WRONG_TARGET",
        );
        expect(missing.length).toBe(1);
        expect(wrongTarget.length).toBe(1);
      }
    });

    it("non-loop nodes are not affected by loop rules", () => {
      const start = makeNode({ kind: "start", data: {} });
      const task = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("no-loop-nodes");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, task);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: task.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: task.id, sourcePort: "out", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(true);
    });

    it("error messages are descriptive and include node id, kind, and port", () => {
      const start = makeNode({ kind: "start", data: {} });
      const loop = makeNode({ kind: "loop-while", data: { condition: "x" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("descriptive");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: loop.id,
          sourcePort: "body-out",
          target: loop.id,
          targetPort: "wrong",
          kind: "loop-back",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop.id, sourcePort: "done", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const wrongTarget = result.error.find(
          (e: GraphValidationError) => e.code === "LOOP_BACK_EDGE_WRONG_TARGET",
        );
        expect(wrongTarget).toBeDefined();
        if (wrongTarget) {
          expect(wrongTarget.message).toContain(loop.id);
          expect(wrongTarget.message).toContain("loop-while");
          expect(wrongTarget.message).toContain("wrong");
          expect(wrongTarget.message).toContain("body-in");
        }
      }
    });
  });
});
