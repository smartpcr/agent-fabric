import { CURRENT_SCHEMA_VERSION, type WorkflowGraph } from "@/domain/models/graph";
import type { WorkflowNode } from "@/domain/models/node";
import type { WorkflowEdge } from "@/domain/models/edge";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";
import type { LayoutStrategy } from "@/domain/layout/layoutOptions";
import { layoutGraph } from "@/domain/layout/layoutGraph";

/**
 * Compute the minimum bounding subgraph affected by a node change.
 *
 * Starting from the changed node, follows edges in both directions (BFS)
 * to collect all transitively connected nodes. Returns a subgraph
 * containing only those nodes and the edges between them.
 */
export function computeAffectedSubgraph(
  graph: WorkflowGraph,
  changedNodeId: string,
): WorkflowGraph {
  const nodeSet = new Set<string>();
  const queue: string[] = [changedNodeId];

  // Build adjacency index for O(1) edge lookup
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const outs = outgoing.get(edge.source);
    if (outs) {
      outs.push(edge.target);
    } else {
      outgoing.set(edge.source, [edge.target]);
    }
    const ins = incoming.get(edge.target);
    if (ins) {
      ins.push(edge.source);
    } else {
      incoming.set(edge.target, [edge.source]);
    }
  }

  // BFS in both directions
  while (queue.length > 0) {
    const current = queue.shift()!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    if (nodeSet.has(current)) continue;
    nodeSet.add(current);

    for (const neighbor of outgoing.get(current) ?? []) {
      if (!nodeSet.has(neighbor)) queue.push(neighbor);
    }
    for (const neighbor of incoming.get(current) ?? []) {
      if (!nodeSet.has(neighbor)) queue.push(neighbor);
    }
  }

  const subNodes: WorkflowNode[] = graph.nodes.filter((n) => nodeSet.has(n.id));
  const subEdges: WorkflowEdge[] = graph.edges.filter(
    (e) => nodeSet.has(e.source) && nodeSet.has(e.target),
  );

  return Object.freeze({
    schemaVersion: graph.schemaVersion,
    id: graph.id,
    name: graph.name,
    nodes: Object.freeze(subNodes),
    edges: Object.freeze(subEdges),
  });
}

/**
 * Merge laid-out subgraph positions back into the full graph.
 *
 * Nodes in the subgraph receive updated positions; nodes not in the
 * subgraph keep their original positions.
 */
export function mergeSubgraphPositions(
  fullGraph: WorkflowGraph,
  layoutResult: WorkflowGraph,
): WorkflowGraph {
  const positionMap = new Map<string, { x: number; y: number }>();
  for (const node of layoutResult.nodes) {
    positionMap.set(node.id, { x: node.position.x, y: node.position.y });
  }

  const mergedNodes: WorkflowNode[] = fullGraph.nodes.map((node) => {
    const newPos = positionMap.get(node.id);
    if (!newPos) return node;
    return Object.freeze({
      ...node,
      position: Object.freeze(newPos),
    });
  });

  return Object.freeze({
    ...fullGraph,
    nodes: Object.freeze(mergedNodes),
  });
}

/**
 * Run incremental auto-layout: only the subgraph connected to the changed
 * node is sent through ELK, and the resulting positions are merged back
 * into the full graph.
 */
export async function incrementalLayout(
  graph: WorkflowGraph,
  changedNodeId: string,
  registry: NodeSpecRegistry,
  strategy?: LayoutStrategy,
): Promise<WorkflowGraph> {
  const subgraph = computeAffectedSubgraph(graph, changedNodeId);

  // If the subgraph is the entire graph, just layout everything
  if (subgraph.nodes.length === graph.nodes.length) {
    return layoutGraph(graph, registry, strategy);
  }

  // Build a standalone subgraph with its own id for ELK
  const isolatedSubgraph: WorkflowGraph = Object.freeze({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: `sub-${graph.id}`,
    name: `sub-${graph.name}`,
    nodes: subgraph.nodes,
    edges: subgraph.edges,
  });

  const layoutResult = await layoutGraph(isolatedSubgraph, registry, strategy);
  return mergeSubgraphPositions(graph, layoutResult);
}
