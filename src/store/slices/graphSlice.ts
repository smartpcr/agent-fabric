import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";
import { makeNode, type WorkflowNode, type Position } from "@/domain/models/node";
import { makeEdge, type WorkflowEdge } from "@/domain/models/edge";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import {
  validateConnection,
  type ConnectionEndpoint,
  type ConnectionInvalidError,
  type NodeSpecRegistry,
  type Result,
} from "@/domain/validation/connectionRules";
import { CURRENT_SCHEMA_VERSION } from "@/domain/models/graph";

export interface ConnectPortsParams {
  readonly source: ConnectionEndpoint;
  readonly target: ConnectionEndpoint;
  readonly registry: NodeSpecRegistry;
}

export interface GraphSlice {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  addNode: (spec: NodeSpec, position?: Position) => WorkflowNode;
  removeNode: (id: string) => void;
  connectPorts: (params: ConnectPortsParams) => Result<WorkflowEdge, ConnectionInvalidError>;
}

export function createGraphSlice(
  set: StoreApi<WorkflowState>["setState"],
  get: StoreApi<WorkflowState>["getState"],
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
    connectPorts: (params: ConnectPortsParams) => {
      const state = get();
      const graph = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        id: "store",
        name: "store",
        nodes: state.nodes,
        edges: state.edges,
      };

      const result = validateConnection(graph, params.source, params.target, params.registry);
      if (!result.ok) {
        return result;
      }

      const edge = makeEdge({
        source: params.source.nodeId,
        sourcePort: params.source.portId,
        target: params.target.nodeId,
        targetPort: params.target.portId,
      });

      set((s) => ({ edges: [...s.edges, edge] }));
      return { ok: true, value: edge };
    },
  };
}
