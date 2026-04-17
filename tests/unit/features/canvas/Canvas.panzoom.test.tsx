import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

// Capture all props passed to ReactFlow
let capturedProps: Record<string, unknown> = {};

vi.mock("@xyflow/react", () => ({
  ReactFlow: (props: Record<string, unknown>) => {
    capturedProps = props;
    return <div data-testid="mock-reactflow">{props.children as ReactNode}</div>;
  },
  Controls: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-controls">{children}</div>
  ),
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
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
