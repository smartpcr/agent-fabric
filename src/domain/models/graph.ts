import { newId } from "@/utils/id";
import type { WorkflowNode } from "@/domain/models/node";
import type { WorkflowEdge } from "@/domain/models/edge";

export const CURRENT_SCHEMA_VERSION = 1;

export interface WorkflowGraph {
  readonly schemaVersion: number;
  readonly id: string;
  readonly name: string;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
}

export function makeGraph(name: string): WorkflowGraph {
  return Object.freeze({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: newId("graph"),
    name,
    nodes: Object.freeze([]),
    edges: Object.freeze([]),
  });
}

export function addNodeToGraph(graph: WorkflowGraph, node: WorkflowNode): WorkflowGraph {
  return Object.freeze({
    ...graph,
    nodes: Object.freeze([...graph.nodes, node]),
  });
}

export function removeNodeFromGraph(graph: WorkflowGraph, nodeId: string): WorkflowGraph {
  return Object.freeze({
    ...graph,
    nodes: Object.freeze(graph.nodes.filter((n) => n.id !== nodeId)),
    edges: Object.freeze(graph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)),
  });
}

export function addEdgeToGraph(graph: WorkflowGraph, edge: WorkflowEdge): WorkflowGraph {
  return Object.freeze({
    ...graph,
    edges: Object.freeze([...graph.edges, edge]),
  });
}

export function removeEdgeFromGraph(graph: WorkflowGraph, edgeId: string): WorkflowGraph {
  return Object.freeze({
    ...graph,
    edges: Object.freeze(graph.edges.filter((e) => e.id !== edgeId)),
  });
}
