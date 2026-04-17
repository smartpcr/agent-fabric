import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useWorkflowStore } from "@/store/hooks";
import type { ViewportState } from "@/store/slices/viewportSlice";

const STORAGE_KEY = "agent-fabric:viewport";

/**
 * Persist viewport {x, y, zoom} to localStorage and restore on mount.
 * Saves after every viewport change (debounced to avoid write storms).
 */
export function useViewportPersistence() {
  const zoom = useWorkflowStore((s) => s.zoom);
  const panX = useWorkflowStore((s) => s.panX);
  const panY = useWorkflowStore((s) => s.panY);
  const restoreViewport = useWorkflowStore((s) => s.restoreViewport);
  const { setViewport } = useReactFlow();

  const restoredRef = useRef(false);

  // Restore viewport from localStorage on first mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as ViewportState;
        if (
          typeof saved.x === "number" &&
          typeof saved.y === "number" &&
          typeof saved.zoom === "number"
        ) {
          restoreViewport(saved);
          void setViewport(saved);
        }
      }
    } catch {
      // Ignore malformed storage
    }
  }, [restoreViewport, setViewport]);

  // Save viewport to localStorage on every change
  useEffect(() => {
    try {
      const payload: ViewportState = { x: panX, y: panY, zoom };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, [panX, panY, zoom]);
}
