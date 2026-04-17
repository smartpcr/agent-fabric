import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";
import { makeNode, type WorkflowNode, type Position, type Dimensions } from "@/domain/models/node";
import { makeEdge, type WorkflowEdge } from "@/domain/models/edge";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import {
  validateConnection,
  type ConnectionEndpoint,
  type ConnectionInvalidError,
  type NodeSpecRegistry,
  type Result,
} from "@/domain/validation/connectionRules";
import { validateNodeData, type ValidationError } from "@/domain/validation/validators";
import { CURRENT_SCHEMA_VERSION } from "@/domain/models/graph";

export interface ConnectPortsParams {
  readonly source: ConnectionEndpoint;
  readonly target: ConnectionEndpoint;
  readonly registry: NodeSpecRegistry;
}

// xyflow-compatible node change shapes
export type NodeChange =
  | { readonly type: "add"; readonly item: WorkflowNode }
  | { readonly type: "remove"; readonly id: string }
  | { readonly type: "position"; readonly id: string; readonly position?: Position }
  | { readonly type: "select"; readonly id: string; readonly selected: boolean }
  | {
      readonly type: "dimensions";
      readonly id: string;
      readonly dimensions?: Dimensions;
    };

// xyflow-compatible edge change shapes
export type EdgeChange =
  | { readonly type: "add"; readonly item: WorkflowEdge }
  | { readonly type: "remove"; readonly id: string }
  | { readonly type: "select"; readonly id: string; readonly selected: boolean };

export interface TryConnectParams {
  readonly source: string;
  readonly sourcePort: string;
  readonly target: string;
  readonly targetPort: string;
}

export interface GraphSlice {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  addNode: (spec: NodeSpec, position?: Position) => WorkflowNode;
  removeNode: (id: string) => void;
  /** Batch-remove all currently selected nodes and their connected edges in a single undo step */
  deleteSelected: () => void;
  connectPorts: (params: ConnectPortsParams) => Result<WorkflowEdge, ConnectionInvalidError>;
  /** Convenience action: maps simple ids to connectPorts; returns result */
  tryConnect: (params: TryConnectParams) => Result<WorkflowEdge, ConnectionInvalidError>;
  updateNodeData: (id: string, newData: unknown) => Result<void, ValidationError[]>;
  updateNodePosition: (id: string, position: Position) => void;
  updateEdgeLabel: (id: string, label: string) => void;
  applyNodeChanges: (changes: NodeChange[]) => void;
  applyEdgeChanges: (changes: EdgeChange[]) => void;
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
    deleteSelected: () => {
      const selected = get().selected;
      const selectedEdges = get().selectedEdges;
      if (selected.size === 0 && selectedEdges.size === 0) return;
      // Batch node/edge removal AND selection clear in a single set() so zundo
      // records exactly one undo step.
      set((state) => ({
        nodes: state.nodes.filter((n) => !selected.has(n.id)),
        edges: state.edges.filter(
          (e) => !selectedEdges.has(e.id) && !selected.has(e.source) && !selected.has(e.target),
        ),
        selected: new Set<string>(),
        selectedNodeIds: [] as string[],
        selectedEdges: new Set<string>(),
        selectedEdgeIds: [] as string[],
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
    tryConnect: (params: TryConnectParams) => {
      const state = get();
      return state.connectPorts({
        source: { nodeId: params.source, portId: params.sourcePort },
        target: { nodeId: params.target, portId: params.targetPort },
        registry: state.registry,
      });
    },
    updateNodeData: (id: string, newData: unknown) => {
      const state = get();
      const node = state.nodes.find((n) => n.id === id);
      if (!node) {
        return { ok: false, error: [{ path: "", message: `Node "${id}" not found` }] };
      }

      const spec = state.nodeSpecs[node.kind];
      if (!spec) {
        return { ok: false, error: [{ path: "", message: `No spec for kind "${node.kind}"` }] };
      }

      const candidate = { ...node, data: newData };
      const errors = validateNodeData(candidate, spec);
      if (errors.length > 0) {
        return { ok: false, error: errors };
      }

      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: newData } : n)),
      }));
      return { ok: true, value: undefined };
    },
    updateNodePosition: (id: string, position: Position) => {
      const x = Number.isFinite(position.x) ? position.x : 0;
      const y = Number.isFinite(position.y) ? position.y : 0;
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, position: { x, y } } : n)),
      }));
    },
    updateEdgeLabel: (id: string, label: string) => {
      set((s) => ({
        edges: s.edges.map((e) => (e.id === id ? { ...e, label } : e)),
      }));
    },
    applyNodeChanges: (changes: NodeChange[]) => {
      set((state) => {
        let nodes = state.nodes;
        let edges = state.edges;

        for (const change of changes) {
          switch (change.type) {
            case "add":
              nodes = [...nodes, change.item];
              break;
            case "remove":
              nodes = nodes.filter((n) => n.id !== change.id);
              edges = edges.filter((e) => e.source !== change.id && e.target !== change.id);
              break;
            case "position":
              if (change.position) {
                const x = Number.isFinite(change.position.x) ? change.position.x : 0;
                const y = Number.isFinite(change.position.y) ? change.position.y : 0;
                nodes = nodes.map((n) => (n.id === change.id ? { ...n, position: { x, y } } : n));
              }
              break;
            case "select":
              nodes = nodes.map((n) =>
                n.id === change.id ? { ...n, selected: change.selected } : n,
              );
              break;
            case "dimensions":
              if (change.dimensions) {
                const { width, height } = change.dimensions;
                nodes = nodes.map((n) => (n.id === change.id ? { ...n, width, height } : n));
              }
              break;
            default:
              break;
          }
        }

        return { nodes, edges };
      });
    },
    applyEdgeChanges: (changes: EdgeChange[]) => {
      set((state) => {
        let edges = state.edges;

        for (const change of changes) {
          switch (change.type) {
            case "add":
              edges = [...edges, change.item];
              break;
            case "remove":
              edges = edges.filter((e) => e.id !== change.id);
              break;
            case "select":
              edges = edges.map((e) =>
                e.id === change.id ? { ...e, selected: change.selected } : e,
              );
              break;
            default:
              break;
          }
        }

        return { edges };
      });
    },
  };
}
