import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateConnection, type NodeSpecRegistry } from "@/domain/validation/connectionRules";
import { makeGraph, addNodeToGraph, addEdgeToGraph } from "@/domain/models/graph";
import { makeNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const emptySchema = z.object({});

function spec(kind: string, ports: NodeSpec["ports"]): NodeSpec {
  return {
    kind,
    category: "test",
    label: kind,
    icon: "box",
    ports,
    propertySchema: emptySchema,
    defaultData: {},
    capabilities: [],
  };
}

const multiInSpec = spec("multi-in", [
  makeInputPort({ id: "in", label: "In", dataType: "any", cardinality: "multi" }),
  makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
]);

const sourceSpec = spec("source", [makeOutputPort({ id: "out", label: "Out", dataType: "any" })]);

const singleInSpec = spec("single-in", [
  makeInputPort({ id: "in", label: "In", dataType: "any", cardinality: "single" }),
  makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
]);

function makeRegistry(specs: NodeSpec[]): NodeSpecRegistry {
  const map = new Map(specs.map((s) => [s.kind, s]));
  return { get: (kind: string) => map.get(kind) };
}

describe("connectionRules — multi cardinality fan-in", () => {
  const registry = makeRegistry([multiInSpec, sourceSpec, singleInSpec]);

  it("accepts first connection to a multi-cardinality input", () => {
    const src = makeNode({ kind: "source", data: {} });
    const tgt = makeNode({ kind: "multi-in", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, src);
    g = addNodeToGraph(g, tgt);

    const result = validateConnection(
      g,
      { nodeId: src.id, portId: "out" },
      { nodeId: tgt.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(true);
  });

  it("accepts second connection to a multi-cardinality input", () => {
    const src1 = makeNode({ kind: "source", data: {} });
    const src2 = makeNode({ kind: "source", data: {} });
    const tgt = makeNode({ kind: "multi-in", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, src1);
    g = addNodeToGraph(g, src2);
    g = addNodeToGraph(g, tgt);
    g = addEdgeToGraph(
      g,
      makeEdge({ source: src1.id, sourcePort: "out", target: tgt.id, targetPort: "in" }),
    );

    const result = validateConnection(
      g,
      { nodeId: src2.id, portId: "out" },
      { nodeId: tgt.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(true);
  });

  it("accepts 5 edges into one multi-cardinality input", () => {
    const sources = Array.from({ length: 5 }, () => makeNode({ kind: "source", data: {} }));
    const tgt = makeNode({ kind: "multi-in", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, tgt);
    for (const src of sources) {
      g = addNodeToGraph(g, src);
    }

    // Add 4 existing edges
    for (let i = 0; i < 4; i++) {
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: sources[i].id,
          sourcePort: "out",
          target: tgt.id,
          targetPort: "in",
        }),
      );
    }
    expect(g.edges).toHaveLength(4);

    // 5th connection should still succeed
    const result = validateConnection(
      g,
      { nodeId: sources[4].id, portId: "out" },
      { nodeId: tgt.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(true);
  });

  it("all 5 edges have unique IDs after fan-in", () => {
    const sources = Array.from({ length: 5 }, () => makeNode({ kind: "source", data: {} }));
    const tgt = makeNode({ kind: "multi-in", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, tgt);
    for (const src of sources) {
      g = addNodeToGraph(g, src);
    }

    for (const src of sources) {
      g = addEdgeToGraph(
        g,
        makeEdge({ source: src.id, sourcePort: "out", target: tgt.id, targetPort: "in" }),
      );
    }

    expect(g.edges).toHaveLength(5);
    const ids = new Set(g.edges.map((e) => e.id));
    expect(ids.size).toBe(5);
  });

  it("multi-cardinality does not bypass other validation rules", () => {
    // Wrong direction: trying to connect to an output port
    const src = makeNode({ kind: "multi-in", data: {} });
    const tgt = makeNode({ kind: "multi-in", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, src);
    g = addNodeToGraph(g, tgt);

    const result = validateConnection(
      g,
      { nodeId: src.id, portId: "in" },
      { nodeId: tgt.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("WRONG_DIRECTION");
    }
  });

  it("single-cardinality still rejects second edge while multi allows it", () => {
    const src1 = makeNode({ kind: "source", data: {} });
    const src2 = makeNode({ kind: "source", data: {} });
    const singleTgt = makeNode({ kind: "single-in", data: {} });
    const multiTgt = makeNode({ kind: "multi-in", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, src1);
    g = addNodeToGraph(g, src2);
    g = addNodeToGraph(g, singleTgt);
    g = addNodeToGraph(g, multiTgt);

    // Add edges to both targets from src1
    g = addEdgeToGraph(
      g,
      makeEdge({ source: src1.id, sourcePort: "out", target: singleTgt.id, targetPort: "in" }),
    );
    g = addEdgeToGraph(
      g,
      makeEdge({ source: src1.id, sourcePort: "out", target: multiTgt.id, targetPort: "in" }),
    );

    // Single target rejects second edge
    const singleResult = validateConnection(
      g,
      { nodeId: src2.id, portId: "out" },
      { nodeId: singleTgt.id, portId: "in" },
      registry,
    );
    expect(singleResult.ok).toBe(false);
    if (!singleResult.ok) {
      expect(singleResult.error.code).toBe("CARDINALITY_EXCEEDED");
    }

    // Multi target accepts second edge
    const multiResult = validateConnection(
      g,
      { nodeId: src2.id, portId: "out" },
      { nodeId: multiTgt.id, portId: "in" },
      registry,
    );
    expect(multiResult.ok).toBe(true);
  });
});
