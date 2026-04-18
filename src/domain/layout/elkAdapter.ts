import type { ElkNode, ElkPort, ElkExtendedEdge } from "elkjs/lib/elk-api";
import type { WorkflowGraph } from "@/domain/models/graph";
import type { WorkflowNode } from "@/domain/models/node";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 60;

/**
 * Transform a `WorkflowGraph` into an ELK-compatible JSON graph.
 *
 * Each workflow node becomes an ELK child with ports derived from the
 * registry spec. Each workflow edge becomes an ELK extended edge whose
 * sources/targets reference the composite `nodeId.portId` identifiers.
 */
export function toElkGraph(graph: WorkflowGraph, registry: NodeSpecRegistry): ElkNode {
  const children: ElkNode[] = graph.nodes.map((node) => {
    const spec = registry.get(node.kind);
    const ports: ElkPort[] = (spec?.ports ?? []).map((p) => ({
      id: `${node.id}.${p.id}`,
      labels: [{ text: p.label }],
      layoutOptions: {
        "org.eclipse.elk.port.side": p.kind === "in" ? "WEST" : "EAST",
      },
    }));

    return {
      id: node.id,
      width: node.width ?? DEFAULT_NODE_WIDTH,
      height: node.height ?? DEFAULT_NODE_HEIGHT,
      labels: [{ text: spec?.label ?? node.kind }],
      ports,
      layoutOptions: {
        "org.eclipse.elk.portConstraints": "FIXED_SIDE",
      },
    };
  });

  const edges: ElkExtendedEdge[] = graph.edges.map((edge) => ({
    id: edge.id,
    sources: [`${edge.source}.${edge.sourcePort}`],
    targets: [`${edge.target}.${edge.targetPort}`],
    labels: edge.label === undefined ? [] : [{ text: edge.label }],
  }));

  return {
    id: graph.id,
    children,
    edges,
  };
}

/**
 * Apply ELK layout positions back to workflow graph nodes.
 *
 * Each ELK child's `x, y` coordinates are mapped back to the
 * corresponding `WorkflowNode.position`. Edges are left untouched.
 * If the ELK result has no children or the graph is empty, the
 * original graph is returned unchanged.
 */
export function fromElkLayout(elkResult: ElkNode, graph: WorkflowGraph): WorkflowGraph {
  const children = elkResult.children;
  if (!children || children.length === 0) return graph;

  const positionMap = new Map<string, { x: number; y: number }>();
  for (const child of children) {
    positionMap.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  const updatedNodes: WorkflowNode[] = graph.nodes.map((node) => {
    const pos = positionMap.get(node.id);
    if (!pos) return node;
    return Object.freeze({
      ...node,
      position: Object.freeze({ x: pos.x, y: pos.y }),
    });
  });

  return Object.freeze({
    ...graph,
    nodes: Object.freeze(updatedNodes),
  });
}
