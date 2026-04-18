import { describe, it, expect } from "vitest";
import { z } from "zod";
import { deserialize } from "@/domain/serialization/deserialize";
import { MigrationError } from "@/domain/validation/errors";
import { CURRENT_SCHEMA_VERSION } from "@/domain/models/graph";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";

// ─── Fixtures ────────────────────────────────────────────────────────

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

const startSpec = spec("start", [makeOutputPort({ id: "out", label: "Out", dataType: "any" })]);
const taskSpec = spec("task", [
  makeInputPort({ id: "in", label: "In", dataType: "any" }),
  makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
]);

function makeRegistry(): NodeSpecRegistry {
  const map = new Map([
    ["start", startSpec],
    ["task", taskSpec],
  ]);
  return { get: (kind: string) => map.get(kind) };
}

const registry = makeRegistry();

function validGraphJson() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: "g1",
    name: "Test Graph",
    nodes: [{ id: "n1", kind: "start", position: { x: 0, y: 0 }, data: {} }],
    edges: [],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("deserialize — schemaVersion gating", () => {
  it("CURRENT_SCHEMA_VERSION is a positive number", () => {
    expect(typeof CURRENT_SCHEMA_VERSION).toBe("number");
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("accepts JSON with the current schema version", () => {
    const json = validGraphJson();
    const graph = deserialize(json, registry);
    expect(graph.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(graph.id).toBe("g1");
    expect(graph.nodes).toHaveLength(1);
  });

  it("rejects missing schemaVersion with MigrationError", () => {
    const json = { id: "g1", name: "No Version", nodes: [], edges: [] };
    expect(() => deserialize(json, registry)).toThrow(MigrationError);
    expect(() => deserialize(json, registry)).toThrow(/schemaVersion/i);
  });

  it("rejects null schemaVersion with MigrationError", () => {
    const json = { schemaVersion: null, id: "g1", name: "Null", nodes: [], edges: [] };
    expect(() => deserialize(json, registry)).toThrow(MigrationError);
  });

  it("rejects undefined schemaVersion with MigrationError", () => {
    const json = { schemaVersion: undefined, id: "g1", name: "Undef", nodes: [], edges: [] };
    expect(() => deserialize(json, registry)).toThrow(MigrationError);
  });

  it("rejects non-numeric schemaVersion (string)", () => {
    const json = { schemaVersion: "1", id: "g1", name: "String", nodes: [], edges: [] };
    expect(() => deserialize(json, registry)).toThrow(MigrationError);
    expect(() => deserialize(json, registry)).toThrow(/Invalid schema version/);
  });

  it("rejects non-numeric schemaVersion (boolean)", () => {
    const json = { schemaVersion: true, id: "g1", name: "Bool", nodes: [], edges: [] };
    expect(() => deserialize(json, registry)).toThrow(MigrationError);
  });

  it("rejects future/unknown version higher than current", () => {
    const futureVersion = CURRENT_SCHEMA_VERSION + 1;
    const json = { ...validGraphJson(), schemaVersion: futureVersion };
    expect(() => deserialize(json, registry)).toThrow(MigrationError);
    expect(() => deserialize(json, registry)).toThrow(/Unknown schema version/);
  });

  it("rejects very large future version", () => {
    const json = { ...validGraphJson(), schemaVersion: 999 };
    expect(() => deserialize(json, registry)).toThrow(MigrationError);
  });

  it("rejects version 0", () => {
    const json = { ...validGraphJson(), schemaVersion: 0 };
    expect(() => deserialize(json, registry)).toThrow(MigrationError);
    expect(() => deserialize(json, registry)).toThrow(/Invalid schema version/);
  });

  it("rejects negative version", () => {
    const json = { ...validGraphJson(), schemaVersion: -1 };
    expect(() => deserialize(json, registry)).toThrow(MigrationError);
  });

  it("rejects non-object input (null)", () => {
    expect(() => deserialize(null, registry)).toThrow(MigrationError);
  });

  it("rejects non-object input (string)", () => {
    expect(() => deserialize("not an object", registry)).toThrow(MigrationError);
  });

  it("rejects non-object input (number)", () => {
    expect(() => deserialize(42, registry)).toThrow(MigrationError);
  });

  it("MigrationError includes fromVersion and toVersion in details", () => {
    const futureVersion = CURRENT_SCHEMA_VERSION + 5;
    const json = { ...validGraphJson(), schemaVersion: futureVersion };
    try {
      deserialize(json, registry);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(MigrationError);
      const migErr = err as MigrationError;
      expect(migErr.details).toHaveProperty("fromVersion", futureVersion);
      expect(migErr.details).toHaveProperty("toVersion", CURRENT_SCHEMA_VERSION);
    }
  });

  it("known current version passes through without calling migrate", () => {
    // If version matches current, no migration is attempted — just validation
    const json = validGraphJson();
    const graph = deserialize(json, registry);
    expect(graph.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(graph.name).toBe("Test Graph");
  });
});
