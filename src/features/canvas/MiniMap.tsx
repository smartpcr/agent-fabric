import { MiniMap as XYMiniMap, useReactFlow } from "@xyflow/react";
import { useCallback } from "react";
import { useWorkflowStore } from "@/store/hooks";

const NODE_COLORS: Record<string, string> = {
  start: "#22c55e",
  end: "#ef4444",
  task: "#3b82f6",
};

const DEFAULT_COLOR = "#94a3b8";

function nodeColor(node: { type?: string }): string {
  return NODE_COLORS[node.type ?? ""] ?? DEFAULT_COLOR;
}

export function MiniMap() {
  const setZoom = useWorkflowStore((s) => s.setZoom);
  const setPan = useWorkflowStore((s) => s.setPan);
  const { setViewport } = useReactFlow();

  const handleClick = useCallback(
    (_event: React.MouseEvent, position: { x: number; y: number }) => {
      const newViewport = { x: -position.x, y: -position.y, zoom: 1 };
      void setViewport(newViewport);
      setZoom(newViewport.zoom);
      setPan(newViewport.x, newViewport.y);
    },
    [setViewport, setZoom, setPan],
  );

  return (
    <XYMiniMap
      data-testid="mini-map"
      nodeColor={nodeColor}
      pannable
      zoomable
      onClick={handleClick}
      aria-label="Mini map"
    />
  );
}
