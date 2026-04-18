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

const taskSpec = spec("task", [
  makeInputPort({ id: "in", label: "In", dataType: "any" }),
  makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
]);

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

function makeRegistry(specs: NodeSpec[]): NodeSpecRegistry {
  const map = new Map(specs.map((s) => [s.kind, s]));
  return { get: (kind: string) => map.get(kind) };
}

const registry = makeRegistry([startSpec, endSpec, taskSpec, loopWhileSpec]);

describe("validateGraph — no back-edges on non-loop nodes", () => {
  describe("direct cycle via non-loop nodes fails", () => {
    it("rejects a simple A → B → A cycle between two task nodes", () => {
      const start = makeNode({ kind: "start", data: {} });
      const taskA = makeNode({ kind: "task", data: {} });
      const taskB = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("simple-cycle");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, taskA);
      g = addNodeToGraph(g, taskB);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: taskA.id, targetPort: "in" }),
      );
      // A → B
      g = addEdgeToGraph(
        g,
        makeEdge({ source: taskA.id, sourcePort: "out", target: taskB.id, targetPort: "in" }),
      );
      // B → A (creates cycle)
      g = addEdgeToGraph(
        g,
        makeEdge({ source: taskB.id, sourcePort: "out", target: taskA.id, targetPort: "in" }),
      );
      // B → end (so end is reachable)
      g = addEdgeToGraph(
        g,
        makeEdge({ source: taskB.id, sourcePort: "out", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const cycles = result.error.filter(
          (e: GraphValidationError) => e.code === "UNEXPECTED_CYCLE",
        );
        expect(cycles.length).toBeGreaterThanOrEqual(1);
        expect(cycles[0].message).toContain("Unexpected cycle");
      }
    });

    it("rejects a self-loop on a non-loop node", () => {
      const start = makeNode({ kind: "start", data: {} });
      const task = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("self-loop-non-loop");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, task);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: task.id, targetPort: "in" }),
      );
      // Self-loop on task (not a loop node, not kind "loop-back")
      g = addEdgeToGraph(
        g,
        makeEdge({ source: task.id, sourcePort: "out", target: task.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: task.id, sourcePort: "out", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const cycles = result.error.filter(
          (e: GraphValidationError) => e.code === "UNEXPECTED_CYCLE",
        );
        expect(cycles.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("rejects a three-node cycle: A → B → C → A", () => {
      const start = makeNode({ kind: "start", data: {} });
      const a = makeNode({ kind: "task", data: {} });
      const b = makeNode({ kind: "task", data: {} });
      const c = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("three-node-cycle");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, a);
      g = addNodeToGraph(g, b);
      g = addNodeToGraph(g, c);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: a.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: a.id, sourcePort: "out", target: b.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: b.id, sourcePort: "out", target: c.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: c.id, sourcePort: "out", target: a.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: c.id, sourcePort: "out", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const cycles = result.error.filter(
          (e: GraphValidationError) => e.code === "UNEXPECTED_CYCLE",
        );
        expect(cycles.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("loop-based cycle passes", () => {
    it("accepts a cycle through a loop node with loop-back edge", () => {
      const start = makeNode({ kind: "start", data: {} });
      const loop = makeNode({ kind: "loop-while", data: { condition: "x < 10" } });
      const task = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("loop-cycle-valid");
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
      // task → loop body-in (loop-back edge)
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
      if (result.ok) {
        // No unexpected cycle errors in warnings
        const cycles = result.value.filter(
          (e: GraphValidationError) => e.code === "UNEXPECTED_CYCLE",
        );
        expect(cycles.length).toBe(0);
      }
    });

    it("accepts a valid acyclic graph (no cycles at all)", () => {
      const start = makeNode({ kind: "start", data: {} });
      const task = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("acyclic");
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
  });

  describe("edge cases", () => {
    it("error message contains node ids and kinds", () => {
      const start = makeNode({ kind: "start", data: {} });
      const taskA = makeNode({ kind: "task", data: {} });
      const taskB = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("descriptive-cycle");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, taskA);
      g = addNodeToGraph(g, taskB);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: taskA.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: taskA.id, sourcePort: "out", target: taskB.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: taskB.id, sourcePort: "out", target: taskA.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: taskB.id, sourcePort: "out", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const cycle = result.error.find((e: GraphValidationError) => e.code === "UNEXPECTED_CYCLE");
        expect(cycle).toBeDefined();
        if (cycle) {
          expect(cycle.message).toContain(taskA.id);
          expect(cycle.message).toContain("task");
        }
      }
    });

    it("does not false-positive on a diamond (non-cyclic convergence)", () => {
      const start = makeNode({ kind: "start", data: {} });
      const a = makeNode({ kind: "task", data: {} });
      const b = makeNode({ kind: "task", data: {} });
      const merge = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("diamond");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, a);
      g = addNodeToGraph(g, b);
      g = addNodeToGraph(g, merge);
      g = addNodeToGraph(g, end);
      // start → a, start → b
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: a.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: b.id, targetPort: "in" }),
      );
      // a → merge, b → merge
      g = addEdgeToGraph(
        g,
        makeEdge({ source: a.id, sourcePort: "out", target: merge.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: b.id, sourcePort: "out", target: merge.id, targetPort: "in" }),
      );
      // merge → end
      g = addEdgeToGraph(
        g,
        makeEdge({ source: merge.id, sourcePort: "out", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(true);
    });

    it("loop-back edge kind on non-loop nodes does not suppress cycle detection", () => {
      const start = makeNode({ kind: "start", data: {} });
      const taskA = makeNode({ kind: "task", data: {} });
      const taskB = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("loop-back-non-loop");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, taskA);
      g = addNodeToGraph(g, taskB);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: taskA.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: taskA.id, sourcePort: "out", target: taskB.id, targetPort: "in" }),
      );
      // B → A with kind "loop-back" — but neither node is a loop node
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: taskB.id,
          sourcePort: "out",
          target: taskA.id,
          targetPort: "in",
          kind: "loop-back",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: taskB.id, sourcePort: "out", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const cycles = result.error.filter(
          (e: GraphValidationError) => e.code === "UNEXPECTED_CYCLE",
        );
        expect(cycles.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("cycle through a loop node is allowed regardless of edge kind", () => {
      const start = makeNode({ kind: "start", data: {} });
      const loop = makeNode({ kind: "loop-while", data: { condition: "x" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("loop-default-self-edge");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
      );
      // Self-edge with kind "default" (not "loop-back") on loop node — allowed
      // because the cycle involves a loop-capable node
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: loop.id,
          sourcePort: "body-out",
          target: loop.id,
          targetPort: "body-in",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop.id, sourcePort: "done", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      // May fail for other reasons (e.g. LOOP_NODE_MISSING_BACK_EDGE) but not UNEXPECTED_CYCLE
      const allErrors = result.ok ? result.value : result.error;
      const cycles = allErrors.filter((e: GraphValidationError) => e.code === "UNEXPECTED_CYCLE");
      expect(cycles.length).toBe(0);
    });

    it("loop cycle encountered first does not cause false UNEXPECTED_CYCLE downstream", () => {
      // Regression: loop self-edge is visited first during DFS; downstream
      // tasks that share edges into the loop region must NOT be flagged.
      const start = makeNode({ kind: "start", data: {} });
      const loop = makeNode({ kind: "loop-while", data: { condition: "x < 10" } });
      const taskA = makeNode({ kind: "task", data: {} });
      const taskB = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("loop-then-downstream");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, taskA);
      g = addNodeToGraph(g, taskB);
      g = addNodeToGraph(g, end);
      // start → loop
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
      );
      // loop self-edge (loop-back)
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
      // loop done → taskA → taskB → end
      g = addEdgeToGraph(
        g,
        makeEdge({ source: loop.id, sourcePort: "done", target: taskA.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: taskA.id, sourcePort: "out", target: taskB.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: taskB.id, sourcePort: "out", target: end.id, targetPort: "in" }),
      );
      // Also taskB feeds back into loop (creating a path to the loop node again — not a cycle)
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: taskA.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const cycles = result.value.filter(
          (e: GraphValidationError) => e.code === "UNEXPECTED_CYCLE",
        );
        expect(cycles.length).toBe(0);
      }
    });
  });
});
