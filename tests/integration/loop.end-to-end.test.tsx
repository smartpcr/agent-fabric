import { describe, it, expect } from "vitest";
import { validateGraph } from "@/domain/validation/graphRules";
import { serialize } from "@/domain/serialization/serialize";
import { deserialize } from "@/domain/serialization/deserialize";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { buildWhileLoopGraph, buildNestedLoopGraph } from "../fixtures/loopGraph";

describe("loop end-to-end integration", () => {
  function setupRegistry() {
    const registry = new NodeRegistry();
    registerBuiltins(registry);
    return registry;
  }

  describe("while-loop graph", () => {
    it("validates successfully", () => {
      const registry = setupRegistry();
      const { graph } = buildWhileLoopGraph();

      const result = validateGraph(graph, registry);
      expect(result.ok).toBe(true);
    });

    it("serializes, deserializes, and achieves deep equality", () => {
      const registry = setupRegistry();
      const { graph } = buildWhileLoopGraph();

      // Serialize
      const json = serialize(graph, registry);
      expect(json.schemaVersion).toBe(1);
      expect(json.id).toBe(graph.id);
      expect(json.name).toBe(graph.name);
      expect(json.nodes).toHaveLength(graph.nodes.length);
      expect(json.edges).toHaveLength(graph.edges.length);

      // Deserialize
      const restored = deserialize(json, registry);

      // Deep equality — metadata
      expect(restored.id).toBe(graph.id);
      expect(restored.name).toBe(graph.name);
      expect(restored.schemaVersion).toBe(graph.schemaVersion);

      // Deep equality — nodes
      expect(restored.nodes).toHaveLength(graph.nodes.length);
      for (const origNode of graph.nodes) {
        const found = restored.nodes.find((n) => n.id === origNode.id);
        expect(found).toBeDefined();
        if (found) {
          expect(found.kind).toBe(origNode.kind);
          expect(found.position).toEqual(origNode.position);
          expect(found.data).toEqual(origNode.data);
        }
      }

      // Deep equality — edges
      expect(restored.edges).toHaveLength(graph.edges.length);
      for (const origEdge of graph.edges) {
        const found = restored.edges.find((e) => e.id === origEdge.id);
        expect(found).toBeDefined();
        if (found) {
          expect(found.source).toBe(origEdge.source);
          expect(found.target).toBe(origEdge.target);
          expect(found.sourcePort).toBe(origEdge.sourcePort);
          expect(found.targetPort).toBe(origEdge.targetPort);
          expect(found.kind).toBe(origEdge.kind);
        }
      }

      // Re-validate deserialized graph
      const revalidation = validateGraph(restored, registry);
      expect(revalidation.ok).toBe(true);
    });

    it("re-serialized output matches original serialization", () => {
      const registry = setupRegistry();
      const { graph } = buildWhileLoopGraph();

      const json1 = serialize(graph, registry);
      const restored = deserialize(json1, registry);
      const json2 = serialize(restored, registry);

      expect(JSON.stringify(json2)).toBe(JSON.stringify(json1));
    });

    it("contains loop-while node with correct data", () => {
      const registry = setupRegistry();
      const { graph, whileLoop } = buildWhileLoopGraph();

      const json = serialize(graph, registry);
      const loopNode = json.nodes.find((n) => n.id === whileLoop.id);
      expect(loopNode).toBeDefined();
      expect(loopNode?.kind).toBe("loop-while");
      expect(loopNode?.data).toEqual({ condition: "count < 10" });
    });

    it("preserves loop-back edge kind through round-trip", () => {
      const registry = setupRegistry();
      const { graph } = buildWhileLoopGraph();

      const json = serialize(graph, registry);
      const restored = deserialize(json, registry);

      const backEdges = restored.edges.filter((e) => e.kind === "loop-back");
      expect(backEdges).toHaveLength(1);
      expect(backEdges[0].targetPort).toBe("body-in");
    });
  });

  describe("nested while inside for-each", () => {
    it("validates successfully", () => {
      const registry = setupRegistry();
      const { graph } = buildNestedLoopGraph();

      const result = validateGraph(graph, registry);
      expect(result.ok).toBe(true);
    });

    it("serializes, deserializes, and achieves deep equality", () => {
      const registry = setupRegistry();
      const { graph } = buildNestedLoopGraph();

      // Serialize
      const json = serialize(graph, registry);
      expect(json.schemaVersion).toBe(1);
      expect(json.nodes).toHaveLength(graph.nodes.length);
      expect(json.edges).toHaveLength(graph.edges.length);

      // Deserialize
      const restored = deserialize(json, registry);

      // Deep equality — metadata
      expect(restored.id).toBe(graph.id);
      expect(restored.name).toBe(graph.name);
      expect(restored.schemaVersion).toBe(graph.schemaVersion);

      // Deep equality — nodes
      expect(restored.nodes).toHaveLength(graph.nodes.length);
      for (const origNode of graph.nodes) {
        const found = restored.nodes.find((n) => n.id === origNode.id);
        expect(found).toBeDefined();
        if (found) {
          expect(found.kind).toBe(origNode.kind);
          expect(found.position).toEqual(origNode.position);
          expect(found.data).toEqual(origNode.data);
        }
      }

      // Deep equality — edges
      expect(restored.edges).toHaveLength(graph.edges.length);
      for (const origEdge of graph.edges) {
        const found = restored.edges.find((e) => e.id === origEdge.id);
        expect(found).toBeDefined();
        if (found) {
          expect(found.source).toBe(origEdge.source);
          expect(found.target).toBe(origEdge.target);
          expect(found.sourcePort).toBe(origEdge.sourcePort);
          expect(found.targetPort).toBe(origEdge.targetPort);
          expect(found.kind).toBe(origEdge.kind);
        }
      }

      // Re-validate deserialized graph
      const revalidation = validateGraph(restored, registry);
      expect(revalidation.ok).toBe(true);
    });

    it("re-serialized output matches original serialization", () => {
      const registry = setupRegistry();
      const { graph } = buildNestedLoopGraph();

      const json1 = serialize(graph, registry);
      const restored = deserialize(json1, registry);
      const json2 = serialize(restored, registry);

      expect(JSON.stringify(json2)).toBe(JSON.stringify(json1));
    });

    it("contains both loop-foreach and loop-while nodes", () => {
      const registry = setupRegistry();
      const { graph, forEachLoop, whileLoop } = buildNestedLoopGraph();

      const json = serialize(graph, registry);

      const feNode = json.nodes.find((n) => n.id === forEachLoop.id);
      expect(feNode).toBeDefined();
      expect(feNode?.kind).toBe("loop-foreach");
      expect(feNode?.data).toEqual({ iterable: "users", item: "user" });

      const wNode = json.nodes.find((n) => n.id === whileLoop.id);
      expect(wNode).toBeDefined();
      expect(wNode?.kind).toBe("loop-while");
      expect(wNode?.data).toEqual({ condition: "retries < 3" });
    });

    it("preserves both back-edges through round-trip", () => {
      const registry = setupRegistry();
      const { graph, forEachLoop, whileLoop } = buildNestedLoopGraph();

      const json = serialize(graph, registry);
      const restored = deserialize(json, registry);

      const backEdges = restored.edges.filter((e) => e.kind === "loop-back");
      expect(backEdges).toHaveLength(2);

      // Each back-edge targets its own loop's body-in
      const whileBack = backEdges.find((e) => e.target === whileLoop.id);
      expect(whileBack).toBeDefined();
      expect(whileBack?.targetPort).toBe("body-in");

      const forEachBack = backEdges.find((e) => e.target === forEachLoop.id);
      expect(forEachBack).toBeDefined();
      expect(forEachBack?.targetPort).toBe("body-in");
    });

    it("has correct node and edge counts", () => {
      const { graph } = buildNestedLoopGraph();

      // 5 nodes: start, forEachLoop, whileLoop, innerTask, end
      expect(graph.nodes).toHaveLength(5);

      // 7 edges: start→forEach, forEach→while, while→task,
      //          while-back, while-done→forEach-body-in, forEach-back, forEach-done→end
      expect(graph.edges).toHaveLength(7);
    });
  });

  describe("validator catches invalid nested loop graphs", () => {
    it("rejects nested loop with missing inner back-edge", () => {
      const registry = setupRegistry();
      const { graph } = buildNestedLoopGraph();

      // Remove the inner while-loop back-edge
      const innerBackIdx = graph.edges.findIndex(
        (e) =>
          e.kind === "loop-back" &&
          e.target === graph.nodes.find((n) => n.kind === "loop-while")?.id,
      );
      expect(innerBackIdx).toBeGreaterThanOrEqual(0);

      const tamperedEdges = [...graph.edges];
      tamperedEdges.splice(innerBackIdx, 1);
      const tampered = { ...graph, edges: Object.freeze(tamperedEdges) };

      const result = validateGraph(tampered, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const missingBack = result.error.filter((e) => e.code === "LOOP_NODE_MISSING_BACK_EDGE");
        expect(missingBack.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("rejects nested loop with missing outer back-edge", () => {
      const registry = setupRegistry();
      const { graph } = buildNestedLoopGraph();

      // Remove the outer for-each back-edge
      const outerBackIdx = graph.edges.findIndex(
        (e) =>
          e.kind === "loop-back" &&
          e.target === graph.nodes.find((n) => n.kind === "loop-foreach")?.id,
      );
      expect(outerBackIdx).toBeGreaterThanOrEqual(0);

      const tamperedEdges = [...graph.edges];
      tamperedEdges.splice(outerBackIdx, 1);
      const tampered = { ...graph, edges: Object.freeze(tamperedEdges) };

      const result = validateGraph(tampered, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const missingBack = result.error.filter((e) => e.code === "LOOP_NODE_MISSING_BACK_EDGE");
        expect(missingBack.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
