import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, renderHook, act, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { MiniMap } from "@/features/canvas/MiniMap";
import { useWorkflowStore } from "@/store/hooks";

// Use vi.hoisted so the mock fn is available before vi.mock runs
const mockSetViewport = vi.hoisted(() => vi.fn());

// Capture MiniMap props
let capturedProps: Record<string, unknown> = {};

vi.mock("@xyflow/react", () => ({
  MiniMap: (props: Record<string, unknown>) => {
    capturedProps = props;
    return (
      <button
        type="button"
        data-testid="mock-minimap"
        onClick={(e) => {
          const onClick = props.onClick as
            | ((event: React.MouseEvent, position: { x: number; y: number }) => void)
            | undefined;
          onClick?.(e, { x: 200, y: 150 });
        }}
      />
    );
  },
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    setViewport: mockSetViewport,
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  }),
}));

afterEach(() => {
  cleanup();
  capturedProps = {};
  mockSetViewport.mockReset();
});

function setupStore() {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setZoom(1);
    result.current.setPan(0, 0);
  });
  unmount();
}

function getStoreViewport() {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const vp = { zoom: result.current.zoom, panX: result.current.panX, panY: result.current.panY };
  unmount();
  return vp;
}

describe("MiniMap", () => {
  it("renders the minimap", () => {
    setupStore();
    render(<MiniMap />);
    expect(screen.getByTestId("mock-minimap")).toBeDefined();
  });

  it("passes nodeColor function to MiniMap", () => {
    setupStore();
    render(<MiniMap />);
    expect(typeof capturedProps.nodeColor).toBe("function");
  });

  it("nodeColor returns green for start nodes", () => {
    setupStore();
    render(<MiniMap />);
    const colorFn = capturedProps.nodeColor as (node: { type?: string }) => string;
    expect(colorFn({ type: "start" })).toBe("#22c55e");
  });

  it("nodeColor returns red for end nodes", () => {
    setupStore();
    render(<MiniMap />);
    const colorFn = capturedProps.nodeColor as (node: { type?: string }) => string;
    expect(colorFn({ type: "end" })).toBe("#ef4444");
  });

  it("nodeColor returns blue for task nodes", () => {
    setupStore();
    render(<MiniMap />);
    const colorFn = capturedProps.nodeColor as (node: { type?: string }) => string;
    expect(colorFn({ type: "task" })).toBe("#3b82f6");
  });

  it("nodeColor returns default gray for unknown node kinds", () => {
    setupStore();
    render(<MiniMap />);
    const colorFn = capturedProps.nodeColor as (node: { type?: string }) => string;
    expect(colorFn({ type: "unknown" })).toBe("#94a3b8");
  });

  it("sets pannable and zoomable props", () => {
    setupStore();
    render(<MiniMap />);
    expect(capturedProps.pannable).toBe(true);
    expect(capturedProps.zoomable).toBe(true);
  });

  it("click on minimap calls setViewport to recenter", () => {
    setupStore();
    render(<MiniMap />);

    const minimap = screen.getByTestId("mock-minimap");
    act(() => {
      fireEvent.click(minimap);
    });

    // setViewport should have been called with recentered coords
    expect(mockSetViewport).toHaveBeenCalledWith({
      x: -200,
      y: -150,
      zoom: 1,
    });
  });

  it("click on minimap updates store viewport", () => {
    setupStore();
    render(<MiniMap />);

    const minimap = screen.getByTestId("mock-minimap");
    act(() => {
      fireEvent.click(minimap);
    });

    const vp = getStoreViewport();
    expect(vp.panX).toBe(-200);
    expect(vp.panY).toBe(-150);
    expect(vp.zoom).toBe(1);
  });
});
