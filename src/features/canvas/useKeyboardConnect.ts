import { useCallback, useState } from "react";
import { validateConnection, type NodeSpecRegistry } from "@/domain/validation/connectionRules";
import { CURRENT_SCHEMA_VERSION } from "@/domain/models/graph";
import type { WorkflowNode } from "@/domain/models/node";
import type { WorkflowEdge } from "@/domain/models/edge";

export interface KeyboardConnectState {
  /** Whether we are currently in keyboard-connect mode */
  active: boolean;
  /** The source node id */
  sourceNodeId: string;
  /** The source port id */
  sourcePortId: string;
  /** All compatible target endpoints */
  targets: ReadonlyArray<{ nodeId: string; portId: string; label: string }>;
  /** Current index into targets */
  currentIndex: number;
  /** Live-region announcement */
  announcement: string;
}

const INITIAL_STATE: KeyboardConnectState = {
  active: false,
  sourceNodeId: "",
  sourcePortId: "",
  targets: [],
  currentIndex: -1,
  announcement: "",
};

/**
 * Hook for managing keyboard-driven connection flow.
 * Returns state and handlers for enter/arrow/escape/confirm.
 */
export function useKeyboardConnect(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
  registry: NodeSpecRegistry,
  tryConnect: (params: {
    source: string;
    sourcePort: string;
    target: string;
    targetPort: string;
  }) => { ok: boolean },
) {
  const [state, setState] = useState<KeyboardConnectState>(INITIAL_STATE);

  const findCompatibleTargets = useCallback(
    (sourceNodeId: string, sourcePortId: string) => {
      const graph = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        id: "store",
        name: "store",
        nodes,
        edges,
      };

      const targets: Array<{ nodeId: string; portId: string; label: string }> = [];

      for (const node of nodes) {
        const spec = registry.get(node.kind);
        if (!spec) continue;
        for (const port of spec.ports) {
          if (port.kind !== "in") continue;
          const result = validateConnection(
            graph,
            { nodeId: sourceNodeId, portId: sourcePortId },
            { nodeId: node.id, portId: port.id },
            registry,
          );
          if (result.ok) {
            targets.push({ nodeId: node.id, portId: port.id, label: port.label });
          }
        }
      }

      return targets;
    },
    [nodes, edges, registry],
  );

  const enterConnectMode = useCallback(
    (sourceNodeId: string, sourcePortId: string) => {
      const targets = findCompatibleTargets(sourceNodeId, sourcePortId);
      if (targets.length === 0) {
        setState({
          ...INITIAL_STATE,
          announcement: "No compatible targets available",
        });
        return;
      }

      setState({
        active: true,
        sourceNodeId,
        sourcePortId,
        targets,
        currentIndex: 0,
        announcement: `Connect mode: ${String(targets.length)} targets. ${targets[0]?.label ?? ""} (1 of ${String(targets.length)})`,
      });
    },
    [findCompatibleTargets],
  );

  const cancel = useCallback(() => {
    setState({
      ...INITIAL_STATE,
      announcement: "Connection cancelled",
    });
  }, []);

  const moveNext = useCallback(() => {
    setState((s) => {
      if (!s.active || s.targets.length === 0) return s;
      const nextIndex = (s.currentIndex + 1) % s.targets.length;
      const target = s.targets[nextIndex];
      return {
        ...s,
        currentIndex: nextIndex,
        announcement: `${target?.label ?? ""} (${String(nextIndex + 1)} of ${String(s.targets.length)})`,
      };
    });
  }, []);

  const movePrev = useCallback(() => {
    setState((s) => {
      if (!s.active || s.targets.length === 0) return s;
      const prevIndex = (s.currentIndex - 1 + s.targets.length) % s.targets.length;
      const target = s.targets[prevIndex];
      return {
        ...s,
        currentIndex: prevIndex,
        announcement: `${target?.label ?? ""} (${String(prevIndex + 1)} of ${String(s.targets.length)})`,
      };
    });
  }, []);

  const confirm = useCallback(() => {
    setState((s) => {
      if (!s.active || s.currentIndex < 0 || s.currentIndex >= s.targets.length) return s;
      const target = s.targets[s.currentIndex];
      if (!target) return s;

      const result = tryConnect({
        source: s.sourceNodeId,
        sourcePort: s.sourcePortId,
        target: target.nodeId,
        targetPort: target.portId,
      });

      return {
        ...INITIAL_STATE,
        announcement: result.ok
          ? `Connected to ${target.label}`
          : `Connection to ${target.label} rejected`,
      };
    });
  }, [tryConnect]);

  return {
    connectState: state,
    enterConnectMode,
    cancel,
    moveNext,
    movePrev,
    confirm,
  };
}
