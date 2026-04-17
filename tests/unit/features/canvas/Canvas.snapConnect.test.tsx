import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { ToastProvider } from "@/features/editor/Toast";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { MultiPortTaskNodeSpec } from "@/registry/builtins/MultiPortTaskNode.spec";
import { useWorkflowStore } from "@/store/hooks";
import * as snapModule from "@/features/canvas/snapToHandle";

// Capture callbacks passed to ReactFlow
let capturedOnConnect: ((connection: Record<string, unknown>) => void) | null = null;
let capturedOnConnectStart:
  | ((event: unknown, params: { nodeId: string | null; handleId: string | null }) => void)
  | null = null;
let capturedOnConnectEnd: (() => void) | null = null;

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    onConnect,
    onConnectStart,
    onConnectEnd,
  }: {
    children?: ReactNode;
    onConnect?: (connection: Record<string, unknown>) => void;
    onConnectStart?: (
      event: unknown,
      params: { nodeId: string | null; handleId: string | null },
    ) => void;
    onConnectEnd?: () => void;
  }) => {
    capturedOnConnect = onConnect ?? null;
    capturedOnConnectStart = onConnectStart ?? null;
    capturedOnConnectEnd = onConnectEnd ?? null;
    return <div data-testid="mock-reactflow">{children}</div>;
  },
  Controls: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-controls">{children}</div>
  ),
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
  }),
  SelectionMode: { Partial: "partial", Full: "full" },
  MiniMap: () => null,
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

vi.mock("@/features/canvas/Background", () => ({
  Background: () => <div data-testid="mock-background" />,
}));

afterEach(() => {
  cleanup();
  capturedOnConnect = null;
  capturedOnConnectStart = null;
  capturedOnConnectEnd = null;
  vi.restoreAllMocks();
});

function setupStoreWithMultiPort() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  registry.register(MultiPortTaskNodeSpec);

  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
    for (const node of result.current.nodes) {
      result.current.removeNode(node.id);
    }
  });
  unmount();
}

function addMultiPortNodes(): { sourceId: string; targetId: string } {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  let sourceId = "";
  let targetId = "";
  act(() => {
    const source = result.current.addNode(MultiPortTaskNodeSpec, { x: 0, y: 0 });
    const target = result.current.addNode(MultiPortTaskNodeSpec, { x: 200, y: 200 });
    sourceId = source.id;
    targetId = target.id;
  });
  unmount();
  return { sourceId, targetId };
}

function getStoreEdges() {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const edges = result.current.edges;
  unmount();
  return edges;
}

function renderCanvas() {
  return render(
    <ToastProvider>
      <DragProvider>
        <Canvas />
      </DragProvider>
    </ToastProvider>,
  );
}

describe("Canvas snap-to-handle during connect", () => {
  beforeEach(() => {
    setupStoreWithMultiPort();
  });

  it("passes onConnectStart and onConnectEnd to ReactFlow", () => {
    renderCanvas();
    expect(capturedOnConnectStart).toBeTypeOf("function");
    expect(capturedOnConnectEnd).toBeTypeOf("function");
  });

  it("calls findSnapTarget during handleConnect when source is tracked", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    const findSnapSpy = vi.spyOn(snapModule, "findSnapTarget");

    // Mock getHandlePositions to return known handles
    vi.spyOn(snapModule, "getHandlePositions").mockReturnValue([
      { nodeId: targetId, portId: "inA", x: 10, y: 10 },
    ]);

    renderCanvas();

    // Simulate connect start
    act(() => {
      capturedOnConnectStart?.(new MouseEvent("mousedown"), {
        nodeId: sourceId,
        handleId: "outA",
      });
    });

    // Simulate pointer move to set last position
    const canvas = document.querySelector("[role='application']") as HTMLElement;
    act(() => {
      canvas.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 12, clientY: 12, bubbles: true }),
      );
    });

    // Simulate connect
    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outA",
        target: targetId,
        targetHandle: "inA",
      });
    });

    expect(findSnapSpy).toHaveBeenCalled();
    // Verify a connection was made
    expect(getStoreEdges()).toHaveLength(1);
  });

  it("overrides target when findSnapTarget returns a different port", () => {
    const { sourceId, targetId } = addMultiPortNodes();

    // findSnapTarget returns inA even though xyflow gave us inB
    vi.spyOn(snapModule, "findSnapTarget").mockReturnValue({
      nodeId: targetId,
      portId: "inA",
      distance: 5,
    });
    vi.spyOn(snapModule, "getHandlePositions").mockReturnValue([]);

    renderCanvas();

    // Start connect drag
    act(() => {
      capturedOnConnectStart?.(new MouseEvent("mousedown"), {
        nodeId: sourceId,
        handleId: "outA",
      });
    });

    // Connect with wrong target port — snap should override to inA
    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outA",
        target: targetId,
        targetHandle: "inB", // json port — incompatible with string, but snap overrides
      });
    });

    const edges = getStoreEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0]?.targetPort).toBe("inA"); // snap overrode to inA
  });

  it("does not snap when findSnapTarget returns null (> 20px)", () => {
    const { sourceId, targetId } = addMultiPortNodes();

    // No snap target found — too far away
    vi.spyOn(snapModule, "findSnapTarget").mockReturnValue(null);
    vi.spyOn(snapModule, "getHandlePositions").mockReturnValue([]);

    renderCanvas();

    act(() => {
      capturedOnConnectStart?.(new MouseEvent("mousedown"), {
        nodeId: sourceId,
        handleId: "outA",
      });
    });

    // Original connection with compatible port — should use it as-is
    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outA",
        target: targetId,
        targetHandle: "inA",
      });
    });

    const edges = getStoreEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0]?.targetPort).toBe("inA");
  });

  it("clears connect source on onConnectEnd", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    const findSnapSpy = vi.spyOn(snapModule, "findSnapTarget");
    vi.spyOn(snapModule, "getHandlePositions").mockReturnValue([]);

    renderCanvas();

    // Start and immediately end without connecting
    act(() => {
      capturedOnConnectStart?.(new MouseEvent("mousedown"), {
        nodeId: sourceId,
        handleId: "outA",
      });
    });

    act(() => {
      capturedOnConnectEnd?.();
    });

    // Now connect — since source was cleared, findSnapTarget should NOT be called
    findSnapSpy.mockClear();
    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outA",
        target: targetId,
        targetHandle: "inA",
      });
    });

    expect(findSnapSpy).not.toHaveBeenCalled();
    // Connection still works with the raw values
    expect(getStoreEdges()).toHaveLength(1);
  });
});
