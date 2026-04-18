import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { ToastProvider } from "@/features/editor/Toast";
import { DragProvider, useDragContext } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore, useTemporalStore } from "@/store/hooks";
import { HISTORY_GROUP_DELAY } from "@/store/historyGroup";

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
  const { result: temporal, unmount: unmountTemporal } = renderHook(() => useTemporalStore());
  act(() => {
    result.current.setRegistry(registry);
    for (const node of result.current.nodes) {
      result.current.removeNode(node.id);
    }
    temporal.current.clear();
  });
  unmount();
  unmountTemporal();
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

describe("Canvas drop → undo → node gone", () => {
  function flush(): void {
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    setupStore();
    // Drain any stale debounce from setupStore and re-clear history
    act(() => {
      vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);
    });
    const { result: t, unmount: u } = renderHook(() => useTemporalStore());
    act(() => {
      t.current.clear();
    });
    u();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("undo removes a node created via drop", () => {
    renderCanvasWithDrag("task");

    // Drop a node onto canvas
    fireEvent.click(screen.getByTestId("start-drag"));
    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 100, clientY: 200 });

    // Verify node was added
    expect(getStoreNodes()).toHaveLength(1);
    expect(getStoreNodes()[0].kind).toBe("task");

    // Undo via temporal middleware
    const { result: temporal, unmount } = renderHook(() => useTemporalStore());
    act(() => {
      flush();
      temporal.current.undo();
    });
    unmount();

    // Node should be gone
    expect(getStoreNodes()).toHaveLength(0);
  });

  it("redo restores a node after undo", () => {
    renderCanvasWithDrag("task");

    // Drop a node
    fireEvent.click(screen.getByTestId("start-drag"));
    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 100, clientY: 200 });

    expect(getStoreNodes()).toHaveLength(1);

    // Undo
    const { result: temporal, unmount } = renderHook(() => useTemporalStore());
    act(() => {
      flush();
      temporal.current.undo();
    });
    expect(getStoreNodes()).toHaveLength(0);

    // Redo
    act(() => {
      flush();
      temporal.current.redo();
    });
    unmount();

    expect(getStoreNodes()).toHaveLength(1);
    expect(getStoreNodes()[0].kind).toBe("task");
  });

  it("undo multiple drops in reverse order", () => {
    renderCanvasWithDrag("task");

    const canvas = screen.getByRole("application");

    // Drop first node
    fireEvent.click(screen.getByTestId("start-drag"));
    fireEvent.pointerUp(canvas, { clientX: 100, clientY: 100 });
    expect(getStoreNodes()).toHaveLength(1);

    // Commit first drop to history
    act(() => {
      flush();
    });

    // Drop second node
    fireEvent.click(screen.getByTestId("start-drag"));
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 200 });
    expect(getStoreNodes()).toHaveLength(2);

    // Undo last drop
    const { result: temporal, unmount } = renderHook(() => useTemporalStore());
    act(() => {
      flush();
      temporal.current.undo();
    });
    expect(getStoreNodes()).toHaveLength(1);

    // Undo first drop
    act(() => {
      flush();
      temporal.current.undo();
    });
    unmount();

    expect(getStoreNodes()).toHaveLength(0);
  });
});
