import type { WorkflowGraph } from "@/domain/models/graph";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";
import { validateGraph } from "@/domain/validation/graphRules";
import { SerializationError } from "@/domain/validation/errors";
import type { GraphJsonV1Type } from "@/domain/serialization/schema.v1";

function sortKeys(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

export function serialize(graph: WorkflowGraph, registry: NodeSpecRegistry): GraphJsonV1Type {
  const result = validateGraph(graph, registry);
  if (!result.ok) {
    const messages = result.error.map((e) => e.message).join("; ");
    throw new SerializationError("INVALID_GRAPH", `Cannot serialize invalid graph: ${messages}`, {
      errors: result.error,
    });
  }

  const json: GraphJsonV1Type = {
    schemaVersion: 1,
    id: graph.id,
    name: graph.name,
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      kind: n.kind as "start" | "end" | "task",
      position: { x: n.position.x, y: n.position.y },
      data: n.data,
    })),
    edges: graph.edges.map((e) => {
      const base = {
        id: e.id,
        source: e.source,
        sourcePort: e.sourcePort,
        target: e.target,
        targetPort: e.targetPort,
        kind: e.kind,
      };
      if (e.label !== undefined) {
        Object.assign(base, { label: e.label });
      }
      if (e.condition !== undefined) {
        Object.assign(base, { condition: e.condition });
      }
      return base;
    }),
  };

  return sortKeys(json) as GraphJsonV1Type;
}
