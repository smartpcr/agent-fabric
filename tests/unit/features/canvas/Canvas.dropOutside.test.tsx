import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { DragProvider, useDragContext } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-reactflow">{children}</div>
  ),
  Controls: () => <div data-testid="mock-controls" />,
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
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

function DragStatus() {
  const { state } = useDragContext();
  return <span data-testid="drag-status">{String(state.isDragging)}</span>;
}

function renderEditorLikeLayout(kind = "task") {
  return render(
    <DragProvider>
      {/* Palette area — outside canvas */}
      <div data-testid="palette-area">
        <DragStarter kind={kind} />
      </div>
      <DragStatus />
      {/* Canvas area */}
      <Canvas />
    </DragProvider>,
  );
}

describe("Canvas.dropOutside", () => {
  beforeEach(() => {
    setupStore();
  });

  it("does not dispatch addNode when pointer releases on palette (outside canvas)", () => {
    renderEditorLikeLayout("task");

    // Start drag
    fireEvent.click(screen.getByTestId("start-drag"));
    expect(screen.getByTestId("drag-status").textContent).toBe("true");

    // Release pointer on the palette area (outside canvas)
    const paletteArea = screen.getByTestId("palette-area");
    act(() => {
      fireEvent.pointerUp(paletteArea, { clientX: 50, clientY: 50 });
    });

    // No node should be added
    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(0);
  });

  it("clears DragContext when pointer releases outside canvas", () => {
    renderEditorLikeLayout("task");

    // Start drag
    fireEvent.click(screen.getByTestId("start-drag"));
    expect(screen.getByTestId("drag-status").textContent).toBe("true");

    // Release pointer outside canvas (on palette area)
    const paletteArea = screen.getByTestId("palette-area");
    act(() => {
      fireEvent.pointerUp(paletteArea, { clientX: 50, clientY: 50 });
    });

    // Drag state should be cleared
    expect(screen.getByTestId("drag-status").textContent).toBe("false");
  });

  it("still adds node when pointer releases on canvas", () => {
    renderEditorLikeLayout("task");

    // Start drag
    fireEvent.click(screen.getByTestId("start-drag"));

    // Release pointer on the canvas
    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 300 });

    // Node should be added
    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe("task");
  });

  it("clears DragContext after successful canvas drop too", () => {
    renderEditorLikeLayout("task");

    fireEvent.click(screen.getByTestId("start-drag"));
    expect(screen.getByTestId("drag-status").textContent).toBe("true");

    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 300 });

    expect(screen.getByTestId("drag-status").textContent).toBe("false");
  });

  it("does not add node on global window pointerup when dragging", () => {
    renderEditorLikeLayout("task");

    fireEvent.click(screen.getByTestId("start-drag"));

    // Release pointer on the window itself (not on any specific element)
    act(() => {
      fireEvent(
        window,
        new PointerEvent("pointerup", { clientX: 999, clientY: 999, bubbles: true }),
      );
    });

    // No node should be added
    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(0);

    // But drag should be cleared
    expect(screen.getByTestId("drag-status").textContent).toBe("false");
  });
});
