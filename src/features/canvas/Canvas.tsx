import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Controls,
  useReactFlow,
  SelectionMode,
  type NodeMouseHandler,
  type NodeChange as RFNodeChange,
  type EdgeChange as RFEdgeChange,
  type Connection,
  type FinalConnectionState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Grid3X3 } from "lucide-react";
import { Background } from "@/features/canvas/Background";
import { CanvasControls } from "@/features/canvas/Controls";
import { KeyboardConnectContext } from "@/features/canvas/KeyboardConnectContext";
import { MiniMap } from "@/features/canvas/MiniMap";
import { nodeTypes } from "@/features/canvas/nodeTypes";
import { edgeTypes } from "@/features/canvas/edgeTypes";
import { snapToGrid } from "@/features/canvas/SnapGrid";
import { findSnapTarget, getHandlePositions } from "@/features/canvas/snapToHandle";
import { useKeyboardConnect } from "@/features/canvas/useKeyboardConnect";
import { useViewportPersistence } from "@/features/canvas/useViewportPersistence";
import { validateConnection } from "@/domain/validation/connectionRules";
import { CURRENT_SCHEMA_VERSION } from "@/domain/models/graph";
import { useDragContext } from "@/features/palette/DragContext";
import { useAnnounce } from "@/hooks/useAnnounce";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "react-i18next";
import { parseImportedJson } from "@/features/persistence/ImportExport";
import { useWorkflowStore } from "@/store/hooks";
import type { WorkflowNode } from "@/domain/models/node";
import type { WorkflowEdge } from "@/domain/models/edge";
import type { SelectMode } from "@/store/slices/selectionSlice";

interface ConnectDragSource {
  nodeId: string;
  portId: string;
}

