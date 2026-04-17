import type { WorkflowNode } from "@/domain/models/node";
import type { WorkflowGraph } from "@/domain/models/graph";
import type { NodeSpecRegistry, Result } from "@/domain/validation/connectionRules";

export type GraphValidationErrorCode =
  | "NO_ENTRY_NODE"
  | "MULTIPLE_ENTRY_NODES"
  | "NO_TERMINAL_REACHABLE"
  | "UNREACHABLE_NODE"
  | "REQUIRED_PORT_UNCONNECTED"
  | "LOOP_NODE_MISSING_BACK_EDGE"
  | "LOOP_NODE_MULTIPLE_BACK_EDGES";

export interface GraphValidationError {
  readonly code: GraphValidationErrorCode;
  readonly message: string;
}

function isEntryKind(kind: string, registry: NodeSpecRegistry): boolean {
  const spec = registry.get(kind);
  if (!spec) {
    return false;
  }
  return !spec.ports.some((p) => p.kind === "in");
}

function isTerminalKind(kind: string, registry: NodeSpecRegistry): boolean {
  const spec = registry.get(kind);
  if (!spec) {
    return false;
  }
  return !spec.ports.some((p) => p.kind === "out");
}

function buildForwardAdj(graph: WorkflowGraph): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const node of graph.nodes) {
    adj.set(node.id, new Set());
  }
  for (const edge of graph.edges) {
    const successors = adj.get(edge.source);
    if (successors) {
      successors.add(edge.target);
    }
  }
  return adj;
}

function reachableFrom(startId: string, adj: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>();
  visited.add(startId);
  const stack = [startId];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const neighbors = adj.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
  }
  return visited;
}

function checkEntryNodes(
  nodes: readonly WorkflowNode[],
  registry: NodeSpecRegistry,
): { entryNodes: readonly WorkflowNode[]; errors: GraphValidationError[] } {
  const errors: GraphValidationError[] = [];
  const entryNodes = nodes.filter((n) => isEntryKind(n.kind, registry));

  if (entryNodes.length === 0) {
    errors.push({
      code: "NO_ENTRY_NODE",
      message: "Graph must have exactly one entry node (a node with no input ports)",
    });
  } else if (entryNodes.length > 1) {
    const ids = entryNodes.map((n) => `"${n.id}"`).join(", ");
    errors.push({
      code: "MULTIPLE_ENTRY_NODES",
      message: `Graph has ${String(entryNodes.length)} entry nodes (${ids}), expected exactly one`,
    });
  }

  return { entryNodes, errors };
}

function checkReachability(
  graph: WorkflowGraph,
  entryId: string,
  registry: NodeSpecRegistry,
): GraphValidationError[] {
  const errors: GraphValidationError[] = [];
  const adj = buildForwardAdj(graph);
  const reachable = reachableFrom(entryId, adj);

  const terminalNodes = graph.nodes.filter((n) => isTerminalKind(n.kind, registry));
  const hasReachableTerminal = terminalNodes.some((n) => reachable.has(n.id));
  if (!hasReachableTerminal) {
    errors.push({
      code: "NO_TERMINAL_REACHABLE",
      message: "No terminal node is reachable from the entry node",
    });
  }

  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) {
      errors.push({
        code: "UNREACHABLE_NODE",
        message: `Node "${node.id}" (kind: ${node.kind}) is not reachable from the entry node`,
      });
    }
  }

  return errors;
}

function checkRequiredPorts(
  graph: WorkflowGraph,
  registry: NodeSpecRegistry,
): GraphValidationError[] {
  const errors: GraphValidationError[] = [];
  for (const node of graph.nodes) {
    const spec = registry.get(node.kind);
    if (!spec) {
      continue;
    }
    const requiredInputPorts = spec.ports.filter((p) => p.kind === "in" && p.required === true);
    for (const port of requiredInputPorts) {
      const hasInbound = graph.edges.some((e) => e.target === node.id && e.targetPort === port.id);
      if (!hasInbound) {
        errors.push({
          code: "REQUIRED_PORT_UNCONNECTED",
          message: `Required input port "${port.id}" on node "${node.id}" (kind: ${node.kind}) has no inbound edge`,
        });
      }
    }
  }
  return errors;
}

function checkLoopNodes(graph: WorkflowGraph, registry: NodeSpecRegistry): GraphValidationError[] {
  const errors: GraphValidationError[] = [];
  for (const node of graph.nodes) {
    const spec = registry.get(node.kind);
    if (!spec) {
      continue;
    }
    if (!spec.capabilities.includes("canHaveBackEdge")) {
      continue;
    }

    const loopBackCount = graph.edges.filter(
      (e) => e.source === node.id && e.target === node.id,
    ).length;

    if (loopBackCount === 0) {
      errors.push({
        code: "LOOP_NODE_MISSING_BACK_EDGE",
        message: `Loop node "${node.id}" (kind: ${node.kind}) must have exactly one loop-back edge but has none`,
      });
    } else if (loopBackCount > 1) {
      errors.push({
        code: "LOOP_NODE_MULTIPLE_BACK_EDGES",
        message: `Loop node "${node.id}" (kind: ${node.kind}) must have exactly one loop-back edge but has ${String(loopBackCount)}`,
      });
    }
  }
  return errors;
}

export function validateGraph(
  graph: WorkflowGraph,
  registry: NodeSpecRegistry,
): Result<void, GraphValidationError[]> {
  const { entryNodes, errors: entryErrors } = checkEntryNodes(graph.nodes, registry);
  const errors: GraphValidationError[] = [...entryErrors];

  if (entryNodes.length === 1) {
    for (const entry of entryNodes) {
      errors.push(...checkReachability(graph, entry.id, registry));
    }
  }

  errors.push(...checkRequiredPorts(graph, registry));
  errors.push(...checkLoopNodes(graph, registry));

  if (errors.length > 0) {
    return { ok: false, error: errors };
  }
  return { ok: true, value: undefined };
}
