import { describe, it, expect, afterEach } from "vitest";
import { migrate, registerMigration, clearMigrations } from "@/domain/serialization/migrate";
import { MigrationError } from "@/domain/validation/errors";

afterEach(() => {
  clearMigrations();
});

describe("migrate", () => {
  it("returns v1 json unchanged when schemaVersion is already current", () => {
    const json = { schemaVersion: 1, id: "g1", name: "Test", nodes: [], edges: [] };
    const result = migrate(json);
    expect(result).toEqual(json);
  });

  it("throws MigrationError for unknown numeric version with no migration registered", () => {
    const json = { schemaVersion: 99 };
    expect(() => migrate(json)).toThrow(MigrationError);
    try {
      migrate(json);
    } catch (err) {
      expect((err as MigrationError).code).toBe("UNKNOWN_VERSION");
      expect((err as MigrationError).details).toHaveProperty("fromVersion", 99);
    }
  });

  it("throws MigrationError for non-numeric schemaVersion", () => {
    const json = { schemaVersion: "bad" };
    expect(() => migrate(json)).toThrow(MigrationError);
    try {
      migrate(json);
    } catch (err) {
      expect((err as MigrationError).code).toBe("UNKNOWN_VERSION");
      expect((err as MigrationError).message).toContain("Invalid schema version");
    }
  });

  it("applies a registered migration function to upgrade the version", () => {
    registerMigration(0, (json) => ({ ...json, schemaVersion: 1 }));
    const json = { schemaVersion: 0, id: "g1", name: "Old", nodes: [], edges: [] };
    const result = migrate(json);
    expect(result).toHaveProperty("schemaVersion", 1);
    expect(result).toHaveProperty("name", "Old");
  });

  it("chains multiple migrations until reaching current version", () => {
    registerMigration(0, (json) => ({ ...json, schemaVersion: 1 }));
    const json = { schemaVersion: 0, id: "g1", name: "Ancient", nodes: [], edges: [] };
    const result = migrate(json);
    expect(result).toHaveProperty("schemaVersion", 1);
  });
});
