import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useWorkflowStore, getStoreInstance } from "@/store/hooks";
import { useWorkflowRepo } from "@/hooks/useWorkflowRepo";
import { validateGraph } from "@/domain/validation/graphRules";
import { CURRENT_SCHEMA_VERSION } from "@/domain/models/graph";
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

// ─── Debounced Auto-Save ──────────────────────────────────────────────

/** Default debounce delay in milliseconds. */
export const AUTO_SAVE_DEBOUNCE_MS = 10_000;

/** Options for `useDebouncedAutoSave`. */
export interface UseDebouncedAutoSaveOptions {
  /** Workflow id to save to. */
  readonly workflowId: string;
  /** Whether auto-save is enabled. Defaults to `true`. */
  readonly enabled?: boolean;
  /** Debounce delay in ms. Defaults to `AUTO_SAVE_DEBOUNCE_MS` (10 000). */
  readonly debounceMs?: number;
}

export interface UseDebouncedAutoSaveReturn {
  /** Whether the graph has unsaved mutations. */
  readonly dirty: boolean;
}

/**
 * Debounced auto-save hook.
 *
 * Subscribes to the temporal store (zundo) to detect mutations (pastStates
 * length increases). After the graph becomes dirty, a debounced timer
 * schedules a save via `useWorkflowRepo`. The save is skipped when the
 * graph has validation errors (severity = "error").
 */
export function useDebouncedAutoSave(
  options: UseDebouncedAutoSaveOptions,
): UseDebouncedAutoSaveReturn {
  const { workflowId, enabled = true, debounceMs = AUTO_SAVE_DEBOUNCE_MS } = options;

  const repo = useWorkflowRepo();
  const [dirty, setDirty] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPastLengthRef = useRef<number | null>(null);

  // Stabilize repo reference so the subscription effect doesn't re-run
  const repoRef = useRef(repo);
  useEffect(() => {
    repoRef.current = repo;
  });

  useEffect(() => {
    if (!enabled) return;

    const store = getStoreInstance();
    const temporalStore = useWorkflowStore.temporal;

    // Record the current pastStates length as baseline
    prevPastLengthRef.current = temporalStore.getState().pastStates.length;

    const unsubscribe = temporalStore.subscribe((temporalState) => {
      const currentLength = temporalState.pastStates.length;

      // No new mutation since last check
      if (currentLength <= (prevPastLengthRef.current ?? 0)) {
        prevPastLengthRef.current = currentLength;
        return;
      }

      prevPastLengthRef.current = currentLength;
      setDirty(true);

      // Reset debounce timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;

        // Read current state imperatively at fire time
        const { nodes, edges, registry } = store.getState();
        const graph = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          id: workflowId,
          name: workflowId,
          nodes: [...nodes],
          edges: [...edges],
        };

        const result = validateGraph(graph, registry);
        if (!result.ok) {
          return;
        }

        void repoRef.current.save(workflowId, graph);
        setDirty(false);
      }, debounceMs);
    });

    return () => {
      unsubscribe();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [enabled, debounceMs, workflowId]);

  return { dirty };
}
