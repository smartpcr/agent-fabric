import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { GraphJsonV1 } from "@/domain/serialization/schema.v1";
import { migrate } from "@/domain/serialization/migrate";
import { CURRENT_SCHEMA_VERSION } from "@/domain/models/graph";

const fixturePath = join(__dirname, "../../../fixtures/migration/v1.json");
const fixtureJson = JSON.parse(readFileSync(fixturePath, "utf-8")) as Record<string, unknown>;

describe("migrate — v1 identity fixture", () => {
  it("fixture has schemaVersion equal to CURRENT_SCHEMA_VERSION", () => {
    expect(fixtureJson.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("fixture validates against GraphJsonV1 schema", () => {
    const result = GraphJsonV1.safeParse(fixtureJson);
    expect(result.success).toBe(true);
  });

  it("migrate returns the fixture unchanged (identity)", () => {
    const result = migrate(fixtureJson);
    expect(result).toEqual(fixtureJson);
  });

  it("migrate preserves schemaVersion", () => {
    const result = migrate(fixtureJson);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("migrate preserves graph id and name", () => {
    const result = migrate(fixtureJson);
    expect(result.id).toBe("fixture-v1-graph");
    expect(result.name).toBe("V1 Fixture Graph");
  });

  it("migrate preserves all nodes", () => {
    const result = migrate(fixtureJson);
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.map((n) => n.id)).toEqual(["n-start", "n-task", "n-end"]);
  });

  it("migrate preserves all edges", () => {
    const result = migrate(fixtureJson);
    expect(result.edges).toHaveLength(2);
    expect(result.edges.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("migrate preserves node positions", () => {
    const result = migrate(fixtureJson);
    expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(result.nodes[1].position).toEqual({ x: 200, y: 0 });
    expect(result.nodes[2].position).toEqual({ x: 400, y: 0 });
  });

  it("migrate preserves node data", () => {
    const result = migrate(fixtureJson);
    expect(result.nodes[1].data).toEqual({ name: "Process" });
  });

  it("fixture round-trips through migrate identically", () => {
    const first = migrate(fixtureJson);
    const second = migrate(first);
    expect(second).toEqual(first);
    expect(second).toEqual(fixtureJson);
  });
});
