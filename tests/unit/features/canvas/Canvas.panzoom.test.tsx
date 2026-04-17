import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, renderHook, act, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

// Capture all props passed to ReactFlow + simulate viewport behavior
let capturedProps: Record<string, unknown> = {};
let mockViewport = { x: 0, y: 0, zoom: 1 };

vi.mock("@xyflow/react", () => ({
  ReactFlow: (props: Record<string, unknown>) => {
    capturedProps = props;
    const onMoveEnd = props.onMoveEnd as (() => void) | undefined;

    return (
      <div
        data-testid="mock-reactflow"
        onWheel={(e) => {
          // Simulate xyflow wheel zoom behavior: deltaY < 0 = zoom in, > 0 = zoom out
          if (props.panOnScroll) {
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            const newZoom = mockViewport.zoom + delta;
            const minZ = props.minZoom as number;
            const maxZ = props.maxZoom as number;
            mockViewport = { ...mockViewport, zoom: Math.max(minZ, Math.min(maxZ, newZoom)) };
            onMoveEnd?.();
          }
        }}
        onPointerDown={(e) => {
          // Simulate middle-button drag start: record start position
          if (e.button === 1) {
            const el = e.currentTarget;
            el.setAttribute("data-mid-drag", "true");
            el.setAttribute("data-drag-start-x", String(e.clientX));
            el.setAttribute("data-drag-start-y", String(e.clientY));
          }
        }}
        onPointerUp={(e) => {
          const el = e.currentTarget;
          if (el.getAttribute("data-mid-drag") === "true") {
            el.removeAttribute("data-mid-drag");
            const startX = Number(el.getAttribute("data-drag-start-x") ?? "0");
            const startY = Number(el.getAttribute("data-drag-start-y") ?? "0");
            mockViewport = {
              ...mockViewport,
              x: mockViewport.x + (e.clientX - startX),
              y: mockViewport.y + (e.clientY - startY),
            };
            onMoveEnd?.();
          }
        }}
      >
        {props.children as ReactNode}
      </div>
    );
  },
  Controls: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-controls">{children}</div>
  ),
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    getViewport: () => mockViewport,
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
  Handle: (props: Record<string, unknown>) => (
    <div
      data-testid={props["data-testid"] as string}
      data-handle-type={props.type as string}
      data-handle-position={props.position as string}
    />
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  SelectionMode: { Partial: "partial", Full: "full" },
}));

vi.mock("@/features/canvas/Background", () => ({
  Background: () => <div data-testid="mock-background" />,
}));

vi.mock("@/store/selectors/graphSelectors", () => ({
  selectNodeSpec: () => ({ icon: "cog" }),
}));

afterEach(() => {
  cleanup();
  capturedProps = {};
  mockViewport = { x: 0, y: 0, zoom: 1 };
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
    result.current.clear();
    result.current.setZoom(1);
    result.current.setPan(0, 0);
  });
  unmount();
}

function renderCanvas() {
  return render(
    <DragProvider>
      <Canvas />
    </DragProvider>,
  );
}

function getStoreViewport() {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const vp = { zoom: result.current.zoom, panX: result.current.panX, panY: result.current.panY };
  unmount();
  return vp;
}

describe("Pan / zoom configuration", () => {
  it("passes panOnScroll=true to ReactFlow", () => {
    setupStore();
    renderCanvas();
    expect(capturedProps.panOnScroll).toBe(true);
  });

  it("passes zoomOnPinch=true to ReactFlow", () => {
    setupStore();
    renderCanvas();
    expect(capturedProps.zoomOnPinch).toBe(true);
  });

  it("passes minZoom=0.1 to ReactFlow", () => {
    setupStore();
    renderCanvas();
    expect(capturedProps.minZoom).toBe(0.1);
  });

  it("passes maxZoom=4 to ReactFlow", () => {
    setupStore();
    renderCanvas();
    expect(capturedProps.maxZoom).toBe(4);
  });

  it("selectionMode is partial (not overridden by pan/zoom config)", () => {
    setupStore();
    renderCanvas();
    expect(capturedProps.selectionMode).toBe("partial");
  });

  it("all pan/zoom props are set simultaneously", () => {
    setupStore();
    renderCanvas();
    expect(capturedProps).toMatchObject({
      panOnScroll: true,
      zoomOnPinch: true,
      minZoom: 0.1,
      maxZoom: 4,
    });
  });
});

describe("Pan / zoom behavior", () => {
  it("wheel scroll up zooms in and updates store viewport.zoom", () => {
    setupStore();
    renderCanvas();

    const pane = screen.getByTestId("mock-reactflow");
    act(() => {
      fireEvent.wheel(pane, { deltaY: -100 });
    });

    const vp = getStoreViewport();
    expect(vp.zoom).toBeGreaterThan(1);
  });

  it("wheel scroll down zooms out and updates store viewport.zoom", () => {
    setupStore();
    renderCanvas();

    const pane = screen.getByTestId("mock-reactflow");
    act(() => {
      fireEvent.wheel(pane, { deltaY: 100 });
    });

    const vp = getStoreViewport();
    expect(vp.zoom).toBeLessThan(1);
  });

  it("zoom is clamped to minZoom (0.1)", () => {
    setupStore();
    renderCanvas();

    const pane = screen.getByTestId("mock-reactflow");
    // Scroll down many times to try to zoom below min
    act(() => {
      for (let i = 0; i < 20; i++) {
        fireEvent.wheel(pane, { deltaY: 100 });
      }
    });

    const vp = getStoreViewport();
    expect(vp.zoom).toBeGreaterThanOrEqual(0.1);
  });

  it("zoom is clamped to maxZoom (4)", () => {
    setupStore();
    renderCanvas();

    const pane = screen.getByTestId("mock-reactflow");
    // Scroll up many times to try to zoom above max
    act(() => {
      for (let i = 0; i < 50; i++) {
        fireEvent.wheel(pane, { deltaY: -100 });
      }
    });

    const vp = getStoreViewport();
    expect(vp.zoom).toBeLessThanOrEqual(4);
  });

  it("middle-button drag pans the viewport", () => {
    setupStore();
    renderCanvas();

    const pane = screen.getByTestId("mock-reactflow");
    act(() => {
      fireEvent.pointerDown(pane, { button: 1, clientX: 100, clientY: 100 });
      fireEvent.pointerUp(pane, { button: 1, clientX: 200, clientY: 150 });
    });

    const vp = getStoreViewport();
    expect(vp.panX).toBe(100); // 200 - 100
    expect(vp.panY).toBe(50); // 150 - 100
  });

  it("middle-drag does not affect zoom", () => {
    setupStore();
    renderCanvas();

    const pane = screen.getByTestId("mock-reactflow");
    act(() => {
      fireEvent.pointerDown(pane, { button: 1, clientX: 0, clientY: 0 });
      fireEvent.pointerUp(pane, { button: 1, clientX: 50, clientY: 50 });
    });

    const vp = getStoreViewport();
    expect(vp.zoom).toBe(1);
  });

  it("onMoveEnd is wired to ReactFlow", () => {
    setupStore();
    renderCanvas();
    expect(capturedProps.onMoveEnd).toBeDefined();
    expect(typeof capturedProps.onMoveEnd).toBe("function");
  });
});
