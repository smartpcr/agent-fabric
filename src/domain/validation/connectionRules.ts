import type { WorkflowGraph } from "@/domain/models/graph";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import type { PortSpec } from "@/domain/models/port";
import { isAssignable, type DataTypeWhitelist } from "@/domain/validation/dataTypes";
import { ok as okResult, err, type Result } from "@/domain/result";

// Re-export Result so existing consumers (graphRules.ts) can continue importing from here.
export type { Result };

export type ConnectionErrorCode =
  | "SOURCE_NODE_NOT_FOUND"
  | "TARGET_NODE_NOT_FOUND"
  | "SOURCE_PORT_NOT_FOUND"
  | "TARGET_PORT_NOT_FOUND"
  | "WRONG_DIRECTION"
  | "DATA_TYPE_MISMATCH"
  | "CARDINALITY_EXCEEDED"
  | "SELF_LOOP_SAME_PORT"
  | "LOOP_BACK_NOT_ALLOWED";

export interface ConnectionInvalidError {
  readonly code: ConnectionErrorCode;
  readonly message: string;
  /** ID of the existing edge that caused the conflict (e.g. for CARDINALITY_EXCEEDED) */
  readonly conflictingEdgeId?: string;
}

function ok(): Result<void, ConnectionInvalidError> {
  return okResult(undefined);
}

function fail(code: ConnectionErrorCode, message: string): Result<void, ConnectionInvalidError> {
  return err({ code, message });
}

export interface NodeSpecRegistry {
  get(kind: string): NodeSpec | undefined;
}

export interface ConnectionEndpoint {
  readonly nodeId: string;
  readonly portId: string;
}

export interface ValidateConnectionOptions {
  readonly dataTypeWhitelist?: DataTypeWhitelist;
}

export function validateConnection(
  graph: WorkflowGraph,
  src: ConnectionEndpoint,
  tgt: ConnectionEndpoint,
  registry: NodeSpecRegistry,
  options?: ValidateConnectionOptions,
): Result<void, ConnectionInvalidError> {
  // Self-loop on same port (checked before port resolution)
  if (src.nodeId === tgt.nodeId && src.portId === tgt.portId) {
    return fail(
      "SELF_LOOP_SAME_PORT",
      `Cannot connect port "${src.portId}" to itself on node "${src.nodeId}"`,
    );
  }

  // Find source and target nodes
  const sourceNode = graph.nodes.find((n) => n.id === src.nodeId);
  if (!sourceNode) {
    return fail("SOURCE_NODE_NOT_FOUND", `Source node "${src.nodeId}" not found in graph`);
  }

  const targetNode = graph.nodes.find((n) => n.id === tgt.nodeId);
  if (!targetNode) {
    return fail("TARGET_NODE_NOT_FOUND", `Target node "${tgt.nodeId}" not found in graph`);
  }

  // Resolve specs
  const sourceSpec = registry.get(sourceNode.kind);
  const targetSpec = registry.get(targetNode.kind);

  // Find ports on specs
  const sourcePort: PortSpec | undefined = sourceSpec?.ports.find((p) => p.id === src.portId);
  if (!sourcePort) {
    return fail(
      "SOURCE_PORT_NOT_FOUND",
      `Port "${src.portId}" not found on source node "${src.nodeId}" (kind: ${sourceNode.kind})`,
    );
  }

  const targetPort: PortSpec | undefined = targetSpec?.ports.find((p) => p.id === tgt.portId);
  if (!targetPort) {
    return fail(
      "TARGET_PORT_NOT_FOUND",
      `Port "${tgt.portId}" not found on target node "${tgt.nodeId}" (kind: ${targetNode.kind})`,
    );
  }

  // Direction: source must be output, target must be input
  if (sourcePort.kind !== "out") {
    return fail("WRONG_DIRECTION", `Source port "${src.portId}" is not an output port`);
  }
  if (targetPort.kind !== "in") {
    return fail("WRONG_DIRECTION", `Target port "${tgt.portId}" is not an input port`);
  }

  // DataType assignability
  if (!isAssignable(sourcePort.dataType, targetPort.dataType, options?.dataTypeWhitelist)) {
    return fail(
      "DATA_TYPE_MISMATCH",
      `Cannot assign "${sourcePort.dataType}" to "${targetPort.dataType}"`,
    );
  }

  // Cardinality: single target port must have no existing inbound edge
  if (targetPort.cardinality === "single") {
    const existingEdge = graph.edges.find(
      (e) => e.target === tgt.nodeId && e.targetPort === tgt.portId,
    );
    if (existingEdge) {
      return {
        ok: false,
        error: {
          code: "CARDINALITY_EXCEEDED",
          message: `Target port "${tgt.portId}" on node "${tgt.nodeId}" already has an inbound edge (cardinality: single)`,
          conflictingEdgeId: existingEdge.id,
        },
      };
    }
  }

  // Loop-back edges: self-referencing (same node, different ports) need canHaveBackEdge
  if (src.nodeId === tgt.nodeId && sourceSpec) {
    if (!sourceSpec.capabilities.includes("canHaveBackEdge")) {
      return fail(
        "LOOP_BACK_NOT_ALLOWED",
        `Node "${src.nodeId}" (kind: ${sourceNode.kind}) does not support loop-back edges`,
      );
    }
  }

  return ok();
}
