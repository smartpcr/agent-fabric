import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateConnection, type NodeSpecRegistry } from "@/domain/validation/connectionRules";
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

const singleInSpec = spec("single-in", [
  makeInputPort({ id: "in", label: "In", dataType: "any", cardinality: "single" }),
  makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
]);

const multiInSpec = spec("multi-in", [
  makeInputPort({ id: "in", label: "In", dataType: "any", cardinality: "multi" }),
  makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
]);

const sourceSpec = spec("source", [makeOutputPort({ id: "out", label: "Out", dataType: "any" })]);

const twoInputSpec = spec("two-input", [
  makeInputPort({ id: "inA", label: "In A", dataType: "any", cardinality: "single" }),
  makeInputPort({ id: "inB", label: "In B", dataType: "any", cardinality: "single" }),
  makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
]);

function makeRegistry(specs: NodeSpec[]): NodeSpecRegistry {
  const map = new Map(specs.map((s) => [s.kind, s]));
  return { get: (kind: string) => map.get(kind) };
}

describe("connectionRules — single cardinality enforcement", () => {
  const registry = makeRegistry([singleInSpec, multiInSpec, sourceSpec, twoInputSpec]);

  describe("single-cardinality target port with no existing inbound edge", () => {
    it("accepts the first connection to a single-cardinality input", () => {
      const src = makeNode({ kind: "source", data: {} });
      const tgt = makeNode({ kind: "single-in", data: {} });
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
  });

  describe("single-cardinality target port with existing inbound edge", () => {
    it("rejects a second connection with CARDINALITY_EXCEEDED error code", () => {
      const src1 = makeNode({ kind: "source", data: {} });
      const src2 = makeNode({ kind: "source", data: {} });
      const tgt = makeNode({ kind: "single-in", data: {} });
      let g = makeGraph("G");
      g = addNodeToGraph(g, src1);
      g = addNodeToGraph(g, src2);
      g = addNodeToGraph(g, tgt);
      const existingEdge = makeEdge({
        source: src1.id,
        sourcePort: "out",
        target: tgt.id,
        targetPort: "in",
      });
      g = addEdgeToGraph(g, existingEdge);

      const result = validateConnection(
        g,
        { nodeId: src2.id, portId: "out" },
        { nodeId: tgt.id, portId: "in" },
        registry,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CARDINALITY_EXCEEDED");
        expect(result.error.conflictingEdgeId).toBe(existingEdge.id);
      }
    });

    it("includes the port id in the error message", () => {
      const src1 = makeNode({ kind: "source", data: {} });
      const src2 = makeNode({ kind: "source", data: {} });
      const tgt = makeNode({ kind: "single-in", data: {} });
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
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("in");
        expect(result.error.message).toContain(tgt.id);
        expect(result.error.message).toContain("single");
      }
    });

    it("includes the node id in the error message", () => {
      const src1 = makeNode({ kind: "source", data: {} });
      const src2 = makeNode({ kind: "source", data: {} });
      const tgt = makeNode({ kind: "single-in", data: {} });
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
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(tgt.id);
      }
    });
  });

  describe("default cardinality is single", () => {
    it("defaults to single when cardinality is not explicitly set", () => {
      // Ports created without specifying cardinality default to 'single'
      const defaultSpec = spec("default-card", [
        makeInputPort({ id: "in", label: "In", dataType: "any" }),
        makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
      ]);
      const localRegistry = makeRegistry([sourceSpec, defaultSpec]);

      const src1 = makeNode({ kind: "source", data: {} });
      const src2 = makeNode({ kind: "source", data: {} });
      const tgt = makeNode({ kind: "default-card", data: {} });
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
        localRegistry,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CARDINALITY_EXCEEDED");
      }
    });
  });

  describe("multiple single-cardinality ports on same node", () => {
    it("allows connections to different single-cardinality ports", () => {
      const src1 = makeNode({ kind: "source", data: {} });
      const src2 = makeNode({ kind: "source", data: {} });
      const tgt = makeNode({ kind: "two-input", data: {} });
      let g = makeGraph("G");
      g = addNodeToGraph(g, src1);
      g = addNodeToGraph(g, src2);
      g = addNodeToGraph(g, tgt);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: src1.id, sourcePort: "out", target: tgt.id, targetPort: "inA" }),
      );

      // inB is still free — connection should succeed
      const result = validateConnection(
        g,
        { nodeId: src2.id, portId: "out" },
        { nodeId: tgt.id, portId: "inB" },
        registry,
      );
      expect(result.ok).toBe(true);
    });

    it("rejects second connection to same port while other port is available", () => {
      const src1 = makeNode({ kind: "source", data: {} });
      const src2 = makeNode({ kind: "source", data: {} });
      const tgt = makeNode({ kind: "two-input", data: {} });
      let g = makeGraph("G");
      g = addNodeToGraph(g, src1);
      g = addNodeToGraph(g, src2);
      g = addNodeToGraph(g, tgt);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: src1.id, sourcePort: "out", target: tgt.id, targetPort: "inA" }),
      );

      // inA is occupied — should reject even though inB is free
      const result = validateConnection(
        g,
        { nodeId: src2.id, portId: "out" },
        { nodeId: tgt.id, portId: "inA" },
        registry,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CARDINALITY_EXCEEDED");
      }
    });
  });

  describe("multi-cardinality is not affected", () => {
    it("accepts connection to multi-cardinality port with existing inbound edge", () => {
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
  });

  describe("existing edge identification for UI highlighting", () => {
    it("returns conflictingEdgeId in the error for deterministic UI highlighting", () => {
      const src1 = makeNode({ kind: "source", data: {} });
      const src2 = makeNode({ kind: "source", data: {} });
      const tgt = makeNode({ kind: "single-in", data: {} });
      let g = makeGraph("G");
      g = addNodeToGraph(g, src1);
      g = addNodeToGraph(g, src2);
      g = addNodeToGraph(g, tgt);

      const existingEdge = makeEdge({
        source: src1.id,
        sourcePort: "out",
        target: tgt.id,
        targetPort: "in",
      });
      g = addEdgeToGraph(g, existingEdge);

      const result = validateConnection(
        g,
        { nodeId: src2.id, portId: "out" },
        { nodeId: tgt.id, portId: "in" },
        registry,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CARDINALITY_EXCEEDED");
        expect(result.error.conflictingEdgeId).toBe(existingEdge.id);
      }
    });

    it("conflictingEdgeId matches the first inbound edge on the target port", () => {
      const src1 = makeNode({ kind: "source", data: {} });
      const src2 = makeNode({ kind: "source", data: {} });
      const tgt = makeNode({ kind: "single-in", data: {} });
      let g = makeGraph("G");
      g = addNodeToGraph(g, src1);
      g = addNodeToGraph(g, src2);
      g = addNodeToGraph(g, tgt);

      const firstEdge = makeEdge({
        source: src1.id,
        sourcePort: "out",
        target: tgt.id,
        targetPort: "in",
      });
      g = addEdgeToGraph(g, firstEdge);

      const result = validateConnection(
        g,
        { nodeId: src2.id, portId: "out" },
        { nodeId: tgt.id, portId: "in" },
        registry,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // The conflicting edge ID should be deterministic — always the existing inbound edge
        expect(result.error.conflictingEdgeId).toBeDefined();
        expect(result.error.conflictingEdgeId).toBe(firstEdge.id);
      }
    });
  });
});
