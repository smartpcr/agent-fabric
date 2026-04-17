import { MigrationError } from "@/domain/validation/errors";
import { CURRENT_SCHEMA_VERSION } from "@/domain/models/graph";
import type { GraphJsonV1Type } from "@/domain/serialization/schema.v1";

export type MigrationFn = (json: Record<string, unknown>) => Record<string, unknown>;

const migrations = new Map<number, MigrationFn>();

export function registerMigration(fromVersion: number, fn: MigrationFn): void {
  migrations.set(fromVersion, fn);
}

export function clearMigrations(): void {
  migrations.clear();
}

export function migrate(json: unknown): GraphJsonV1Type {
  const raw = json as Record<string, unknown>;
  let current: Record<string, unknown> = { ...raw };

  while (current.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    const version = current.schemaVersion;
    if (typeof version !== "number") {
      throw new MigrationError("UNKNOWN_VERSION", `Invalid schema version: ${String(version)}`, {
        fromVersion: version,
        toVersion: CURRENT_SCHEMA_VERSION,
      });
    }

    const fn = migrations.get(version);
    if (!fn) {
      throw new MigrationError(
        "UNKNOWN_VERSION",
        `No migration path from schema version ${String(version)}`,
        { fromVersion: version, toVersion: CURRENT_SCHEMA_VERSION },
      );
    }

    current = fn(current);
  }

  return current as unknown as GraphJsonV1Type;
}
