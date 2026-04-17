import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";
import { makeNode, type WorkflowNode, type Position } from "@/domain/models/node";
import type { WorkflowEdge } from "@/domain/models/edge";
import type { NodeSpec } from "@/domain/models/nodeSpec";

export interface GraphSlice {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  addNode: (spec: NodeSpec, position?: Position) => WorkflowNode;
  removeNode: (id: string) => void;
}

export function createGraphSlice(
  set: StoreApi<WorkflowState>["setState"],
  _get: StoreApi<WorkflowState>["getState"],
): GraphSlice {
  return {
    nodes: [],
    edges: [],
    addNode: (spec: NodeSpec, position?: Position) => {
      const node = makeNode({
        kind: spec.kind,
        data: spec.defaultData,
        position,
      });
      set((state) => ({ nodes: [...state.nodes, node] }));
      return node;
    },
    removeNode: (id: string) => {
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== id),
        edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      }));
    },
  };
}
