import { describe, it, expect } from "vitest";
import { z } from "zod";
import { serialize } from "@/domain/serialization/serialize";
import { makeGraph, addNodeToGraph, addEdgeToGraph } from "@/domain/models/graph";
import { makeNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import { SerializationError } from "@/domain/validation/errors";
import { GraphJsonV1 } from "@/domain/serialization/schema.v1";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";

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

function makeRegistry(): NodeSpecRegistry {
  const map = new Map([
    ["start", startSpec],
    ["end", endSpec],
    ["task", taskSpec],
  ]);
  return { get: (kind: string) => map.get(kind) };
}

const registry = makeRegistry();

function buildValidGraph() {
  const start = makeNode({ kind: "start", data: {} });
  const task = makeNode({ kind: "task", data: { name: "Do stuff" } });
  const end = makeNode({ kind: "end", data: {} });
  let g = makeGraph("Test Graph");
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
  return { g, start, task, end };
}

describe("serialize", () => {
  it("serializes a valid graph into GraphJsonV1-compliant output", () => {
    const { g } = buildValidGraph();
    const json = serialize(g, registry);
    const result = GraphJsonV1.safeParse(json);
    expect(result.success).toBe(true);
  });

  it("preserves all fields from the graph", () => {
    const { g, start, task, end } = buildValidGraph();
    const json = serialize(g, registry);

    expect(json.schemaVersion).toBe(1);
    expect(json.id).toBe(g.id);
    expect(json.name).toBe("Test Graph");
    expect(json.nodes.length).toBe(3);
    expect(json.edges.length).toBe(2);

    const nodeIds = json.nodes.map((n) => n.id);
    expect(nodeIds).toContain(start.id);
    expect(nodeIds).toContain(task.id);
    expect(nodeIds).toContain(end.id);

    const taskNode = json.nodes.find((n) => n.id === task.id);
    expect(taskNode?.data).toEqual({ name: "Do stuff" });
    expect(taskNode?.kind).toBe("task");
    expect(taskNode?.position).toEqual({ x: 0, y: 0 });
  });

  it("produces deterministic key order (alphabetical)", () => {
    const { g } = buildValidGraph();
    const json1 = JSON.stringify(serialize(g, registry));
    const json2 = JSON.stringify(serialize(g, registry));
    expect(json1).toBe(json2);

    // Verify keys are alphabetically sorted at top level
    const parsed = JSON.parse(json1) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    const sortedKeys = [...keys].sort();
    expect(keys).toEqual(sortedKeys);
  });

  it("produces stable output byte-for-byte across runs", () => {
    const { g } = buildValidGraph();
    const outputs: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      outputs.push(JSON.stringify(serialize(g, registry)));
    }
    const unique = new Set(outputs);
    expect(unique.size).toBe(1);
  });

  it("preserves optional edge label and condition", () => {
    const start = makeNode({ kind: "start", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("Optional fields");
    g = addNodeToGraph(g, start);
    g = addNodeToGraph(g, end);
    g = addEdgeToGraph(
      g,
      makeEdge({
        source: start.id,
        sourcePort: "out",
        target: end.id,
        targetPort: "in",
        label: "yes",
        condition: "x > 0",
      }),
    );

    const json = serialize(g, registry);
    expect(json.edges[0].label).toBe("yes");
    expect(json.edges[0].condition).toBe("x > 0");
  });

  it("throws SerializationError on invalid graph (no entry node)", () => {
    const task = makeNode({ kind: "task", data: {} });
    const end = makeNode({ kind: "end", data: {} });
    let g = makeGraph("Invalid");
    g = addNodeToGraph(g, task);
    g = addNodeToGraph(g, end);
    g = addEdgeToGraph(
      g,
      makeEdge({ source: task.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    expect(() => serialize(g, registry)).toThrow(SerializationError);
  });

  it("SerializationError has code INVALID_GRAPH", () => {
    const g = makeGraph("Empty");
    try {
      serialize(g, registry);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SerializationError);
      expect((err as SerializationError).code).toBe("INVALID_GRAPH");
    }
  });

  it("SerializationError message contains validation error details", () => {
    const g = makeGraph("Empty");
    try {
      serialize(g, registry);
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as SerializationError).message).toContain("entry node");
    }
  });

  it("node keys are alphabetically ordered in serialized output", () => {
    const { g } = buildValidGraph();
    const json = serialize(g, registry);
    const nodeStr = JSON.stringify(json.nodes[0]);
    const nodeObj = JSON.parse(nodeStr) as Record<string, unknown>;
    const keys = Object.keys(nodeObj);
    expect(keys).toEqual([...keys].sort());
  });

  it("edge keys are alphabetically ordered in serialized output", () => {
    const { g } = buildValidGraph();
    const json = serialize(g, registry);
    const edgeStr = JSON.stringify(json.edges[0]);
    const edgeObj = JSON.parse(edgeStr) as Record<string, unknown>;
    const keys = Object.keys(edgeObj);
    expect(keys).toEqual([...keys].sort());
  });
});
