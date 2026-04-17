import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

// Capture props passed to ReactFlow
let capturedSelectionMode: string | undefined;
let capturedOnSelectionChange: (({ nodes }: { nodes: Array<{ id: string }> }) => void) | undefined;

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    nodes,
    nodeTypes: nt,
    selectionMode,
    onSelectionChange,
  }: {
    children?: ReactNode;
    nodes?: Array<{
      id: string;
      type?: string;
      data: unknown;
      position: { x: number; y: number };
    }>;
    nodeTypes?: Record<string, unknown>;
    selectionMode?: string;
    onNodeClick?: unknown;
    onPaneClick?: unknown;
    onSelectionChange?: ({ nodes }: { nodes: Array<{ id: string }> }) => void;
  }) => {
    capturedSelectionMode = selectionMode;
    capturedOnSelectionChange = onSelectionChange;
    return (
      <div data-testid="mock-reactflow">
        {nodes?.map((n) => {
          const Component = (n.type ? nt?.[n.type] : undefined) as
            | React.ComponentType<{
                id: string;
                type: string;
                data: unknown;
                selected: boolean;
              }>
            | undefined;
          return (
            <div key={n.id} data-testid={`rf-node-${n.id}`}>
              {Component ? (
                <Component id={n.id} type={n.type ?? ""} data={n.data} selected={false} />
              ) : (
                "unknown"
              )}
            </div>
          );
        })}
        {children}
      </div>
    );
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
  capturedSelectionMode = undefined;
  capturedOnSelectionChange = undefined;
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

function addNodes(...kinds: string[]) {
  const ids: string[] = [];
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    for (const kind of kinds) {
      const spec = result.current.registry.resolve(kind);
      const node = result.current.addNode(spec, { x: kinds.indexOf(kind) * 100, y: 0 });
      ids.push(node.id);
    }
  });
  unmount();
  return ids;
}

function getSelected(): Set<string> {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const selected = result.current.selected;
  unmount();
  return selected;
}

describe("Lasso (box) selection", () => {
  it("Canvas passes selectionMode='partial' to ReactFlow", () => {
    setupStore();

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    expect(capturedSelectionMode).toBe("partial");
  });

  it("onSelectionChange is wired to ReactFlow", () => {
    setupStore();

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    expect(capturedOnSelectionChange).toBeDefined();
    expect(typeof capturedOnSelectionChange).toBe("function");
  });

  it("lasso enclosing 2 of 3 nodes selects only those 2", () => {
    setupStore();
    const [id1, id2, id3] = addNodes("start", "task", "end");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    // Simulate xyflow lasso completion: only id1 and id2 were in the box
    act(() => {
      capturedOnSelectionChange?.({ nodes: [{ id: id1 }, { id: id2 }] });
    });

    const selected = getSelected();
    expect(selected.has(id1)).toBe(true);
    expect(selected.has(id2)).toBe(true);
    expect(selected.has(id3)).toBe(false);
    expect(selected.size).toBe(2);
  });

  it("lasso enclosing all nodes selects all", () => {
    setupStore();
    const [id1, id2, id3] = addNodes("start", "task", "end");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    act(() => {
      capturedOnSelectionChange?.({ nodes: [{ id: id1 }, { id: id2 }, { id: id3 }] });
    });

    const selected = getSelected();
    expect(selected.size).toBe(3);
  });

  it("lasso enclosing no nodes clears selection", () => {
    setupStore();
    const [id1] = addNodes("start");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    // First select a node
    act(() => {
      capturedOnSelectionChange?.({ nodes: [{ id: id1 }] });
    });
    expect(getSelected().size).toBe(1);

    // Empty lasso clears
    act(() => {
      capturedOnSelectionChange?.({ nodes: [] });
    });
    expect(getSelected().size).toBe(0);
  });

  it("lasso selection replaces previous selection", () => {
    setupStore();
    const [id1, id2, id3] = addNodes("start", "task", "end");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    // Select id1 first
    act(() => {
      capturedOnSelectionChange?.({ nodes: [{ id: id1 }] });
    });
    expect(getSelected().has(id1)).toBe(true);

    // Lasso selects id2 and id3 instead
    act(() => {
      capturedOnSelectionChange?.({ nodes: [{ id: id2 }, { id: id3 }] });
    });

    const selected = getSelected();
    expect(selected.has(id1)).toBe(false);
    expect(selected.has(id2)).toBe(true);
    expect(selected.has(id3)).toBe(true);
    expect(selected.size).toBe(2);
  });
});
