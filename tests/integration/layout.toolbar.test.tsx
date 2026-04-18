import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  act,
  renderHook,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { Toolbar } from "@/features/editor/Toolbar";
import { useWorkflowStore, useTemporalStore } from "@/store/hooks";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";

interface MockNode {
  readonly id: string;
  readonly position: { readonly x: number; readonly y: number };
}

// Stub layoutGraph to return updated positions
vi.mock("@/domain/layout/layoutGraph", () => ({
  layoutGraph: vi.fn((graph: { nodes: MockNode[] }) =>
    Promise.resolve({
      ...graph,
      nodes: graph.nodes.map((n: MockNode) => ({
        ...n,
        position: { x: n.position.x + 100, y: n.position.y + 200 },
      })),
    }),
  ),
}));

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-reactflow">{children}</div>
  ),
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
  SelectionMode: { Partial: "partial", Full: "full" },
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

function readStoreNodes() {
  const { result, unmount } = renderHook(() => useWorkflowStore((s) => s.nodes));
  const nodes = result.current;
  unmount();
  return nodes;
}

describe("Auto-layout toolbar button", () => {
  beforeEach(() => {
    setupStore();
  });

  it("renders the auto-layout button", () => {
    render(<Toolbar />);
    expect(screen.getByTestId("auto-layout-button")).toBeInTheDocument();
    expect(screen.getByLabelText("Auto-layout")).toBeInTheDocument();
  });

  it("button is enabled when layout is not running", () => {
    render(<Toolbar />);
    const btn = screen.getByTestId("auto-layout-button");
    expect(btn).not.toBeDisabled();
  });

  it("click triggers layout and positions change", async () => {
    const { result, unmount } = renderHook(() => useWorkflowStore());
    const spec = result.current.registry.resolve("task");
    act(() => {
      result.current.addNode(spec, { x: 0, y: 0 });
      result.current.addNode(spec, { x: 10, y: 10 });
    });
    unmount();

    const originalPositions = readStoreNodes().map((n) => ({ ...n.position }));

    render(<Toolbar />);
    const btn = screen.getByTestId("auto-layout-button");

    act(() => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      const newNodes = readStoreNodes();
      expect(newNodes[0].position.x).toBe(originalPositions[0].x + 100);
      expect(newNodes[0].position.y).toBe(originalPositions[0].y + 200);
      expect(newNodes[1].position.x).toBe(originalPositions[1].x + 100);
      expect(newNodes[1].position.y).toBe(originalPositions[1].y + 200);
    });
  });

  it("one undo restores prior positions", async () => {
    const { result, unmount } = renderHook(() => useWorkflowStore());
    const spec = result.current.registry.resolve("task");
    act(() => {
      result.current.addNode(spec, { x: 50, y: 60 });
    });
    unmount();

    const beforeLayout = readStoreNodes().map((n) => ({ ...n.position }));

    // Clear temporal history so the layout is the only undo step
    const { result: temporal, unmount: unmountT } = renderHook(() => useTemporalStore());
    act(() => {
      temporal.current.clear();
    });
    unmountT();

    render(<Toolbar />);
    const btn = screen.getByTestId("auto-layout-button");

    act(() => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      const afterLayout = readStoreNodes();
      expect(afterLayout[0].position.x).toBe(150);
      expect(afterLayout[0].position.y).toBe(260);
    });

    // Undo
    const { result: temporal2, unmount: unmountT2 } = renderHook(() => useTemporalStore());
    act(() => {
      temporal2.current.undo();
    });
    unmountT2();

    const restored = readStoreNodes();
    expect(restored[0].position.x).toBe(beforeLayout[0].x);
    expect(restored[0].position.y).toBe(beforeLayout[0].y);
  });

  it("button is disabled while layout is running", async () => {
    const { layoutGraph } = await import("@/domain/layout/layoutGraph");
    const mockFn = vi.mocked(layoutGraph);

    let resolveLayout!: (value: unknown) => void;
    mockFn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLayout = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useWorkflowStore());
    const spec = result.current.registry.resolve("task");
    act(() => {
      result.current.addNode(spec, { x: 0, y: 0 });
    });

    // Start layout via store action (not via button, to avoid render timing issues)
    let layoutPromise: Promise<void> | undefined;
    act(() => {
      layoutPromise = result.current.applyLayout();
    });
    unmount();

    render(<Toolbar />);

    // Button should be disabled while running
    await waitFor(() => {
      expect(screen.getByTestId("auto-layout-button")).toBeDisabled();
    });

    // Resolve the pending layout
    const nodes = readStoreNodes();
    await act(async () => {
      resolveLayout({
        schemaVersion: 1,
        id: "store",
        name: "store",
        edges: [],
        nodes: nodes.map((n) => ({
          ...n,
          position: { x: n.position.x + 100, y: n.position.y + 200 },
        })),
      });
      if (layoutPromise) await layoutPromise;
    });

    // Button should be enabled again
    await waitFor(() => {
      expect(screen.getByTestId("auto-layout-button")).not.toBeDisabled();
    });
  });
});
