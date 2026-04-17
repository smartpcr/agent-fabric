import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  validateConnection,
  type NodeSpecRegistry,
  type ConnectionEndpoint,
} from "@/domain/validation/connectionRules";
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

const taskSpec = spec("task", [
  makeOutputPort({ id: "out", label: "Out", dataType: "string" }),
  makeInputPort({ id: "in", label: "In", dataType: "string" }),
]);

const startSpec = spec("start", [makeOutputPort({ id: "out", label: "Out", dataType: "any" })]);

const endSpec = spec("end", [makeInputPort({ id: "in", label: "In", dataType: "any" })]);

const loopSpec = spec(
  "loop",
  [
    makeOutputPort({ id: "out", label: "Out", dataType: "string" }),
    makeInputPort({ id: "in", label: "In", dataType: "string" }),
  ],
  ["canHaveBackEdge"],
);

const typedSpec = spec("typed", [
  makeOutputPort({ id: "out", label: "Out", dataType: "number" }),
  makeInputPort({ id: "in", label: "In", dataType: "string" }),
]);

const multiSpec = spec("multi", [
  makeInputPort({ id: "in", label: "In", dataType: "any", cardinality: "multi" }),
  makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
]);

function makeRegistry(specs: NodeSpec[]): NodeSpecRegistry {
  const map = new Map(specs.map((s) => [s.kind, s]));
  return { get: (kind: string) => map.get(kind) };
}

