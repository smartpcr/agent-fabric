import { describe, it, expect } from "vitest";
import { z } from "zod";
import { deserialize } from "@/domain/serialization/deserialize";
import { serialize } from "@/domain/serialization/serialize";
import { makeGraph, addNodeToGraph, addEdgeToGraph } from "@/domain/models/graph";
import { makeNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import { SerializationError, MigrationError } from "@/domain/validation/errors";
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

describe("deserialize", () => {
  describe("round-trip equality with serialize", () => {
    it("round-trips a valid graph through serialize then deserialize", () => {
      const { g } = buildValidGraph();
      const json = serialize(g, registry);
      const result = deserialize(json, registry);

      expect(result.id).toBe(g.id);
      expect(result.name).toBe(g.name);
      expect(result.schemaVersion).toBe(g.schemaVersion);
      expect(result.nodes.length).toBe(g.nodes.length);
      expect(result.edges.length).toBe(g.edges.length);
    });

    it("preserves node ids, kinds, positions, and data after round-trip", () => {
      const { g, start, task, end } = buildValidGraph();
      const json = serialize(g, registry);
      const result = deserialize(json, registry);

      const startNode = result.nodes.find((n) => n.id === start.id);
      expect(startNode).toBeDefined();
      expect(startNode?.kind).toBe("start");
      expect(startNode?.position).toEqual({ x: 0, y: 0 });
      expect(startNode?.data).toEqual({});

      const taskNode = result.nodes.find((n) => n.id === task.id);
      expect(taskNode).toBeDefined();
      expect(taskNode?.kind).toBe("task");
      expect(taskNode?.data).toEqual({ name: "Do stuff" });

      const endNode = result.nodes.find((n) => n.id === end.id);
      expect(endNode).toBeDefined();
      expect(endNode?.kind).toBe("end");
    });

    it("preserves edge ids, source, target, sourcePort, targetPort, and kind", () => {
      const { g } = buildValidGraph();
      const json = serialize(g, registry);
      const result = deserialize(json, registry);

      for (const origEdge of g.edges) {
        const roundTripped = result.edges.find((e) => e.id === origEdge.id);
        expect(roundTripped).toBeDefined();
        expect(roundTripped?.source).toBe(origEdge.source);
        expect(roundTripped?.target).toBe(origEdge.target);
        expect(roundTripped?.sourcePort).toBe(origEdge.sourcePort);
        expect(roundTripped?.targetPort).toBe(origEdge.targetPort);
        expect(roundTripped?.kind).toBe(origEdge.kind);
      }
    });

    it("preserves optional edge label and condition through round-trip", () => {
      const start = makeNode({ kind: "start", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("With optionals");
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
      const result = deserialize(json, registry);

      expect(result.edges[0].label).toBe("yes");
      expect(result.edges[0].condition).toBe("x > 0");
    });

    it("re-serialized output is identical to original serialized output", () => {
      const { g } = buildValidGraph();
      const json1 = serialize(g, registry);
      const deserialized = deserialize(json1, registry);
      const json2 = serialize(deserialized, registry);

      expect(JSON.stringify(json2)).toBe(JSON.stringify(json1));
    });
  });

  describe("unknown kind error", () => {
    it("throws SerializationError with KIND_NOT_REGISTERED for unknown node kind", () => {
      const validJson = {
        schemaVersion: 1,
        id: "g1",
        name: "Test",
        nodes: [{ id: "n1", kind: "start", position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      };

      const limitedRegistry: NodeSpecRegistry = { get: () => undefined };

      expect(() => deserialize(validJson, limitedRegistry)).toThrow(SerializationError);
      try {
        deserialize(validJson, limitedRegistry);
      } catch (err) {
        expect(err).toBeInstanceOf(SerializationError);
        expect((err as SerializationError).code).toBe("KIND_NOT_REGISTERED");
        expect((err as SerializationError).message).toContain("kind not registered");
        expect((err as SerializationError).details).toHaveProperty("kind", "start");
      }
    });

    it("throws SerializationError when one of multiple nodes has unregistered kind", () => {
      const limitedMap = new Map([["start", startSpec]]);
      const limitedRegistry: NodeSpecRegistry = { get: (kind: string) => limitedMap.get(kind) };

      const json = {
        schemaVersion: 1,
        id: "g1",
        name: "Test",
        nodes: [
          { id: "n1", kind: "start", position: { x: 0, y: 0 }, data: {} },
          { id: "n2", kind: "task", position: { x: 100, y: 0 }, data: {} },
        ],
        edges: [],
      };

      expect(() => deserialize(json, limitedRegistry)).toThrow(SerializationError);
      try {
        deserialize(json, limitedRegistry);
      } catch (err) {
        expect((err as SerializationError).code).toBe("KIND_NOT_REGISTERED");
        expect((err as SerializationError).details).toHaveProperty("kind", "task");
      }
    });
  });

  describe("version mismatch triggers migration", () => {
    it("delegates to migrate() when schemaVersion is not current", () => {
      const json = {
        schemaVersion: 999,
        id: "g1",
        name: "Test",
        nodes: [],
        edges: [],
      };

      expect(() => deserialize(json, registry)).toThrow(MigrationError);
    });

    it("MigrationError carries UNKNOWN_VERSION code and version details", () => {
      const json = {
        schemaVersion: 0,
        id: "g1",
        name: "Test",
        nodes: [],
        edges: [],
      };

      try {
        deserialize(json, registry);
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(MigrationError);
        expect((err as MigrationError).code).toBe("UNKNOWN_VERSION");
        expect((err as MigrationError).details).toHaveProperty("fromVersion", 0);
      }
    });
  });

  describe("Zod parse errors", () => {
    it("throws MigrationError for object without schemaVersion", () => {
      expect(() => deserialize({ bad: "data" }, registry)).toThrow(MigrationError);
      try {
        deserialize({ bad: "data" }, registry);
      } catch (err) {
        expect(err).toBeInstanceOf(MigrationError);
        expect((err as MigrationError).code).toBe("UNKNOWN_VERSION");
      }
    });

    it("throws MigrationError for null input", () => {
      expect(() => deserialize(null, registry)).toThrow(MigrationError);
    });

    it("throws SerializationError for missing required fields", () => {
      const json = { schemaVersion: 1, id: "g1" };
      expect(() => deserialize(json, registry)).toThrow(SerializationError);
    });
  });

  describe("message formatting", () => {
    it("MigrationError message includes Missing schemaVersion for empty object", () => {
      try {
        deserialize({}, registry);
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(MigrationError);
        expect((err as MigrationError).message).toContain("schemaVersion");
      }
    });

    it("KIND_NOT_REGISTERED message includes the kind value", () => {
      const json = {
        schemaVersion: 1,
        id: "g1",
        name: "Test",
        nodes: [{ id: "n1", kind: "start", position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      };

      const emptyReg: NodeSpecRegistry = { get: () => undefined };
      try {
        deserialize(json, emptyReg);
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as SerializationError).message).toContain('"start"');
      }
    });
  });
});
