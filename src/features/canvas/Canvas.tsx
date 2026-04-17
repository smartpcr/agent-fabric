import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  useReactFlow,
  SelectionMode,
  type NodeMouseHandler,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Grid3X3 } from "lucide-react";
import { Background } from "@/features/canvas/Background";
import { CanvasControls } from "@/features/canvas/Controls";
import { MiniMap } from "@/features/canvas/MiniMap";
import { nodeTypes } from "@/features/canvas/nodeTypes";
import { snapToGrid } from "@/features/canvas/SnapGrid";
import { useViewportPersistence } from "@/features/canvas/useViewportPersistence";
import { validateConnection } from "@/domain/validation/connectionRules";
import { CURRENT_SCHEMA_VERSION } from "@/domain/models/graph";
import { useDragContext } from "@/features/palette/DragContext";
import { useToast } from "@/hooks/useToast";
import { useWorkflowStore } from "@/store/hooks";
import type { SelectMode } from "@/store/slices/selectionSlice";

export function Canvas() {
  useViewportPersistence();
  const { state: dragState, endDrag } = useDragContext();
  const { show: showToast } = useToast();
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
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const setZoom = useWorkflowStore((s) => s.setZoom);
  const setPan = useWorkflowStore((s) => s.setPan);
  const interactive = useWorkflowStore((s) => s.interactive);
  const toggleInteractive = useWorkflowStore((s) => s.toggleInteractive);
  const tryConnect = useWorkflowStore((s) => s.tryConnect);
  const { screenToFlowPosition, getViewport, zoomIn, zoomOut, fitView } = useReactFlow();

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        clearSelection();
      } else if (e.key === "+" || e.key === "=") {
        void zoomIn();
      } else if (e.key === "-") {
        void zoomOut();
      } else if (e.key === "f") {
        void fitView();
      } else if (e.key === "l") {
        toggleInteractive();
      }
    },
    [deleteSelected, clearSelection, zoomIn, zoomOut, fitView, toggleInteractive],
  );

  const handleMoveEnd = useCallback(() => {
    const vp = getViewport();
    setZoom(vp.zoom);
    setPan(vp.x, vp.y);
  }, [getViewport, setZoom, setPan]);

  // When an xyflow node wrapper receives focus (e.g. via Tab), select it in our store
  const handleFocusCapture = useCallback(
    (e: React.FocusEvent) => {
      const target = e.target as HTMLElement;
      const nodeWrapper = target.closest<HTMLElement>(".react-flow__node[data-id]");
      if (nodeWrapper) {
        const nodeId = nodeWrapper.getAttribute("data-id");
        if (nodeId) {
          selectAction(nodeId, "replace");
        }
      }
    },
    [selectAction],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const result = tryConnect({
        source: connection.source,
        sourcePort: connection.sourceHandle ?? "out",
        target: connection.target,
        targetPort: connection.targetHandle ?? "in",
      });
      if (!result.ok) {
        showToast({
          title: "Connection rejected",
          description: result.error.message,
          variant: "error",
        });
      }
    },
    [tryConnect, showToast],
  );

  const isValidConnection = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return false;
      const graph = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        id: "store",
        name: "store",
        nodes,
        edges,
      };
      const result = validateConnection(
        graph,
        { nodeId: connection.source, portId: connection.sourceHandle ?? "out" },
        { nodeId: connection.target, portId: connection.targetHandle ?? "in" },
        registry,
      );
      return result.ok;
    },
    [nodes, edges, registry],
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- role="application" is interactive per WAI-ARIA
    <div
      role="application"
      aria-label="Workflow Canvas"
      style={{ width: "100%", height: "100%" }}
      tabIndex={-1}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      onFocusCapture={handleFocusCapture}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        selectionMode={SelectionMode.Partial}
        panOnScroll
        zoomOnPinch
        minZoom={0.1}
        maxZoom={4}
        nodesDraggable={interactive}
        nodesConnectable={interactive}
        elementsSelectable={interactive}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onSelectionChange={handleSelectionChange}
        onMoveEnd={handleMoveEnd}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
      >
        <Background />
        <MiniMap />
        <Controls>
          <CanvasControls />
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
