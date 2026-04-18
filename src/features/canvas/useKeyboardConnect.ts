import { useCallback, useState } from "react";
import i18next from "i18next";
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
          announcement: i18next.t("canvas.noCompatibleTargets"),
        });
        return;
      }

      setState({
        active: true,
        sourceNodeId,
        sourcePortId,
        targets,
        currentIndex: 0,
        announcement: i18next.t("canvas.connectMode", {
          count: targets.length,
          label: targets[0]?.label ?? "",
          current: 1,
          total: targets.length,
        }),
      });
    },
    [findCompatibleTargets],
  );

  const cancel = useCallback(() => {
    setState({
      ...INITIAL_STATE,
      announcement: i18next.t("canvas.connectionCancelled"),
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
        announcement: i18next.t("canvas.targetPosition", {
          label: target?.label ?? "",
          current: nextIndex + 1,
          total: s.targets.length,
        }),
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
        announcement: i18next.t("canvas.targetPosition", {
          label: target?.label ?? "",
          current: prevIndex + 1,
          total: s.targets.length,
        }),
      };
    });
  }, []);

  // Read state from closure (not inside setState updater) to avoid side effects during render
  const confirm = useCallback(() => {
    if (!state.active || state.currentIndex < 0 || state.currentIndex >= state.targets.length)
      return;
    const target = state.targets[state.currentIndex];
    if (!target) return;

    const result = tryConnect({
      source: state.sourceNodeId,
      sourcePort: state.sourcePortId,
      target: target.nodeId,
      targetPort: target.portId,
    });

    setState({
      ...INITIAL_STATE,
      announcement: result.ok
        ? i18next.t("canvas.connectedTo", { label: target.label })
        : i18next.t("canvas.connectionToRejected", { label: target.label }),
    });
  }, [state, tryConnect]);

  return {
    connectState: state,
    enterConnectMode,
    cancel,
    moveNext,
    movePrev,
    confirm,
  };
}
