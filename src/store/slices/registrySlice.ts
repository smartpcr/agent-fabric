import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { NodeRegistry } from "@/registry/NodeRegistry";

export interface RegistrySlice {
  nodeTypes: Record<string, unknown>;
  nodeSpecs: Record<string, NodeSpec>;
  registry: NodeRegistry;
  registerNodeType: (name: string, definition: unknown) => void;
  registerNodeSpec: (spec: NodeSpec) => void;
  setRegistry: (registry: NodeRegistry) => void;
}

export function createRegistrySlice(
  set: StoreApi<WorkflowState>["setState"],
  _get: StoreApi<WorkflowState>["getState"],
): RegistrySlice {
  return {
    nodeTypes: {},
    nodeSpecs: {},
    registry: new NodeRegistry(),
    registerNodeType: (name: string, definition: unknown) => {
      set((state) => ({
        nodeTypes: { ...state.nodeTypes, [name]: definition },
      }));
    },
    registerNodeSpec: (spec: NodeSpec) => {
      set((state) => ({
        nodeSpecs: { ...state.nodeSpecs, [spec.kind]: spec },
      }));
    },
    setRegistry: (registry: NodeRegistry) => {
      set({ registry });
    },
  };
}
