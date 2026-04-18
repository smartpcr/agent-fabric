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

export function migrate(json: unknown, targetVersion?: number): GraphJsonV1Type {
  const target = targetVersion ?? CURRENT_SCHEMA_VERSION;
  const raw = json as Record<string, unknown>;
  let current: Record<string, unknown> = { ...raw };

  while (current.schemaVersion !== target) {
    const version = current.schemaVersion;
    if (typeof version !== "number") {
      throw new MigrationError("UNKNOWN_VERSION", `Invalid schema version: ${String(version)}`, {
        fromVersion: version,
        toVersion: target,
      });
    }

    const fn = migrations.get(version);
    if (!fn) {
      throw new MigrationError(
        "UNKNOWN_VERSION",
        `No migration path from schema version ${String(version)}`,
        { fromVersion: version, toVersion: target },
      );
    }

    current = fn(current);
  }

  return current as unknown as GraphJsonV1Type;
}
