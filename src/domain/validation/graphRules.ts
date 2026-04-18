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
  | "LOOP_NODE_MULTIPLE_BACK_EDGES"
  | "DECISION_ORPHAN_EDGE"
  | "DECISION_DUPLICATE_BRANCH"
  | "DECISION_MISSING_DEFAULT";

export type GraphValidationSeverity = "error" | "warning";

export interface GraphValidationError {
  readonly code: GraphValidationErrorCode;
  readonly message: string;
  readonly severity?: GraphValidationSeverity;
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

function branchPortId(label: string): string {
  return `branch-${label.toLowerCase().replace(/\s+/g, "-")}`;
}

/**
 * Extract allowed output port IDs for a decision node.
 * For if-else: uses static spec ports.
 * For switch: derives from node data.branches + implicit `default`.
 */
function getDeclaredOutputPortIds(
  node: WorkflowNode,
  variant: string,
  specOutputPortIds: readonly string[],
): Set<string> {
  if (variant === "switch") {
    const data = node.data as Record<string, unknown> | null | undefined;
    const raw = data && typeof data === "object" ? data.branches : undefined;
    if (Array.isArray(raw)) {
      const ids: string[] = [];
      for (const b of raw) {
        if (
          b &&
          typeof b === "object" &&
          typeof (b as Record<string, unknown>).label === "string"
        ) {
          ids.push(branchPortId((b as Record<string, unknown>).label as string));
        }
      }
      ids.push("default");
      return new Set(ids);
    }
  }
  return new Set(specOutputPortIds);
}

function checkDecisionNodes(
  graph: WorkflowGraph,
  registry: NodeSpecRegistry,
): GraphValidationError[] {
  const diagnostics: GraphValidationError[] = [];

  for (const node of graph.nodes) {
    const spec = registry.get(node.kind);
    if (!spec) {
      continue;
    }
    const variant = spec.variant;
    if (variant !== "if-else" && variant !== "switch") {
      continue;
    }

    const specOutputPortIds = spec.ports.filter((p) => p.kind === "out").map((p) => p.id);
    const declaredPortIds = getDeclaredOutputPortIds(node, variant, specOutputPortIds);
    // `default` is always accepted even if not in declared ports
    const allowedPortIds = new Set([...declaredPortIds, "default"]);

    const outgoingEdges = graph.edges.filter((e) => e.source === node.id);

    // Orphan edge: sourcePort not in allowed set
    for (const edge of outgoingEdges) {
      if (!allowedPortIds.has(edge.sourcePort)) {
        diagnostics.push({
          code: "DECISION_ORPHAN_EDGE",
          message: `Outgoing edge "${edge.id}" from decision node "${node.id}" (kind: ${node.kind}) uses sourcePort "${edge.sourcePort}" which is not a declared branch or "default"`,
        });
      }
    }

    // Duplicate branches: multiple edges from same sourcePort
    const portUsage = new Map<string, string[]>();
    for (const edge of outgoingEdges) {
      const existing = portUsage.get(edge.sourcePort) ?? [];
      existing.push(edge.id);
      portUsage.set(edge.sourcePort, existing);
    }
    for (const [portId, edgeIds] of portUsage) {
      if (edgeIds.length > 1) {
        diagnostics.push({
          code: "DECISION_DUPLICATE_BRANCH",
          message: `Decision node "${node.id}" (kind: ${node.kind}) has ${String(edgeIds.length)} outgoing edges from sourcePort "${portId}"; each branch should have at most one edge`,
        });
      }
    }

    // Missing default: only warn when `default` is a declared port
    if (declaredPortIds.has("default")) {
      const hasDefault = outgoingEdges.some((e) => e.sourcePort === "default");
      if (!hasDefault) {
        diagnostics.push({
          code: "DECISION_MISSING_DEFAULT",
          message: `Decision node "${node.id}" (kind: ${node.kind}) has no outgoing edge from the "default" port`,
          severity: "warning",
        });
      }
    }
  }

  return diagnostics;
}

export function validateGraph(
  graph: WorkflowGraph,
  registry: NodeSpecRegistry,
): Result<GraphValidationError[], GraphValidationError[]> {
  const { entryNodes, errors: entryErrors } = checkEntryNodes(graph.nodes, registry);
  const allDiagnostics: GraphValidationError[] = [...entryErrors];

  if (entryNodes.length === 1) {
    for (const entry of entryNodes) {
      allDiagnostics.push(...checkReachability(graph, entry.id, registry));
    }
  }

  allDiagnostics.push(...checkRequiredPorts(graph, registry));
  allDiagnostics.push(...checkLoopNodes(graph, registry));
  allDiagnostics.push(...checkDecisionNodes(graph, registry));

  const errors = allDiagnostics.filter((d) => (d.severity ?? "error") === "error");
  const warnings = allDiagnostics.filter((d) => d.severity === "warning");

  if (errors.length > 0) {
    return { ok: false, error: allDiagnostics };
  }
  return { ok: true, value: warnings };
}
