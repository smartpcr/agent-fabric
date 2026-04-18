import { useRef, useCallback } from "react";
import { useDragContext } from "@/features/palette/DragContext";

const DRAG_THRESHOLD = 3;

interface UseDragStartOptions {
  readonly kind: string;
  readonly disabled?: boolean;
}

interface UseDragStartResult {
  readonly onPointerDown: (e: React.PointerEvent) => void;
}

export function useDragStart({ kind, disabled = false }: UseDragStartOptions): UseDragStartResult {
  const { state, startDrag, endDrag } = useDragContext();
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || state.isDragging) return;

      const el = e.currentTarget as HTMLElement;
      const pointerId = e.pointerId;
      startPos.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;

      el.setPointerCapture(pointerId);

      const listeners: {
        move?: (ev: PointerEvent) => void;
        up?: () => void;
        key?: (ev: KeyboardEvent) => void;
        globalUp?: () => void;
      } = {};

      const releaseCapture = () => {
        try {
          el.releasePointerCapture(pointerId);
        } catch {
          /* capture may already be released */
        }
      };

      const cleanupAll = () => {
        if (listeners.move) el.removeEventListener("pointermove", listeners.move);
        if (listeners.up) el.removeEventListener("pointerup", listeners.up);
        if (listeners.globalUp) window.removeEventListener("pointerup", listeners.globalUp);
        if (listeners.key) document.removeEventListener("keydown", listeners.key);
        startPos.current = null;
        isDraggingRef.current = false;
      };

      listeners.move = (ev: PointerEvent) => {
        const start = startPos.current;
        if (!start) return;

        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!isDraggingRef.current && distance > DRAG_THRESHOLD) {
          isDraggingRef.current = true;
          startDrag({ kind });

          // Release pointer capture so pointerup reaches the drop target
          // (canvas) instead of staying captured on this palette element.
          releaseCapture();

          // Promote pointerup from element to window level so it fires
          // regardless of where the pointer is released.
          if (listeners.move) el.removeEventListener("pointermove", listeners.move);
          if (listeners.up) el.removeEventListener("pointerup", listeners.up);

          listeners.globalUp = () => {
            endDrag();
            cleanupAll();
          };
          window.addEventListener("pointerup", listeners.globalUp);
        }
      };

      listeners.up = () => {
        if (isDraggingRef.current) {
          endDrag();
        }
        releaseCapture();
        cleanupAll();
      };

      listeners.key = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          if (isDraggingRef.current) {
            endDrag();
          }
          releaseCapture();
          cleanupAll();
        }
      };

      el.addEventListener("pointermove", listeners.move);
      el.addEventListener("pointerup", listeners.up);
      document.addEventListener("keydown", listeners.key);
    },
    [disabled, state.isDragging, kind, startDrag, endDrag],
  );

  return { onPointerDown };
}
