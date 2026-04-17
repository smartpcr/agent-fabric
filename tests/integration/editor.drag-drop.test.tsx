import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { EditorPage } from "@/features/editor/EditorPage";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

// Mock @xyflow/react — render nodes passed to ReactFlow so we can assert rendered output
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    nodes,
  }: {
    children?: ReactNode;
    nodes?: Array<{ id: string; kind: string; position: { x: number; y: number } }>;
  }) => (
    <div data-testid="mock-reactflow">
      {nodes?.map((n) => (
        <div
          key={n.id}
          data-testid={`rf-node-${n.kind}`}
          data-node-id={n.id}
          data-node-kind={n.kind}
          data-node-x={n.position.x}
          data-node-y={n.position.y}
        >
          {n.kind}
        </div>
      ))}
      {children}
    </div>
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

// Mock @tanstack/react-virtual so palette items render in jsdom (no real scroll dimensions)
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
  }: {
    count: number;
    getScrollElement: () => HTMLElement | null;
    estimateSize: () => number;
    overscan?: number;
  }) => ({
    getTotalSize: () => count * 36,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 36,
        size: 36,
        end: (i + 1) * 36,
        key: i,
        lane: 0,
      })),
  }),
}));

// Polyfill pointer capture for jsdom (noop stubs)
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

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

describe("Integration — palette drag → canvas drop → node rendered", () => {
  beforeEach(() => {
    setupStore();
  });

  it("EditorPage mounts with palette items, canvas, and property grid", () => {
    render(<EditorPage />);

    // Palette with items visible
    expect(screen.getAllByRole("complementary", { name: /node palette/i }).length).toBeGreaterThan(
      0,
    );
    // Palette items should now be rendered (virtualizer mocked)
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(3);

    // Canvas
    expect(screen.getByRole("application", { name: /workflow canvas/i })).toBeInTheDocument();
    // Property grid
    expect(screen.getAllByRole("complementary", { name: /property grid/i }).length).toBeGreaterThan(
      0,
    );
  });

  it("pointer drag from palette Task item → canvas drop → node rendered at drop point", () => {
    render(<EditorPage />);

    // Find the real Task palette item
    const taskOption = screen.getByRole("option", { name: "Task" });
    expect(taskOption).toBeInTheDocument();
    expect(taskOption.getAttribute("data-kind")).toBe("task");

    // Simulate real pointer drag:
    // 1. pointerdown on palette item (initiates useDragStart)
    act(() => {
      fireEvent.pointerDown(taskOption, {
        clientX: 50,
        clientY: 50,
        pointerId: 1,
      });
    });

    // 2. pointermove past 3px threshold to trigger startDrag
    act(() => {
      fireEvent.pointerMove(taskOption, {
        clientX: 60,
        clientY: 60,
        pointerId: 1,
      });
    });

    // 3. pointerup on the canvas to trigger drop
    const canvas = screen.getByRole("application", { name: /workflow canvas/i });
    act(() => {
      fireEvent.pointerUp(canvas, { clientX: 300, clientY: 400 });
    });

    // Assert rendered node on canvas (mock ReactFlow renders node elements)
    const renderedNode = screen.getByTestId("rf-node-task");
    expect(renderedNode).toBeInTheDocument();
    expect(renderedNode.getAttribute("data-node-kind")).toBe("task");
    expect(renderedNode.getAttribute("data-node-x")).toBe("300");
    expect(renderedNode.getAttribute("data-node-y")).toBe("400");
  });

  it("pointer drag from palette Start item → canvas drop → start node rendered", () => {
    render(<EditorPage />);

    const startOption = screen.getByRole("option", { name: "Start" });
    expect(startOption.getAttribute("data-kind")).toBe("start");

    act(() => {
      fireEvent.pointerDown(startOption, { clientX: 50, clientY: 50, pointerId: 1 });
    });
    act(() => {
      fireEvent.pointerMove(startOption, { clientX: 60, clientY: 60, pointerId: 1 });
    });

    const canvas = screen.getByRole("application", { name: /workflow canvas/i });
    act(() => {
      fireEvent.pointerUp(canvas, { clientX: 200, clientY: 100 });
    });

    // Assert rendered node
    const renderedNode = screen.getByTestId("rf-node-start");
    expect(renderedNode).toBeInTheDocument();
    expect(renderedNode.getAttribute("data-node-kind")).toBe("start");
    expect(renderedNode.getAttribute("data-node-x")).toBe("200");
    expect(renderedNode.getAttribute("data-node-y")).toBe("100");
  });

  it("pointer drag from palette End item → canvas drop → end node rendered at drop point", () => {
    render(<EditorPage />);

    const endOption = screen.getByRole("option", { name: "End" });
    expect(endOption.getAttribute("data-kind")).toBe("end");

    act(() => {
      fireEvent.pointerDown(endOption, { clientX: 10, clientY: 10, pointerId: 1 });
    });
    act(() => {
      fireEvent.pointerMove(endOption, { clientX: 20, clientY: 20, pointerId: 1 });
    });

    const canvas = screen.getByRole("application", { name: /workflow canvas/i });
    act(() => {
      fireEvent.pointerUp(canvas, { clientX: 500, clientY: 750 });
    });

    const renderedNode = screen.getByTestId("rf-node-end");
    expect(renderedNode).toBeInTheDocument();
    expect(renderedNode.getAttribute("data-node-kind")).toBe("end");
    expect(renderedNode.getAttribute("data-node-x")).toBe("500");
    expect(renderedNode.getAttribute("data-node-y")).toBe("750");
  });
});
