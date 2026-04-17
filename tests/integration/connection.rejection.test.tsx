import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { ToastProvider } from "@/features/editor/Toast";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { MultiPortTaskNodeSpec } from "@/registry/builtins/MultiPortTaskNode.spec";
import { useWorkflowStore } from "@/store/hooks";

// Capture the onConnect handler passed to ReactFlow
let capturedOnConnect: ((connection: Record<string, unknown>) => void) | null = null;

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    onConnect,
  }: {
    children?: ReactNode;
    onConnect?: (connection: Record<string, unknown>) => void;
  }) => {
    capturedOnConnect = onConnect ?? null;
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

function renderCanvasWithToast() {
  return render(
    <ToastProvider>
      <DragProvider>
        <Canvas />
      </DragProvider>
    </ToastProvider>,
  );
}

describe("Connection rejection toast", () => {
  beforeEach(() => {
    setupStoreWithMultiPort();
  });

  it("shows toast with rejection message on incompatible data-type drop", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvasWithToast();

    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outA", // string
        target: targetId,
        targetHandle: "inB", // json
      });
    });

    // Toast title
    expect(screen.getByText("Connection rejected")).toBeTruthy();
    // Toast description contains the data-type mismatch message
    expect(screen.getByText(/Cannot assign "string" to "json"/)).toBeTruthy();
  });

  it("shows toast with cardinality message when port already connected", () => {
    const { sourceId, targetId } = addMultiPortNodes();

    // Pre-connect outA → inA
    const { result: storeResult, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      storeResult.current.tryConnect({
        source: sourceId,
        sourcePort: "outA",
        target: targetId,
        targetPort: "inA",
      });
    });
    unmount();

    renderCanvasWithToast();

    // Try a second connection to inA (single cardinality)
    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outC", // any — type compatible
        target: targetId,
        targetHandle: "inA",
      });
    });

    expect(screen.getByText("Connection rejected")).toBeTruthy();
    expect(screen.getByText(/cardinality/i)).toBeTruthy();
  });

  it("does NOT show toast when connection is valid", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvasWithToast();

    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outA", // string
        target: targetId,
        targetHandle: "inA", // string
      });
    });

    expect(screen.queryByText("Connection rejected")).toBeNull();
  });

  it("toast contains error variant", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvasWithToast();

    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outA",
        target: targetId,
        targetHandle: "inB",
      });
    });

    // The toast root element should have data-variant="error"
    const toastEl = screen.getByText("Connection rejected").closest("[data-variant]");
    expect(toastEl?.getAttribute("data-variant")).toBe("error");
  });

  it("no toast when source or target is null", () => {
    addMultiPortNodes();
    renderCanvasWithToast();

    act(() => {
      capturedOnConnect?.({
        source: null,
        sourceHandle: "outA",
        target: "some-id",
        targetHandle: "inA",
      });
    });

    expect(screen.queryByText("Connection rejected")).toBeNull();
  });
});
