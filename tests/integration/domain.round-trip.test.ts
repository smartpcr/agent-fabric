import { describe, it, expect } from "vitest";
import { makeGraph, addNodeToGraph, addEdgeToGraph } from "@/domain/models/graph";
import { makeNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";
import { serialize } from "@/domain/serialization/serialize";
import { deserialize } from "@/domain/serialization/deserialize";
import { validateGraph } from "@/domain/validation/graphRules";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";

describe("domain round-trip integration", () => {
  it("builds a 3-node graph, serializes, deserializes, and validates with deep equality", () => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);

    const start = makeNode({ kind: "start", data: {} });
    const task = makeNode({ kind: "task", data: { name: "Process", params: {} } });
    const end = makeNode({ kind: "end", data: {} });

    let graph = makeGraph("Integration Test");
    graph = addNodeToGraph(graph, start);
    graph = addNodeToGraph(graph, task);
    graph = addNodeToGraph(graph, end);
    graph = addEdgeToGraph(
      graph,
      makeEdge({ source: start.id, sourcePort: "out", target: task.id, targetPort: "in" }),
    );
    graph = addEdgeToGraph(
      graph,
      makeEdge({ source: task.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    const json = serialize(graph, registry);
    const restored = deserialize(json, registry);

    expect(restored.id).toBe(graph.id);
    expect(restored.name).toBe(graph.name);
    expect(restored.schemaVersion).toBe(graph.schemaVersion);
    expect(restored.nodes).toHaveLength(graph.nodes.length);
    expect(restored.edges).toHaveLength(graph.edges.length);

    for (const origNode of graph.nodes) {
      const found = restored.nodes.find((n) => n.id === origNode.id);
      expect(found).toBeDefined();
      expect(found?.kind).toBe(origNode.kind);
      expect(found?.position).toEqual(origNode.position);
      expect(found?.data).toEqual(origNode.data);
    }

    for (const origEdge of graph.edges) {
      const found = restored.edges.find((e) => e.id === origEdge.id);
      expect(found).toBeDefined();
      expect(found?.source).toBe(origEdge.source);
      expect(found?.target).toBe(origEdge.target);
      expect(found?.sourcePort).toBe(origEdge.sourcePort);
      expect(found?.targetPort).toBe(origEdge.targetPort);
      expect(found?.kind).toBe(origEdge.kind);
    }

    const validationResult = validateGraph(restored, registry);
    expect(validationResult.ok).toBe(true);
  });

  it("re-serialized output matches the original serialization byte-for-byte", () => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);

    const start = makeNode({ kind: "start", data: {} });
    const task = makeNode({ kind: "task", data: { name: "Process", params: {} } });
    const end = makeNode({ kind: "end", data: {} });

    let graph = makeGraph("Round Trip");
    graph = addNodeToGraph(graph, start);
    graph = addNodeToGraph(graph, task);
    graph = addNodeToGraph(graph, end);
    graph = addEdgeToGraph(
      graph,
      makeEdge({ source: start.id, sourcePort: "out", target: task.id, targetPort: "in" }),
    );
    graph = addEdgeToGraph(
      graph,
      makeEdge({ source: task.id, sourcePort: "out", target: end.id, targetPort: "in" }),
    );

    const json1 = serialize(graph, registry);
    const restored = deserialize(json1, registry);
    const json2 = serialize(restored, registry);

    expect(JSON.stringify(json2)).toBe(JSON.stringify(json1));
  });
});
