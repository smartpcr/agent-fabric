import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { ToastProvider } from "@/features/editor/Toast";
import { DragProvider, useDragContext } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

// Viewport with pan and zoom for coordinate conversion
const MOCK_VIEWPORT = { x: 100, y: 200, zoom: 2 };

// screenToFlowPosition converts screen coords to flow coords:
// flowX = (screenX - viewport.x) / zoom
// flowY = (screenY - viewport.y) / zoom
const mockScreenToFlowPosition = ({ x, y }: { x: number; y: number }) => ({
  x: (x - MOCK_VIEWPORT.x) / MOCK_VIEWPORT.zoom,
  y: (y - MOCK_VIEWPORT.y) / MOCK_VIEWPORT.zoom,
});

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-reactflow">{children}</div>
  ),
  Controls: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-controls">{children}</div>
  ),
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    getViewport: () => MOCK_VIEWPORT,
    screenToFlowPosition: mockScreenToFlowPosition,
  }),
  SelectionMode: { Partial: "partial", Full: "full" },
  MiniMap: () => null,
}));

vi.mock("@/features/canvas/Background", () => ({
  Background: () => <div data-testid="mock-background" />,
}));

afterEach(() => {
  cleanup();
});

function setupStore() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
    for (const node of result.current.nodes) {
      result.current.removeNode(node.id);
    }
  });
  unmount();
}

function getStoreNodes() {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const nodes = result.current.nodes;
  unmount();
  return nodes;
}

function DragStarter({ kind }: { readonly kind: string }) {
  const { startDrag } = useDragContext();
  return (
    <button
      data-testid="start-drag"
      onClick={() => {
        startDrag({ kind });
      }}
    >
      Start Drag
    </button>
  );
}

function renderCanvasWithDrag(kind = "task") {
  return render(
    <ToastProvider>
      <DragProvider>
        <DragStarter kind={kind} />
        <Canvas />
      </DragProvider>
    </ToastProvider>,
  );
}

describe("Canvas coordinate conversion", () => {
  beforeEach(() => {
    setupStore();
  });

  it("converts client (300, 400) to flow coords (100, 100) with viewport {x:100, y:200, zoom:2}", () => {
    renderCanvasWithDrag("task");

    fireEvent.click(screen.getByTestId("start-drag"));

    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 300, clientY: 400 });

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);

    // Expected: flowX = (300 - 100) / 2 = 100, flowY = (400 - 200) / 2 = 100
    expect(Math.abs(nodes[0].position.x - 100)).toBeLessThanOrEqual(1);
    expect(Math.abs(nodes[0].position.y - 100)).toBeLessThanOrEqual(1);
  });

  it("handles zoom correctly for different drop positions", () => {
    renderCanvasWithDrag("task");

    fireEvent.click(screen.getByTestId("start-drag"));

    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 500, clientY: 600 });

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);

    // flowX = (500 - 100) / 2 = 200, flowY = (600 - 200) / 2 = 200
    expect(Math.abs(nodes[0].position.x - 200)).toBeLessThanOrEqual(1);
    expect(Math.abs(nodes[0].position.y - 200)).toBeLessThanOrEqual(1);
  });

  it("handles pan offset with zero-origin drop", () => {
    renderCanvasWithDrag("task");

    fireEvent.click(screen.getByTestId("start-drag"));

    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 100, clientY: 200 });

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);

    // flowX = (100 - 100) / 2 = 0, flowY = (200 - 200) / 2 = 0
    expect(Math.abs(nodes[0].position.x - 0)).toBeLessThanOrEqual(1);
    expect(Math.abs(nodes[0].position.y - 0)).toBeLessThanOrEqual(1);
  });

  it("passes client coordinates through screenToFlowPosition, not raw", () => {
    renderCanvasWithDrag("task");

    fireEvent.click(screen.getByTestId("start-drag"));

    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 300, clientY: 400 });

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);

    // If raw clientX/clientY were used, position would be {x:300, y:400}
    // With conversion it should be {x:100, y:100}
    expect(nodes[0].position).not.toEqual({ x: 300, y: 400 });
    expect(nodes[0].position).toEqual({ x: 100, y: 100 });
  });
});
