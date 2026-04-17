import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { DragProvider, useDragContext } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

// Mock @xyflow/react so Canvas renders without a real ReactFlow provider
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-reactflow">{children}</div>
  ),
  Controls: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-controls">{children}</div>
  ),
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
}));

// Mock the Background component
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

/** Helper to start a drag before rendering Canvas */
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

/** Helper to read drag state */
function DragStatus() {
  const { state } = useDragContext();
  return <span data-testid="drag-status">{String(state.isDragging)}</span>;
}

function renderCanvasWithDrag(kind = "task") {
  return render(
    <DragProvider>
      <DragStarter kind={kind} />
      <DragStatus />
      <Canvas />
    </DragProvider>,
  );
}

describe("Canvas.onDrop", () => {
  beforeEach(() => {
    setupStore();
  });

  it("fires addNode when pointer up with active drag payload", () => {
    renderCanvasWithDrag("task");

    // Start the drag
    fireEvent.click(screen.getByTestId("start-drag"));
    expect(screen.getByTestId("drag-status").textContent).toBe("true");

    // Simulate pointer up on the canvas
    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 300 });

    // Node should be added
    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe("task");
    expect(nodes[0].position).toEqual({ x: 200, y: 300 });
  });

  it("clears drag state after drop", () => {
    renderCanvasWithDrag("task");

    fireEvent.click(screen.getByTestId("start-drag"));
    expect(screen.getByTestId("drag-status").textContent).toBe("true");

    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 100, clientY: 100 });

    // Drag should be cleared
    expect(screen.getByTestId("drag-status").textContent).toBe("false");
  });

  it("does not fire addNode when no drag is active", () => {
    renderCanvasWithDrag("task");

    // Don't start any drag — pointer up should be a no-op
    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 300 });

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(0);
  });

  it("does not fire addNode when kind is not in registry", () => {
    renderCanvasWithDrag("nonexistent-kind");

    fireEvent.click(screen.getByTestId("start-drag"));
    expect(screen.getByTestId("drag-status").textContent).toBe("true");

    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 300 });

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(0);

    // Drag should still be cleared even on unrecognized kind
    expect(screen.getByTestId("drag-status").textContent).toBe("false");
  });

  it("uses client coordinates as drop position", () => {
    renderCanvasWithDrag("start");

    fireEvent.click(screen.getByTestId("start-drag"));

    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 500, clientY: 750 });

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].position).toEqual({ x: 500, y: 750 });
  });

  it("supports multiple sequential drops", () => {
    renderCanvasWithDrag("task");

    // First drop
    fireEvent.click(screen.getByTestId("start-drag"));
    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 100, clientY: 100 });

    // Second drop
    fireEvent.click(screen.getByTestId("start-drag"));
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 200 });

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(2);
    expect(nodes[0].position).toEqual({ x: 100, y: 100 });
    expect(nodes[1].position).toEqual({ x: 200, y: 200 });
  });

  it("renders the canvas with application role", () => {
    renderCanvasWithDrag();
    expect(screen.getByRole("application", { name: /workflow canvas/i })).toBeInTheDocument();
  });
});
