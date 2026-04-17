import { useCallback } from "react";
import { ReactFlow, Controls, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Grid3X3 } from "lucide-react";
import { Background } from "@/features/canvas/Background";
import { snapToGrid } from "@/features/canvas/SnapGrid";
import { useDragContext } from "@/features/palette/DragContext";
import { useWorkflowStore } from "@/store/hooks";

export function Canvas() {
  const { state: dragState, endDrag } = useDragContext();
  const addNode = useWorkflowStore((s) => s.addNode);
  const registry = useWorkflowStore((s) => s.registry);
  const snapEnabled = useWorkflowStore((s) => s.snapEnabled);
  const snapGridSize = useWorkflowStore((s) => s.snapGridSize);
  const toggleSnap = useWorkflowStore((s) => s.toggleSnap);
  const { screenToFlowPosition } = useReactFlow();

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.isDragging || !dragState.payload) return;

      const kind = dragState.payload.kind;
      const spec = registry.get(kind);
      if (spec) {
        let position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        if (snapEnabled) {
          position = snapToGrid(position, snapGridSize);
        }
        addNode(spec, position);
      }
      endDrag();
    },
    [dragState, addNode, registry, endDrag, screenToFlowPosition, snapEnabled, snapGridSize],
  );

  return (
    <div
      role="application"
      aria-label="Workflow Canvas"
      style={{ width: "100%", height: "100%" }}
      onPointerUp={handlePointerUp}
    >
      <ReactFlow nodes={[]} edges={[]}>
        <Background />
        <Controls>
          <button
            type="button"
            data-testid="snap-toggle"
            aria-label={snapEnabled ? "Disable snap to grid" : "Enable snap to grid"}
            aria-pressed={snapEnabled}
            onClick={toggleSnap}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "4px",
              background: snapEnabled ? "rgba(59, 130, 246, 0.15)" : "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Grid3X3 size={14} aria-hidden="true" />
          </button>
        </Controls>
      </ReactFlow>
    </div>
  );
}
