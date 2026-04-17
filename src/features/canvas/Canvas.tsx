import { useCallback, useMemo } from "react";
import { ReactFlow, Controls, useReactFlow, type NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Grid3X3 } from "lucide-react";
import { Background } from "@/features/canvas/Background";
import { nodeTypes } from "@/features/canvas/nodeTypes";
import { snapToGrid } from "@/features/canvas/SnapGrid";
import { useDragContext } from "@/features/palette/DragContext";
import { useWorkflowStore } from "@/store/hooks";
import type { SelectMode } from "@/store/slices/selectionSlice";

export function Canvas() {
  const { state: dragState, endDrag } = useDragContext();
  const addNode = useWorkflowStore((s) => s.addNode);
  const registry = useWorkflowStore((s) => s.registry);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const snapEnabled = useWorkflowStore((s) => s.snapEnabled);
  const snapGridSize = useWorkflowStore((s) => s.snapGridSize);
  const toggleSnap = useWorkflowStore((s) => s.toggleSnap);
  const selectAction = useWorkflowStore((s) => s.select);
  const selectMany = useWorkflowStore((s) => s.selectMany);
  const clearSelection = useWorkflowStore((s) => s.clear);
  const { screenToFlowPosition } = useReactFlow();

  // Map WorkflowNode (kind) → xyflow Node (type) so nodeTypes resolution works
  const rfNodes = useMemo(() => nodes.map((n) => ({ ...n, type: n.kind })), [nodes]);

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

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      let mode: SelectMode = "replace";
      if (event.shiftKey) {
        mode = "add";
      } else if (event.ctrlKey || event.metaKey) {
        mode = "toggle";
      }
      selectAction(node.id, mode);
    },
    [selectAction],
  );

  const handlePaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Array<{ id: string }> }) => {
      selectMany(selectedNodes.map((n) => n.id));
    },
    [selectMany],
  );

  return (
    <div
      role="application"
      aria-label="Workflow Canvas"
      style={{ width: "100%", height: "100%" }}
      onPointerUp={handlePointerUp}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onSelectionChange={handleSelectionChange}
      >
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
