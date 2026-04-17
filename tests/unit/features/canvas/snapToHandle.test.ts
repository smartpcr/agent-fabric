import { describe, it, expect } from "vitest";
import { z } from "zod";
import { findSnapTarget, type HandlePosition } from "@/features/canvas/snapToHandle";
import { CURRENT_SCHEMA_VERSION, type WorkflowGraph } from "@/domain/models/graph";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

// -- helpers --

const taskSchema = z.object({}).loose();

function makeSpec(kind: string): NodeSpec {
  return {
    kind,
    category: "flow",
    label: kind,
    icon: "cog",
    defaultData: {},
    propertySchema: taskSchema,
    ports: [
      makeOutputPort({ id: "out", label: "Output", dataType: "string" }),
      makeInputPort({ id: "in", label: "Input", dataType: "string" }),
      makeOutputPort({ id: "outJson", label: "JSON Out", dataType: "json" }),
      makeInputPort({ id: "inJson", label: "JSON In", dataType: "json" }),
    ],
    capabilities: [],
  };
}

function buildGraph(
  nodeIds: string[],
  existingEdges: Array<{
    source: string;
    sourcePort: string;
    target: string;
    targetPort: string;
  }> = [],
): WorkflowGraph {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: "g1",
    name: "test-graph",
    nodes: nodeIds.map((id) => ({
      id,
      kind: "task",
      position: { x: 0, y: 0 },
      data: {},
    })),
    edges: existingEdges.map((e, i) => ({
      id: `edge-${String(i)}`,
      ...e,
    })),
  };
}

function buildRegistry(): NodeSpecRegistry {
  const spec = makeSpec("task");
  return {
    get: (kind: string) => (kind === "task" ? spec : undefined),
  };
}

// -- tests --