export function Canvas() {
  useViewportPersistence();
  const { t } = useTranslation();
  const { state: dragState, endDrag } = useDragContext();
  const { show: showToast } = useToast();
  const { announce } = useAnnounce();
  const addNode = useWorkflowStore((s) => s.addNode);
  const registry = useWorkflowStore((s) => s.registry);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const snapEnabled = useWorkflowStore((s) => s.snapEnabled);
  const snapGridSize = useWorkflowStore((s) => s.snapGridSize);
  const toggleSnap = useWorkflowStore((s) => s.toggleSnap);
  const selectAction = useWorkflowStore((s) => s.select);
  const selectEdge = useWorkflowStore((s) => s.selectEdge);
  const selectMany = useWorkflowStore((s) => s.selectMany);
  const clearSelection = useWorkflowStore((s) => s.clear);
  const clearEdges = useWorkflowStore((s) => s.clearEdges);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const setZoom = useWorkflowStore((s) => s.setZoom);
  const setPan = useWorkflowStore((s) => s.setPan);
  const interactive = useWorkflowStore((s) => s.interactive);
  const toggleInteractive = useWorkflowStore((s) => s.toggleInteractive);
  const tryConnect = useWorkflowStore((s) => s.tryConnect);
  const restoreGraph = useWorkflowStore((s) => s.restoreGraph);
  const applyNodeChanges = useWorkflowStore((s) => s.applyNodeChanges);
  const _applyEdgeChanges = useWorkflowStore((s) => s.applyEdgeChanges);
  const { screenToFlowPosition, getViewport, zoomIn, zoomOut, fitView } = useReactFlow();

  // Track connect-drag source for snap override
  const connectDragSourceRef = useRef<ConnectDragSource | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const {
    connectState,
    enterConnectMode,
    cancel: cancelConnect,
    moveNext,
    movePrev,
    confirm: confirmConnect,
  } = useKeyboardConnect(nodes, edges, registry, tryConnect);

  // Focus the target handle element when keyboard-connect navigation changes
  useEffect(() => {
    if (!connectState.active || connectState.currentIndex < 0) return;
    const target = connectState.targets[connectState.currentIndex];
    if (!target) return;
    const nodeEl = canvasRef.current?.querySelector<HTMLElement>(`[data-id="${target.nodeId}"]`);
    const handleEl = nodeEl?.querySelector<HTMLElement>(`[data-handleid="${target.portId}"]`);
    handleEl?.focus();
  }, [connectState.active, connectState.currentIndex, connectState.targets]);

  // Mirror keyboard-connect announcements into the polite app-root live region
  useEffect(() => {
    if (connectState.announcement) {
      announce(connectState.announcement);
    }
  }, [connectState.announcement, announce]);

  // Map WorkflowNode (kind) → xyflow Node (type) so nodeTypes resolution works
  const rfNodes = useMemo(() => nodes.map((n) => ({ ...n, type: n.kind })), [nodes]);

  // Forward position changes to allow node dragging. Dimensions are tracked
  // internally by ReactFlow (do NOT forward them — re-setting width/height on
  // controlled nodes causes ReactFlow to treat them as fixed-size, which
  // interferes with internal handle-bounds measurement).
  // Selection and removal are handled by our own handlers.
  const handleNodesChange = useCallback(
    (changes: RFNodeChange[]) => {
      const mapped: Parameters<typeof applyNodeChanges>[0] = [];
      for (const c of changes) {
        if (c.type === "position" && c.position) {
          mapped.push({ type: "position", id: c.id, position: c.position });
        }
      }
      if (mapped.length > 0) {
        applyNodeChanges(mapped);
      }
    },
    [applyNodeChanges],
  );

  const handleEdgesChange = useCallback((_changes: RFEdgeChange[]) => {
    // Edge selection and removal are handled by handleEdgeClick and deleteSelected.
  }, []);

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

  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: { id: string }) => {
      let mode: SelectMode = "replace";
      if (event.shiftKey) {
        mode = "add";
      } else if (event.ctrlKey || event.metaKey) {
        mode = "toggle";
      }
      selectEdge(edge.id, mode);
    },
    [selectEdge],
  );

  const handlePaneClick = useCallback(() => {
    clearSelection();
    clearEdges();
  }, [clearSelection, clearEdges]);

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Array<{ id: string }> }) => {
      selectMany(selectedNodes.map((n) => n.id));
    },
    [selectMany],
  );

  const handleConnectModeKey = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!connectState.active) return false;
      if (e.key === "Escape") {
        e.preventDefault();
        cancelConnect();
      } else if (e.key === "Enter") {
        e.preventDefault();
        confirmConnect();
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        moveNext();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        movePrev();
      }
      return true;
    },
    [connectState.active, cancelConnect, confirmConnect, moveNext, movePrev],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (handleConnectModeKey(e)) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        clearSelection();
      } else if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        if (
          target.classList.contains("react-flow__handle") &&
          target.dataset.handletype !== "target"
        ) {
          const nodeWrapper = target.closest<HTMLElement>("[data-id]");
          const nodeId = nodeWrapper?.getAttribute("data-id");
          const portId = target.dataset.handleid;
          if (nodeId && portId) {
            e.preventDefault();
            enterConnectMode(nodeId, portId);
          }
        }
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
    [
      handleConnectModeKey,
      deleteSelected,
      clearSelection,
      zoomIn,
      zoomOut,
      fitView,
      toggleInteractive,
      enterConnectMode,
    ],
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

      const source = connectDragSourceRef.current;
      let targetNodeId = connection.target;
      let targetPortId = connection.targetHandle ?? "in";

      // Attempt snap override: use findSnapTarget with last pointer position
      if (source) {
        const graph = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          id: "store",
          name: "store",
          nodes,
          edges,
        };
        const handles = getHandlePositions(canvasRef.current);
        const snap = findSnapTarget(
          lastPointerRef.current,
          source.nodeId,
          source.portId,
          handles,
          graph,
          registry,
        );
        if (snap) {
          targetNodeId = snap.nodeId;
          targetPortId = snap.portId;
        }
      }

      const result = tryConnect({
        source: connection.source,
        sourcePort: connection.sourceHandle ?? "out",
        target: targetNodeId,
        targetPort: targetPortId,
      });
      if (result.ok) {
        announce(t("canvas.connectionCreated"));
      } else {
        announce(t("canvas.connectionRejectedReason", { reason: result.error.message }));
        showToast({
          title: t("canvas.connectionRejected"),
          description: result.error.message,
          variant: "error",
        });
      }
    },
    [tryConnect, showToast, announce, nodes, edges, registry, t],
  );

  const handleConnectStart = useCallback(
    (
      _event: React.MouseEvent | React.TouchEvent,
      params: { nodeId: string | null; handleId: string | null },
    ) => {
      if (params.nodeId && params.handleId) {
        connectDragSourceRef.current = { nodeId: params.nodeId, portId: params.handleId };
      }
    },
    [],
  );

  const handleConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, state?: FinalConnectionState) => {
      const source = connectDragSourceRef.current;
      connectDragSourceRef.current = null;

      // Show rejection toast when connection was attempted on a handle but validation failed
      if (source && state && state.isValid === false && state.toHandle) {
        const graph = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          id: "store",
          name: "store",
          nodes,
          edges,
        };
        const result = validateConnection(
          graph,
          { nodeId: source.nodeId, portId: source.portId },
          { nodeId: state.toHandle.nodeId, portId: state.toHandle.id ?? "in" },
          registry,
        );
        if (!result.ok) {
          announce(t("canvas.connectionRejectedReason", { reason: result.error.message }));
          showToast({
            title: t("canvas.connectionRejected"),
            description: result.error.message,
            variant: "error",
          });
        }
      }
    },
    [nodes, edges, registry, showToast, announce, t],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  // ─── File drop handlers ──────────────────────────────────────────

  const hasJsonFile = (dt: DataTransfer): boolean =>
    Array.from(dt.items).some(
      (item) => item.kind === "file" && (item.type === "application/json" || item.type === ""),
    );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!hasJsonFile(e.dataTransfer)) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setFileDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!hasJsonFile(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setFileDragOver(false);
    }
  }, []);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setFileDragOver(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const result = parseImportedJson(text);

        if (!result.ok) {
          showToast({
            title: t("persistence.importFailed"),
            description: result.message,
            variant: "error",
          });
          return;
        }

        // eslint-disable-next-line no-alert -- intentional confirmation dialog
        const proceed = window.confirm(
          t("persistence.importConfirm", { name: result.graph.name }),
        );
        if (!proceed) return;

        restoreGraph(result.graph.nodes as WorkflowNode[], result.graph.edges as WorkflowEdge[]);
      };
      reader.readAsText(file);
    },
    [showToast, restoreGraph, t],
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
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- role="application" is interactive per WAI-ARIA */
    <div
      ref={canvasRef}
      role="application"
      aria-label={t("canvas.ariaLabel")}
      style={{ width: "100%", height: "100%", position: "relative" }}
      tabIndex={0}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
      onFocusCapture={handleFocusCapture}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
    >
      <KeyboardConnectContext.Provider value={enterConnectMode}>
        <ReactFlow
          nodes={rfNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          selectionMode={SelectionMode.Partial}
          panOnScroll
          zoomOnPinch
          minZoom={0.1}
          maxZoom={4}
          nodesDraggable={interactive}
          nodesConnectable={interactive}
          elementsSelectable={interactive}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onSelectionChange={handleSelectionChange}
          onMoveEnd={handleMoveEnd}
          onConnect={handleConnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          isValidConnection={isValidConnection}
          connectionRadius={20}
        >
          <Background />
          <MiniMap />
          <Controls>
            <CanvasControls />
            <button
              type="button"
              data-testid="snap-toggle"
              aria-label={snapEnabled ? t("toolbar.disableSnap") : t("toolbar.enableSnap")}
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
      </KeyboardConnectContext.Provider>
      <div
        aria-live="assertive"
        role="status"
        data-testid="connect-announcement"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
        }}
      >
        {connectState.announcement}
      </div>
      {fileDragOver && (
        <div
          data-testid="file-drop-overlay"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(59, 130, 246, 0.12)",
            border: "2px dashed rgba(59, 130, 246, 0.6)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 50,
            fontSize: 16,
            fontWeight: 500,
            color: "rgb(59, 130, 246)",
          }}
        >
          {t("canvas.dropToImport")}
        </div>
      )}
    </div>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
}
