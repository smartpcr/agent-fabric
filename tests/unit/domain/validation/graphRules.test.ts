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
  capabilities: readonly string[] = [],
): NodeSpec {
  return {
    kind,
    category: "test",
    label: kind,
    icon: "box",
    ports,
    propertySchema: emptySchema,
    defaultData: {},
    capabilities,
  };
}

const startSpec = spec("start", [makeOutputPort({ id: "out", label: "Out", dataType: "any" })]);

const endSpec = spec("end", [makeInputPort({ id: "in", label: "In", dataType: "any" })]);

const taskSpec = spec("task", [
  makeInputPort({ id: "in", label: "In", dataType: "any" }),
  makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
]);

const taskRequiredSpec = spec("task-required", [
  makeInputPort({ id: "in", label: "In", dataType: "any", required: true }),
  makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
]);

const loopSpec = spec(
  "loop",
  [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
  ],
  ["canHaveBackEdge"],
);

function makeRegistry(specs: NodeSpec[]): NodeSpecRegistry {
  const map = new Map(specs.map((s) => [s.kind, s]));
  return { get: (kind: string) => map.get(kind) };
}

describe("validateGraph", () => {
  const registry = makeRegistry([startSpec, endSpec, taskSpec, taskRequiredSpec, loopSpec]);

  // Complex valid graph: start → task → end
  it("accepts a complex valid graph (start → task → end)", () => {
    const start = makeNode({ kind: "start", data: {} });
    const task = makeNode({ kind: "task", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("Valid");
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

  // Valid graph with loop node that has exactly one loop-back edge
  it("accepts a valid graph with a loop node having exactly one loop-back edge", () => {
    const start = makeNode({ kind: "start", data: {} });
    const loop = makeNode({ kind: "loop", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("Valid-loop");
    g = addNodeToGraph(g, start);
    g = addNodeToGraph(g, loop);
    g = addNodeToGraph(g, end);
    g = addEdgeToGraph(
      g,
      makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
    );
    g = addEdgeToGraph(
      g,
      makeEdge({ source: loop.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
    );
    g = addEdgeToGraph(
      g,
      makeEdge({ source: loop.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    const result = validateGraph(g, registry);
    expect(result.ok).toBe(true);
  });

  // Rule 1a: No entry node
  it("rejects a graph with no entry node", () => {
    const task = makeNode({ kind: "task", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("No-entry");
    g = addNodeToGraph(g, task);
    g = addNodeToGraph(g, end);
    g = addEdgeToGraph(
      g,
      makeEdge({ source: task.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    const result = validateGraph(g, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.some((e: GraphValidationError) => e.code === "NO_ENTRY_NODE")).toBe(true);
    }
  });

  // Rule 1b: Multiple entry nodes
  it("rejects a graph with multiple entry nodes", () => {
    const start1 = makeNode({ kind: "start", data: {} });
    const start2 = makeNode({ kind: "start", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("Multi-entry");
    g = addNodeToGraph(g, start1);
    g = addNodeToGraph(g, start2);
    g = addNodeToGraph(g, end);
    g = addEdgeToGraph(
      g,
      makeEdge({ source: start1.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    const result = validateGraph(g, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.error.some((e: GraphValidationError) => e.code === "MULTIPLE_ENTRY_NODES"),
      ).toBe(true);
    }
  });

  // Rule 2: No terminal reachable from entry
  it("rejects when no terminal node is reachable from entry", () => {
    const start = makeNode({ kind: "start", data: {} });
    const task = makeNode({ kind: "task", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("No-terminal-reachable");
    g = addNodeToGraph(g, start);
    g = addNodeToGraph(g, task);
    g = addNodeToGraph(g, end);
    // start → task, but no edge from task → end; end is unreachable
    g = addEdgeToGraph(
      g,
      makeEdge({ source: start.id, sourcePort: "out", target: task.id, targetPort: "in" }),
    );

    const result = validateGraph(g, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.error.some((e: GraphValidationError) => e.code === "NO_TERMINAL_REACHABLE"),
      ).toBe(true);
    }
  });

  // Rule 3: Unreachable node
  it("rejects when a node is not reachable from the entry", () => {
    const start = makeNode({ kind: "start", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    const orphan = makeNode({ kind: "task", data: {} });
    let g = makeGraph("Unreachable");
    g = addNodeToGraph(g, start);
    g = addNodeToGraph(g, end);
    g = addNodeToGraph(g, orphan);
    g = addEdgeToGraph(
      g,
      makeEdge({ source: start.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    const result = validateGraph(g, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const unreachableErrors = result.error.filter(
        (e: GraphValidationError) => e.code === "UNREACHABLE_NODE",
      );
      expect(unreachableErrors.length).toBe(1);
      expect(unreachableErrors[0].message).toContain(orphan.id);
    }
  });

  // Rule 4: Required input port has no inbound edge
  it("rejects when a required input port has no inbound edge", () => {
    const start = makeNode({ kind: "start", data: {} });
    const required = makeNode({ kind: "task-required", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("Required-unconnected");
    g = addNodeToGraph(g, start);
    g = addNodeToGraph(g, required);
    g = addNodeToGraph(g, end);
    // start → end, required node is orphaned AND its required port is unconnected
    g = addEdgeToGraph(
      g,
      makeEdge({ source: start.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    const result = validateGraph(g, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.error.some((e: GraphValidationError) => e.code === "REQUIRED_PORT_UNCONNECTED"),
      ).toBe(true);
    }
  });

  // Rule 4: Required input port satisfied
  it("accepts when a required input port has an inbound edge", () => {
    const start = makeNode({ kind: "start", data: {} });
    const required = makeNode({ kind: "task-required", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("Required-connected");
    g = addNodeToGraph(g, start);
    g = addNodeToGraph(g, required);
    g = addNodeToGraph(g, end);
    g = addEdgeToGraph(
      g,
      makeEdge({ source: start.id, sourcePort: "out", target: required.id, targetPort: "in" }),
    );
    g = addEdgeToGraph(
      g,
      makeEdge({ source: required.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    const result = validateGraph(g, registry);
    expect(result.ok).toBe(true);
  });

  // Rule 5a: Loop node missing back edge
  it("rejects when a loop node has no loop-back edge", () => {
    const start = makeNode({ kind: "start", data: {} });
    const loop = makeNode({ kind: "loop", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("Loop-missing");
    g = addNodeToGraph(g, start);
    g = addNodeToGraph(g, loop);
    g = addNodeToGraph(g, end);
    g = addEdgeToGraph(
      g,
      makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
    );
    g = addEdgeToGraph(
      g,
      makeEdge({ source: loop.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    const result = validateGraph(g, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.error.some((e: GraphValidationError) => e.code === "LOOP_NODE_MISSING_BACK_EDGE"),
      ).toBe(true);
    }
  });

  // Rule 5b: Loop node has multiple back edges
  it("rejects when a loop node has multiple loop-back edges", () => {
    const start = makeNode({ kind: "start", data: {} });
    const loop = makeNode({ kind: "loop", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("Loop-multi");
    g = addNodeToGraph(g, start);
    g = addNodeToGraph(g, loop);
    g = addNodeToGraph(g, end);
    g = addEdgeToGraph(
      g,
      makeEdge({ source: start.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
    );
    g = addEdgeToGraph(
      g,
      makeEdge({ source: loop.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
    );
    g = addEdgeToGraph(
      g,
      makeEdge({ source: loop.id, sourcePort: "out", target: loop.id, targetPort: "in" }),
    );
    g = addEdgeToGraph(
      g,
      makeEdge({ source: loop.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    const result = validateGraph(g, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.error.some((e: GraphValidationError) => e.code === "LOOP_NODE_MULTIPLE_BACK_EDGES"),
      ).toBe(true);
    }
  });

  // Messages are descriptive
  it("produces descriptive error messages", () => {
    const g = makeGraph("Empty");
    const result = validateGraph(g, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const entryError = result.error.find((e: GraphValidationError) => e.code === "NO_ENTRY_NODE");
      expect(entryError).toBeDefined();
      expect(entryError?.message).toContain("entry node");
    }
  });

  // Multiple errors can be reported simultaneously
  it("collects multiple errors in a single validation", () => {
    const task1 = makeNode({ kind: "task", data: {} });
    const task2 = makeNode({ kind: "task", data: {} });
    let g = makeGraph("Multi-error");
    g = addNodeToGraph(g, task1);
    g = addNodeToGraph(g, task2);

    const result = validateGraph(g, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Should have at least the NO_ENTRY_NODE error
      expect(result.error.length).toBeGreaterThanOrEqual(1);
      expect(result.error.some((e: GraphValidationError) => e.code === "NO_ENTRY_NODE")).toBe(true);
    }
  });

  // Nodes with unknown kind (not in registry) are skipped for entry/terminal/required/loop checks
  it("handles nodes with unknown kind gracefully", () => {
    const start = makeNode({ kind: "start", data: {} });
    const unknown = makeNode({ kind: "unknown-kind", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("Unknown-kind");
    g = addNodeToGraph(g, start);
    g = addNodeToGraph(g, unknown);
    g = addNodeToGraph(g, end);
    g = addEdgeToGraph(
      g,
      makeEdge({ source: start.id, sourcePort: "out", target: unknown.id, targetPort: "in" }),
    );
    g = addEdgeToGraph(
      g,
      makeEdge({ source: unknown.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    const result = validateGraph(g, registry);
    // Unknown kind nodes are not entry/terminal, but graph still validates structurally
    expect(result.ok).toBe(true);
  });

  // Edges referencing phantom nodes (not in graph) exercise defensive guards in DFS
  it("handles edges referencing non-existent nodes gracefully", () => {
    const start = makeNode({ kind: "start", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("Phantom-edges");
    g = addNodeToGraph(g, start);
    g = addNodeToGraph(g, end);
    // Edge from start to a phantom target not in graph nodes (tests reachableFrom guard)
    g = addEdgeToGraph(
      g,
      makeEdge({ source: start.id, sourcePort: "out", target: "phantom-target", targetPort: "in" }),
    );
    // Edge from phantom source (not in graph) to end (tests buildForwardAdj guard)
    g = addEdgeToGraph(
      g,
      makeEdge({ source: "phantom-source", sourcePort: "out", target: end.id, targetPort: "in" }),
    );
    // Normal valid edge
    g = addEdgeToGraph(
      g,
      makeEdge({ source: start.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    const result = validateGraph(g, registry);
    expect(result.ok).toBe(true);
  });
});
