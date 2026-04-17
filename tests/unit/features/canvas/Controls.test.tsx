import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, renderHook, act, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { CanvasControls } from "@/features/canvas/Controls";
import { Canvas } from "@/features/canvas/Canvas";
import { ToastProvider } from "@/features/editor/Toast";
import { DragProvider } from "@/features/palette/DragContext";
import { useWorkflowStore } from "@/store/hooks";

const mockZoomIn = vi.hoisted(() => vi.fn());
const mockZoomOut = vi.hoisted(() => vi.fn());
const mockFitView = vi.hoisted(() => vi.fn());

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-reactflow">{children}</div>
  ),
  Controls: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-controls">{children}</div>
  ),
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
    fitView: mockFitView,
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    setViewport: vi.fn(),
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
  MiniMap: () => null,
}));

vi.mock("@/features/canvas/Background", () => ({
  Background: () => <div data-testid="mock-background" />,
}));

vi.mock("@/store/selectors/graphSelectors", () => ({
  selectNodeSpec: () => ({ icon: "cog" }),
}));

afterEach(() => {
  cleanup();
  mockZoomIn.mockReset();
  mockZoomOut.mockReset();
  mockFitView.mockReset();
});

function setupStore() {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setZoom(1);
    result.current.setPan(0, 0);
    // Ensure interactive is true (default)
    if (!result.current.interactive) {
      result.current.toggleInteractive();
    }
  });
  unmount();
}

function renderControls() {
  return render(<CanvasControls />);
}

function renderCanvas() {
  setupStore();
  return render(
    <ToastProvider>
      <DragProvider>
        <Canvas />
      </DragProvider>
    </ToastProvider>,
  );
}

describe("CanvasControls component", () => {
  it("renders all four control buttons", () => {
    setupStore();
    renderControls();

    expect(screen.getByTestId("zoom-in")).toBeDefined();
    expect(screen.getByTestId("zoom-out")).toBeDefined();
    expect(screen.getByTestId("fit-view")).toBeDefined();
    expect(screen.getByTestId("toggle-lock")).toBeDefined();
  });

  it("zoom in button dispatches zoomIn", () => {
    setupStore();
    renderControls();

    fireEvent.click(screen.getByTestId("zoom-in"));
    expect(mockZoomIn).toHaveBeenCalled();
  });

  it("zoom out button dispatches zoomOut", () => {
    setupStore();
    renderControls();

    fireEvent.click(screen.getByTestId("zoom-out"));
    expect(mockZoomOut).toHaveBeenCalled();
  });

  it("fit view button dispatches fitView", () => {
    setupStore();
    renderControls();

    fireEvent.click(screen.getByTestId("fit-view"));
    expect(mockFitView).toHaveBeenCalled();
  });

  it("lock button toggles interactive state", () => {
    setupStore();
    const { result, unmount } = renderHook(() => useWorkflowStore());
    expect(result.current.interactive).toBe(true);
    unmount();

    renderControls();
    fireEvent.click(screen.getByTestId("toggle-lock"));

    const { result: result2, unmount: unmount2 } = renderHook(() => useWorkflowStore());
    expect(result2.current.interactive).toBe(false);
    unmount2();
  });

  it("lock button shows unlock icon when interactive", () => {
    setupStore();
    renderControls();

    const btn = screen.getByTestId("toggle-lock");
    expect(btn.getAttribute("aria-label")).toBe("Lock canvas (l)");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("lock button shows lock icon when not interactive", () => {
    setupStore();
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      result.current.toggleInteractive();
    });
    unmount();

    renderControls();

    const btn = screen.getByTestId("toggle-lock");
    expect(btn.getAttribute("aria-label")).toBe("Unlock canvas (l)");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("buttons have tooltip titles with keyboard shortcuts", () => {
    setupStore();
    renderControls();

    expect(screen.getByTestId("zoom-in").getAttribute("title")).toBe("Zoom in (+)");
    expect(screen.getByTestId("zoom-out").getAttribute("title")).toBe("Zoom out (-)");
    expect(screen.getByTestId("fit-view").getAttribute("title")).toBe("Fit view (f)");
    expect(screen.getByTestId("toggle-lock").getAttribute("title")).toBe("Lock canvas (l)");
  });

  it("has role=toolbar with aria-label", () => {
    setupStore();
    renderControls();

    const toolbar = screen.getByRole("toolbar");
    expect(toolbar.getAttribute("aria-label")).toBe("Canvas controls");
  });
});

describe("Keyboard shortcuts (scoped to canvas)", () => {
  it("+ key dispatches zoomIn in canvas", () => {
    renderCanvas();

    const canvas = screen.getByRole("application");
    fireEvent.keyDown(canvas, { key: "+" });
    expect(mockZoomIn).toHaveBeenCalled();
  });

  it("- key dispatches zoomOut in canvas", () => {
    renderCanvas();

    const canvas = screen.getByRole("application");
    fireEvent.keyDown(canvas, { key: "-" });
    expect(mockZoomOut).toHaveBeenCalled();
  });

  it("f key dispatches fitView in canvas", () => {
    renderCanvas();

    const canvas = screen.getByRole("application");
    fireEvent.keyDown(canvas, { key: "f" });
    expect(mockFitView).toHaveBeenCalled();
  });

  it("l key toggles interactive state in canvas", () => {
    renderCanvas();

    const { result, unmount } = renderHook(() => useWorkflowStore());
    expect(result.current.interactive).toBe(true);
    unmount();

    const canvas = screen.getByRole("application");
    fireEvent.keyDown(canvas, { key: "l" });

    const { result: r2, unmount: u2 } = renderHook(() => useWorkflowStore());
    expect(r2.current.interactive).toBe(false);
    u2();
  });

  it("shortcuts do NOT fire outside the canvas", () => {
    renderCanvas();

    // Fire key on document body — outside canvas
    fireEvent.keyDown(document.body, { key: "+" });
    fireEvent.keyDown(document.body, { key: "-" });
    fireEvent.keyDown(document.body, { key: "f" });

    expect(mockZoomIn).not.toHaveBeenCalled();
    expect(mockZoomOut).not.toHaveBeenCalled();
    expect(mockFitView).not.toHaveBeenCalled();
  });
});
