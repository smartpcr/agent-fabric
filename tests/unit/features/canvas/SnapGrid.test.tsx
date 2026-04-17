import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { snapToGrid } from "@/features/canvas/SnapGrid";
import { Canvas } from "@/features/canvas/Canvas";
import { ToastProvider } from "@/features/editor/Toast";
import { DragProvider, useDragContext } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

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

// --- Pure snapToGrid tests ---

describe("snapToGrid", () => {
  it("rounds to nearest multiple of default size (16)", () => {
    expect(snapToGrid({ x: 10, y: 25 })).toEqual({ x: 16, y: 32 });
  });

  it("rounds down when closer to lower multiple", () => {
    expect(snapToGrid({ x: 7, y: 7 })).toEqual({ x: 0, y: 0 });
  });

  it("handles exact multiples unchanged", () => {
    expect(snapToGrid({ x: 32, y: 64 })).toEqual({ x: 32, y: 64 });
  });

  it("handles negative coordinates", () => {
    expect(snapToGrid({ x: -10, y: -25 })).toEqual({ x: -16, y: -32 });
  });

  it("handles zero position", () => {
    expect(snapToGrid({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("accepts custom grid size", () => {
    expect(snapToGrid({ x: 7, y: 13 }, 10)).toEqual({ x: 10, y: 10 });
  });

  it("works with grid size of 1 (no snapping effect)", () => {
    expect(snapToGrid({ x: 7.4, y: 13.6 }, 1)).toEqual({ x: 7, y: 14 });
  });

  it("rounds to nearest with custom large grid", () => {
    expect(snapToGrid({ x: 45, y: 60 }, 50)).toEqual({ x: 50, y: 50 });
  });
});

// --- Integration: Canvas applies snap on drop ---

function setupStore(snapEnabled = false, snapGridSize = 16) {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
    for (const node of result.current.nodes) {
      result.current.removeNode(node.id);
    }
    // Reset snap state to defaults
    if (result.current.snapEnabled) {
      result.current.toggleSnap();
    }
    result.current.setSnapGridSize(16);
    // Now apply requested state
    if (snapEnabled) {
      result.current.toggleSnap();
    }
    if (snapGridSize !== 16) {
      result.current.setSnapGridSize(snapGridSize);
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

describe("Canvas snap-to-grid on drop", () => {
  it("does not snap when snapEnabled is false (disabled bypasses)", () => {
    setupStore(false);
    renderCanvasWithDrag("task");

    fireEvent.click(screen.getByTestId("start-drag"));
    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 25 });

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].position).toEqual({ x: 10, y: 25 });
  });

  it("snaps position when snapEnabled is true", () => {
    setupStore(true);
    renderCanvasWithDrag("task");

    fireEvent.click(screen.getByTestId("start-drag"));
    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 25 });

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].position).toEqual({ x: 16, y: 32 });
  });

  it("uses configurable grid size", () => {
    setupStore(true, 10);
    renderCanvasWithDrag("task");

    fireEvent.click(screen.getByTestId("start-drag"));
    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 7, clientY: 13 });

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].position).toEqual({ x: 10, y: 10 });
  });
});

// --- viewportSlice toggleSnap / setSnapGridSize ---

describe("viewportSlice snap state", () => {
  beforeEach(() => {
    // Reset snap state before each test
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      if (result.current.snapEnabled) {
        result.current.toggleSnap();
      }
      result.current.setSnapGridSize(16);
    });
    unmount();
  });

  it("snapEnabled defaults to false", () => {
    const { result } = renderHook(() => useWorkflowStore());
    expect(result.current.snapEnabled).toBe(false);
  });

  it("toggleSnap toggles snapEnabled", () => {
    const { result } = renderHook(() => useWorkflowStore());
    act(() => {
      result.current.toggleSnap();
    });
    expect(result.current.snapEnabled).toBe(true);
    act(() => {
      result.current.toggleSnap();
    });
    expect(result.current.snapEnabled).toBe(false);
  });

  it("snapGridSize defaults to 16", () => {
    const { result } = renderHook(() => useWorkflowStore());
    expect(result.current.snapGridSize).toBe(16);
  });

  it("setSnapGridSize updates the grid size", () => {
    const { result } = renderHook(() => useWorkflowStore());
    act(() => {
      result.current.setSnapGridSize(24);
    });
    expect(result.current.snapGridSize).toBe(24);
  });
});

// --- Snap toggle in Controls ---

describe("Canvas snap toggle control", () => {
  beforeEach(() => {
    setupStore(false);
  });

  it("renders a snap toggle button in canvas controls", () => {
    renderCanvasWithDrag("task");
    expect(screen.getByTestId("snap-toggle")).toBeInTheDocument();
  });

  it("clicking snap toggle enables snapping", () => {
    renderCanvasWithDrag("task");

    const toggleBtn = screen.getByTestId("snap-toggle");
    expect(toggleBtn.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      fireEvent.click(toggleBtn);
    });

    expect(toggleBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("toggling snap on affects drop position", () => {
    renderCanvasWithDrag("task");

    // Enable snap
    act(() => {
      fireEvent.click(screen.getByTestId("snap-toggle"));
    });

    // Drop at non-grid-aligned position
    fireEvent.click(screen.getByTestId("start-drag"));
    const canvas = screen.getByRole("application");
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 25 });

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    // With default grid size 16: 10→16, 25→32
    expect(nodes[0].position).toEqual({ x: 16, y: 32 });
  });
});
