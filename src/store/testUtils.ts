import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";
import type { WorkflowNode } from "@/domain/models/node";
import type { WorkflowEdge } from "@/domain/models/edge";

/** Plain-JSON snapshot of the graph portion of the store. */
export interface GraphSnapshot {
  readonly nodes: WorkflowNode[];
  readonly edges: WorkflowEdge[];
}

/**
 * Extract a plain-JSON snapshot of the graph (nodes + edges) from the store.
 * Only captures graph data — no actions, registry, selection, or viewport state.
 */
export function snapshotGraph(store: StoreApi<WorkflowState>): GraphSnapshot {
  const { nodes, edges } = store.getState();
  return JSON.parse(JSON.stringify({ nodes, edges })) as GraphSnapshot;
}

/**
 * Restore the graph (nodes + edges) from a plain-JSON snapshot.
 * Replaces the current nodes and edges in the store.
 */
export function restoreGraph(store: StoreApi<WorkflowState>, snapshot: GraphSnapshot): void {
  store.setState({
    nodes: snapshot.nodes,
    edges: snapshot.edges,
  });
}
