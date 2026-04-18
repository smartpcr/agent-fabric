import { GraphJsonV1 } from "@/domain/serialization/schema.v1";
import { migrate } from "@/domain/serialization/migrate";
import { SerializationError, MigrationError } from "@/domain/validation/errors";
import { CURRENT_SCHEMA_VERSION, type WorkflowGraph } from "@/domain/models/graph";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";
import type { WorkflowNode } from "@/domain/models/node";
import type { EdgeKind } from "@/domain/models/edge";

export function deserialize(json: unknown, registry: NodeSpecRegistry): WorkflowGraph {
  let input = json;

  const raw = input as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") {
    throw new MigrationError("UNKNOWN_VERSION", "Invalid input: expected an object", {
      fromVersion: undefined,
      toVersion: CURRENT_SCHEMA_VERSION,
    });
  }

  const version = raw.schemaVersion;

  // Missing schemaVersion
  if (version === undefined || version === null) {
    throw new MigrationError("UNKNOWN_VERSION", "Missing schemaVersion field", {
      fromVersion: undefined,
      toVersion: CURRENT_SCHEMA_VERSION,
    });
  }

  // Non-numeric schemaVersion
  if (typeof version !== "number") {
    const versionStr = typeof version === "string" ? version : JSON.stringify(version);
    throw new MigrationError("UNKNOWN_VERSION", `Invalid schema version: ${versionStr}`, {
      fromVersion: version,
      toVersion: CURRENT_SCHEMA_VERSION,
    });
  }

  // Future / unknown version (higher than current)
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new MigrationError(
      "UNKNOWN_VERSION",
      `Unknown schema version ${String(version)} (current is ${String(CURRENT_SCHEMA_VERSION)})`,
      { fromVersion: version, toVersion: CURRENT_SCHEMA_VERSION },
    );
  }

  // Negative or zero version
  if (version < 1) {
    throw new MigrationError("UNKNOWN_VERSION", `Invalid schema version: ${String(version)}`, {
      fromVersion: version,
      toVersion: CURRENT_SCHEMA_VERSION,
    });
  }

  // Older version — run migration pipeline
  if (version !== CURRENT_SCHEMA_VERSION) {
    input = migrate(input);
  }

  const parseResult = GraphJsonV1.safeParse(input);
  if (!parseResult.success) {
    throw new SerializationError(
      "INVALID_SCHEMA",
      `Invalid graph JSON: ${parseResult.error.message}`,
      {
        zodErrors: parseResult.error.issues,
      },
    );
  }

  const parsed = parseResult.data;

  for (const node of parsed.nodes) {
    if (!registry.get(node.kind)) {
      throw new SerializationError("KIND_NOT_REGISTERED", `kind not registered: "${node.kind}"`, {
        kind: node.kind,
      });
    }
  }

  const nodes: readonly WorkflowNode[] = Object.freeze(
    parsed.nodes.map((n) =>
      Object.freeze({
        id: n.id,
        kind: n.kind,
        position: Object.freeze({ x: n.position.x, y: n.position.y }),
        data: n.data,
      }),
    ),
  );

  const edges = Object.freeze(
    parsed.edges.map((e) => {
      const base = {
        id: e.id,
        source: e.source,
        sourcePort: e.sourcePort,
        target: e.target,
        targetPort: e.targetPort,
        kind: e.kind as EdgeKind,
      };
      if (e.label !== undefined) {
        Object.assign(base, { label: e.label });
      }
      if (e.condition !== undefined) {
        Object.assign(base, { condition: e.condition });
      }
      return Object.freeze(base);
    }),
  );

  return Object.freeze({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: parsed.id,
    name: parsed.name,
    nodes,
    edges,
  });
}
