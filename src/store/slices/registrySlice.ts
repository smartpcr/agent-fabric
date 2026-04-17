import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";
import type { NodeSpec } from "@/domain/models/nodeSpec";

export interface RegistrySlice {
  nodeTypes: Record<string, unknown>;
  nodeSpecs: Record<string, NodeSpec>;
  registerNodeType: (name: string, definition: unknown) => void;
  registerNodeSpec: (spec: NodeSpec) => void;
}

export function createRegistrySlice(
  set: StoreApi<WorkflowState>["setState"],
  _get: StoreApi<WorkflowState>["getState"],
): RegistrySlice {
  return {
    nodeTypes: {},
    nodeSpecs: {},
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
  };
}
