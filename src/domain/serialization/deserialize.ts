import { GraphJsonV1 } from "@/domain/serialization/schema.v1";
import { migrate } from "@/domain/serialization/migrate";
import { SerializationError } from "@/domain/validation/errors";
import { CURRENT_SCHEMA_VERSION, type WorkflowGraph } from "@/domain/models/graph";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";
import type { WorkflowNode } from "@/domain/models/node";
import type { EdgeKind } from "@/domain/models/edge";

export function deserialize(json: unknown, registry: NodeSpecRegistry): WorkflowGraph {
  let input = json;

  const raw = input as Record<string, unknown> | null;
  const version = raw?.schemaVersion;
  if (typeof version === "number" && version !== CURRENT_SCHEMA_VERSION) {
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
