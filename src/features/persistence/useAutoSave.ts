import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useWorkflowStore } from "@/store/hooks";
import type { ViewportState } from "@/store/slices/viewportSlice";
import { scrubSecrets } from "@/features/property-grid/fields/SecretField";

/** Payload shape that includes graph data plus persisted viewport. */
export interface SavePayload {
  nodes: unknown[];
  edges: unknown[];
  viewport: ViewportState;
}

/** Options for configuring `useAutoSave`. */
export interface UseAutoSaveOptions {
  /**
   * Explicit list of secret field names to scrub from the save payload.
   * Merged with the global `SECRET_FIELD_NAMES` set so secrets are
   * always scrubbed deterministically — even before any `SecretField`
   * component mounts.
   *
   * Derive these from schema descriptors at setup time using
   * `collectSecretFieldNames(descriptors)`.
   */
  readonly secretFieldNames?: readonly string[];
}

/**
 * Hook wiring viewport persistence into save/load.
 *
 * - `save()` snapshots the current graph + viewport into a `SavePayload`.
 *   Secret field values are scrubbed with the `"<secret>"` sentinel before
 *   the payload is returned, so raw secrets are never persisted.
 *   Accepts explicit `secretFieldNames` for deterministic scrubbing.
 * - `restore(payload)` loads graph state and calls `setViewport` on the
 *   xyflow instance so the canvas repositions to the saved view.
 */
export function useAutoSave(options: UseAutoSaveOptions = {}) {
  const getViewportState = useWorkflowStore((s) => s.getViewportState);
  const restoreViewport = useWorkflowStore((s) => s.restoreViewport);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const { setViewport } = useReactFlow();

  const save = useCallback((): SavePayload => {
    const viewport = getViewportState();
    const scrubbedNodes = scrubSecrets([...nodes], options.secretFieldNames) as unknown[];
    const scrubbedEdges = scrubSecrets([...edges], options.secretFieldNames) as unknown[];
    return { nodes: scrubbedNodes, edges: scrubbedEdges, viewport };
  }, [getViewportState, nodes, edges, options.secretFieldNames]);

  const restore = useCallback(
    (payload: SavePayload) => {
      restoreViewport(payload.viewport);
      void setViewport(payload.viewport);
    },
    [restoreViewport, setViewport],
  );

  return { save, restore };
}
