import { describe, it, expect } from "vitest";
import { validateGraph } from "@/domain/validation/graphRules";
import { serialize } from "@/domain/serialization/serialize";
import { deserialize } from "@/domain/serialization/deserialize";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { buildDecisionFixtureGraph } from "../fixtures/decisionGraph";

describe("decision end-to-end integration", () => {
  function setupRegistry() {
    const registry = new NodeRegistry();
    registerBuiltins(registry);
    return registry;
  }

  it("builds a graph with both if-else and switch variants, validates, serializes, deserializes, and achieves deep equality", () => {
    const registry = setupRegistry();
    const { graph } = buildDecisionFixtureGraph();

    // 1. Validate
    const validation = validateGraph(graph, registry);
    expect(validation.ok).toBe(true);

    // 2. Serialize
    const json = serialize(graph, registry);
    expect(json.schemaVersion).toBe(1);
    expect(json.id).toBe(graph.id);
    expect(json.name).toBe(graph.name);
    expect(json.nodes).toHaveLength(graph.nodes.length);
    expect(json.edges).toHaveLength(graph.edges.length);

    // 3. Deserialize
    const restored = deserialize(json, registry);

    // 4. Deep equality — nodes
    expect(restored.id).toBe(graph.id);
    expect(restored.name).toBe(graph.name);
    expect(restored.schemaVersion).toBe(graph.schemaVersion);
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

    // 5. Deep equality — edges
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
        expect(found.label).toBe(origEdge.label);
        expect(found.condition).toBe(origEdge.condition);
      }
    }

    // 6. Re-validate deserialized graph
    const revalidation = validateGraph(restored, registry);
    expect(revalidation.ok).toBe(true);
  });

  it("re-serialized output matches original serialization byte-for-byte", () => {
    const registry = setupRegistry();
    const { graph } = buildDecisionFixtureGraph();

    const json1 = serialize(graph, registry);
    const restored = deserialize(json1, registry);
    const json2 = serialize(restored, registry);

    expect(JSON.stringify(json2)).toBe(JSON.stringify(json1));
  });

  it("contains both decision variants in the serialized output", () => {
    const registry = setupRegistry();
    const { graph, decision, sw } = buildDecisionFixtureGraph();

    const json = serialize(graph, registry);

    const decisionNode = json.nodes.find((n) => n.id === decision.id);
    expect(decisionNode).toBeDefined();
    expect(decisionNode?.kind).toBe("decision");
    expect(decisionNode?.data).toEqual({ condition: "status === 'active'" });

    const switchNode = json.nodes.find((n) => n.id === sw.id);
    expect(switchNode).toBeDefined();
    expect(switchNode?.kind).toBe("decision-switch");
    expect(switchNode?.data).toEqual({
      branches: [
        { label: "Case A", condition: "role === 'admin'" },
        { label: "Case B", condition: "role === 'user'" },
      ],
    });
  });

  it("preserves conditional edge metadata through round-trip", () => {
    const registry = setupRegistry();
    const { graph } = buildDecisionFixtureGraph();

    const json = serialize(graph, registry);
    const restored = deserialize(json, registry);

    const conditionalEdges = restored.edges.filter((e) => e.kind === "conditional");
    expect(conditionalEdges.length).toBe(5);

    for (const edge of conditionalEdges) {
      expect(edge.label).toBeDefined();
      // All conditional edges except the default have a condition
      if (edge.label !== "default") {
        expect(edge.condition).toBeDefined();
        expect(typeof edge.condition).toBe("string");
      }
    }
  });

  it("validates correctly — detects orphan branch after deserialization", () => {
    const registry = setupRegistry();
    const { graph } = buildDecisionFixtureGraph();

    // Tamper with JSON: change a sourcePort to something invalid
    const json = serialize(graph, registry);
    const tampered = JSON.parse(JSON.stringify(json)) as typeof json;
    const conditionalEdge = tampered.edges.find((e) => e.sourcePort === "branch-case-a");
    if (conditionalEdge) {
      (conditionalEdge as Record<string, unknown>).sourcePort = "branch-nonexistent";
    }

    const restored = deserialize(tampered, registry);
    const validation = validateGraph(restored, registry);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      const orphanErrors = validation.error.filter((e) => e.code === "DECISION_ORPHAN_EDGE");
      expect(orphanErrors.length).toBeGreaterThanOrEqual(1);
    }
  });
});
