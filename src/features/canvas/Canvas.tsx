import { useCallback } from "react";
import { ReactFlow, Controls, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Background } from "@/features/canvas/Background";
import { useDragContext } from "@/features/palette/DragContext";
import { useWorkflowStore } from "@/store/hooks";

export function Canvas() {
  const { state: dragState, endDrag } = useDragContext();
  const addNode = useWorkflowStore((s) => s.addNode);
  const registry = useWorkflowStore((s) => s.registry);
  const { screenToFlowPosition } = useReactFlow();

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.isDragging || !dragState.payload) return;

      const kind = dragState.payload.kind;
      const spec = registry.get(kind);
      if (spec) {
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        addNode(spec, position);
      }
      endDrag();
    },
    [dragState, addNode, registry, endDrag, screenToFlowPosition],
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
        <Controls />
      </ReactFlow>
    </div>
  );
}
