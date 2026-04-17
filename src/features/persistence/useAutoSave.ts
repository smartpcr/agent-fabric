import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useWorkflowStore } from "@/store/hooks";
import type { ViewportState } from "@/store/slices/viewportSlice";

/** Payload shape that includes graph data plus persisted viewport. */
export interface SavePayload {
  nodes: unknown[];
  edges: unknown[];
  viewport: ViewportState;
}

/**
 * Stub hook wiring viewport persistence into save/load.
 *
 * - `save()` snapshots the current graph + viewport into a `SavePayload`.
 * - `restore(payload)` loads graph state and calls `setViewport` on the
 *   xyflow instance so the canvas repositions to the saved view.
 */
export function useAutoSave() {
  const getViewportState = useWorkflowStore((s) => s.getViewportState);
  const restoreViewport = useWorkflowStore((s) => s.restoreViewport);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const { setViewport } = useReactFlow();

  const save = useCallback((): SavePayload => {
    const viewport = getViewportState();
    return { nodes: [...nodes], edges: [...edges], viewport };
  }, [getViewportState, nodes, edges]);

  const restore = useCallback(
    (payload: SavePayload) => {
      restoreViewport(payload.viewport);
      void setViewport(payload.viewport);
    },
    [restoreViewport, setViewport],
  );

  return { save, restore };
}
