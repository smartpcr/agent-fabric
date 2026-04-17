import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import type { Position } from "@/domain/models/node";

const FALLBACK_WIDTH = 800;
const FALLBACK_HEIGHT = 600;

/**
 * Returns a callback that computes the current flow-space center
 * of the visible viewport using `useReactFlow().getViewport()`.
 */
export function useViewportCenter(): () => Position {
  const reactFlow = useReactFlow();

  return useCallback(() => {
    const { x, y, zoom } = reactFlow.getViewport();

    // Try to get actual viewport DOM dimensions from the ReactFlow wrapper
    const wrapper = document.querySelector(".react-flow");
    const width = wrapper ? wrapper.clientWidth : FALLBACK_WIDTH;
    const height = wrapper ? wrapper.clientHeight : FALLBACK_HEIGHT;

    // Convert screen center to flow coordinates
    const centerX = (-x + width / 2) / zoom;
    const centerY = (-y + height / 2) / zoom;

    return { x: centerX, y: centerY };
  }, [reactFlow]);
}