describe("validateConnection", () => {
  const registry = makeRegistry([taskSpec, startSpec, endSpec, loopSpec, typedSpec, multiSpec]);

  function buildGraph() {
    const n1 = makeNode({ kind: "start", data: {} });
    const n2 = makeNode({ kind: "task", data: {} });
    const n3 = makeNode({ kind: "end", data: {} });
    let g = makeGraph("Test");
    g = addNodeToGraph(g, n1);
    g = addNodeToGraph(g, n2);
    g = addNodeToGraph(g, n3);
    return { g, n1, n2, n3 };
  }

  // 1. Valid connection succeeds
  it("accepts a valid output→input connection", () => {
    const { g, n1, n2 } = buildGraph();
    const src: ConnectionEndpoint = { nodeId: n1.id, portId: "out" };
    const tgt: ConnectionEndpoint = { nodeId: n2.id, portId: "in" };
    const result = validateConnection(g, src, tgt, registry);
    expect(result.ok).toBe(true);
  });

  // 2. Source node not found
  it("rejects when source node does not exist", () => {
    const { g, n2 } = buildGraph();
    const result = validateConnection(
      g,
      { nodeId: "nonexistent", portId: "out" },
      { nodeId: n2.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SOURCE_NODE_NOT_FOUND");
    }
  });

  // 3. Target node not found
  it("rejects when target node does not exist", () => {
    const { g, n1 } = buildGraph();
    const result = validateConnection(
      g,
      { nodeId: n1.id, portId: "out" },
      { nodeId: "nonexistent", portId: "in" },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TARGET_NODE_NOT_FOUND");
    }
  });

  // 4. Source port not found
  it("rejects when source port does not exist on the spec", () => {
    const { g, n1, n2 } = buildGraph();
    const result = validateConnection(
      g,
      { nodeId: n1.id, portId: "missing-port" },
      { nodeId: n2.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SOURCE_PORT_NOT_FOUND");
    }
  });

  // 5. Target port not found
  it("rejects when target port does not exist on the spec", () => {
    const { g, n1, n2 } = buildGraph();
    const result = validateConnection(
      g,
      { nodeId: n1.id, portId: "out" },
      { nodeId: n2.id, portId: "missing-port" },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TARGET_PORT_NOT_FOUND");
    }
  });

  // 6. Wrong direction: source is input port
  it("rejects when source port is an input (wrong direction)", () => {
    const { g, n2, n3 } = buildGraph();
    const result = validateConnection(
      g,
      { nodeId: n2.id, portId: "in" },
      { nodeId: n3.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("WRONG_DIRECTION");
    }
  });

  // 7. Wrong direction: target is output port
  it("rejects when target port is an output (wrong direction)", () => {
    const { g, n1, n2 } = buildGraph();
    const result = validateConnection(
      g,
      { nodeId: n1.id, portId: "out" },
      { nodeId: n2.id, portId: "out" },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("WRONG_DIRECTION");
    }
  });

  // 8. Data type mismatch
  it("rejects when data types are not assignable", () => {
    const typedNode = makeNode({ kind: "typed", data: {} });
    const taskNode = makeNode({ kind: "task", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, typedNode);
    g = addNodeToGraph(g, taskNode);

    const result = validateConnection(
      g,
      { nodeId: typedNode.id, portId: "out" },
      { nodeId: taskNode.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DATA_TYPE_MISMATCH");
    }
  });

  // 9. Cardinality exceeded on single target port
  it("rejects when single-cardinality target port already has an inbound edge", () => {
    const { n1, n2 } = buildGraph();
    const n4 = makeNode({ kind: "start", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, n1);
    g = addNodeToGraph(g, n2);
    g = addNodeToGraph(g, n4);
    const existingEdge = makeEdge({
      source: n1.id,
      sourcePort: "out",
      target: n2.id,
      targetPort: "in",
    });
    g = addEdgeToGraph(g, existingEdge);

    const result = validateConnection(
      g,
      { nodeId: n4.id, portId: "out" },
      { nodeId: n2.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CARDINALITY_EXCEEDED");
    }
  });

  // 10. Multi-cardinality target port allows multiple inbound edges
  it("accepts multiple inbound edges on multi-cardinality target port", () => {
    const n1 = makeNode({ kind: "start", data: {} });
    const n2 = makeNode({ kind: "start", data: {} });
    const n3 = makeNode({ kind: "multi", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, n1);
    g = addNodeToGraph(g, n2);
    g = addNodeToGraph(g, n3);
    const existingEdge = makeEdge({
      source: n1.id,
      sourcePort: "out",
      target: n3.id,
      targetPort: "in",
    });
    g = addEdgeToGraph(g, existingEdge);

    const result = validateConnection(
      g,
      { nodeId: n2.id, portId: "out" },
      { nodeId: n3.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(true);
  });

  // 11. Self-loop on same port
  it("rejects self-loop on the same port", () => {
    const loopNode = makeNode({ kind: "loop", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, loopNode);

    const result = validateConnection(
      g,
      { nodeId: loopNode.id, portId: "in" },
      { nodeId: loopNode.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SELF_LOOP_SAME_PORT");
    }
  });

  // 12. Loop-back not allowed on node without canHaveBackEdge
  it("rejects loop-back edge on node without canHaveBackEdge capability", () => {
    const taskNode = makeNode({ kind: "task", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, taskNode);

    const result = validateConnection(
      g,
      { nodeId: taskNode.id, portId: "out" },
      { nodeId: taskNode.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("LOOP_BACK_NOT_ALLOWED");
    }
  });

  // 13. Loop-back allowed on node with canHaveBackEdge
  it("accepts loop-back edge on node with canHaveBackEdge capability", () => {
    const loopNode = makeNode({ kind: "loop", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, loopNode);

    const result = validateConnection(
      g,
      { nodeId: loopNode.id, portId: "out" },
      { nodeId: loopNode.id, portId: "in" },
      registry,
    );
    expect(result.ok).toBe(true);
  });

  // 14. Data type whitelist allows coercion
  it("accepts connection with whitelisted data type coercion", () => {
    const typedNode = makeNode({ kind: "typed", data: {} });
    const taskNode = makeNode({ kind: "task", data: {} });
    let g = makeGraph("G");
    g = addNodeToGraph(g, typedNode);
    g = addNodeToGraph(g, taskNode);

    const result = validateConnection(
      g,
      { nodeId: typedNode.id, portId: "out" },
      { nodeId: taskNode.id, portId: "in" },
      registry,
      { dataTypeWhitelist: { number: ["string"] } },
    );
    expect(result.ok).toBe(true);
  });
});