describe("findSnapTarget", () => {
  const registry = buildRegistry();

  describe("basic snap math", () => {
    it("returns the nearest compatible handle within radius", () => {
      const graph = buildGraph(["n1", "n2", "n3"]);
      const handles: HandlePosition[] = [
        { nodeId: "n2", portId: "in", x: 100, y: 100 },
        { nodeId: "n3", portId: "in", x: 115, y: 100 },
      ];

      const result = findSnapTarget({ x: 110, y: 100 }, "n1", "out", handles, graph, registry);

      expect(result).not.toBeNull();
      expect(result?.nodeId).toBe("n3");
      expect(result?.portId).toBe("in");
      expect(result?.distance).toBeCloseTo(5);
    });

    it("returns null when all handles are beyond the radius", () => {
      const graph = buildGraph(["n1", "n2"]);
      const handles: HandlePosition[] = [{ nodeId: "n2", portId: "in", x: 100, y: 100 }];

      const result = findSnapTarget({ x: 0, y: 0 }, "n1", "out", handles, graph, registry);

      expect(result).toBeNull();
    });

    it("returns null for empty handles array", () => {
      const graph = buildGraph(["n1"]);
      const result = findSnapTarget({ x: 50, y: 50 }, "n1", "out", [], graph, registry);

      expect(result).toBeNull();
    });

    it("handles exact 20px boundary (inclusive)", () => {
      const graph = buildGraph(["n1", "n2"]);
      const handles: HandlePosition[] = [{ nodeId: "n2", portId: "in", x: 20, y: 0 }];

      const result = findSnapTarget({ x: 0, y: 0 }, "n1", "out", handles, graph, registry, 20);

      expect(result).not.toBeNull();
      expect(result?.distance).toBe(20);
    });

    it("returns null when handle is just beyond 20px", () => {
      const graph = buildGraph(["n1", "n2"]);
      const handles: HandlePosition[] = [{ nodeId: "n2", portId: "in", x: 20.01, y: 0 }];

      const result = findSnapTarget({ x: 0, y: 0 }, "n1", "out", handles, graph, registry, 20);

      expect(result).toBeNull();
    });

    it("computes distance correctly in 2D", () => {
      const graph = buildGraph(["n1", "n2"]);
      const handles: HandlePosition[] = [{ nodeId: "n2", portId: "in", x: 3, y: 4 }];

      const result = findSnapTarget({ x: 0, y: 0 }, "n1", "out", handles, graph, registry);

      expect(result).not.toBeNull();
      expect(result?.distance).toBeCloseTo(5);
    });

    it("supports custom radius", () => {
      const graph = buildGraph(["n1", "n2"]);
      const handles: HandlePosition[] = [{ nodeId: "n2", portId: "in", x: 50, y: 0 }];

      // Default 20px — too far
      expect(findSnapTarget({ x: 0, y: 0 }, "n1", "out", handles, graph, registry, 20)).toBeNull();

      // Custom 60px — within range
      const result = findSnapTarget({ x: 0, y: 0 }, "n1", "out", handles, graph, registry, 60);
      expect(result).not.toBeNull();
      expect(result?.distance).toBe(50);
    });
  });

  describe("compatibility filtering", () => {
    it("skips incompatible handles and picks the nearest compatible one", () => {
      const graph = buildGraph(["n1", "n2", "n3"]);
      const handles: HandlePosition[] = [
        // Closest but incompatible: json port can't receive string
        { nodeId: "n2", portId: "inJson", x: 5, y: 0 },
        // Further but compatible
        { nodeId: "n3", portId: "in", x: 15, y: 0 },
      ];

      const result = findSnapTarget(
        { x: 0, y: 0 },
        "n1",
        "out", // string output
        handles,
        graph,
        registry,
      );

      expect(result).not.toBeNull();
      expect(result?.nodeId).toBe("n3");
      expect(result?.portId).toBe("in");
    });

    it("returns null when only incompatible handles are within radius", () => {
      const graph = buildGraph(["n1", "n2"]);
      const handles: HandlePosition[] = [{ nodeId: "n2", portId: "inJson", x: 5, y: 0 }];

      const result = findSnapTarget(
        { x: 0, y: 0 },
        "n1",
        "out", // string → json is incompatible
        handles,
        graph,
        registry,
      );

      expect(result).toBeNull();
    });

    it("skips handles on the same node (self-loop blocked)", () => {
      const graph = buildGraph(["n1"]);
      const handles: HandlePosition[] = [{ nodeId: "n1", portId: "in", x: 5, y: 0 }];

      const result = findSnapTarget({ x: 0, y: 0 }, "n1", "out", handles, graph, registry);

      // task spec has no canHaveBackEdge, so self-loops are rejected
      expect(result).toBeNull();
    });

    it("skips handles with cardinality exceeded", () => {
      const graph = buildGraph(
        ["n1", "n2", "n3"],
        [{ source: "n1", sourcePort: "out", target: "n2", targetPort: "in" }],
      );

      const handles: HandlePosition[] = [
        // n2.in already has an edge (single cardinality)
        { nodeId: "n2", portId: "in", x: 5, y: 0 },
        // n3.in is free
        { nodeId: "n3", portId: "in", x: 15, y: 0 },
      ];

      const result = findSnapTarget({ x: 0, y: 0 }, "n1", "out", handles, graph, registry);

      expect(result).not.toBeNull();
      expect(result?.nodeId).toBe("n3");
      expect(result?.portId).toBe("in");
    });

    it("skips output handles as targets (wrong direction)", () => {
      const graph = buildGraph(["n1", "n2"]);
      const handles: HandlePosition[] = [
        // out port cannot be a target
        { nodeId: "n2", portId: "out", x: 5, y: 0 },
      ];

      const result = findSnapTarget({ x: 0, y: 0 }, "n1", "out", handles, graph, registry);

      expect(result).toBeNull();
    });
  });

  describe("tie-breaking", () => {
    it("picks the first handle when two are equidistant", () => {
      const graph = buildGraph(["n1", "n2", "n3"]);
      const handles: HandlePosition[] = [
        { nodeId: "n2", portId: "in", x: 10, y: 0 },
        { nodeId: "n3", portId: "in", x: -10, y: 0 },
      ];

      const result = findSnapTarget({ x: 0, y: 0 }, "n1", "out", handles, graph, registry);

      expect(result).not.toBeNull();
      // Both are 10px away; first encountered wins because >= check excludes equal distances
      expect(result?.nodeId).toBe("n2");
    });
  });
});
