import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

// Capture handlers passed to ReactFlow
let capturedOnNodeClick: ((event: MouseEvent, node: { id: string }) => void) | undefined;
let capturedOnPaneClick: (() => void) | undefined;
let capturedOnSelectionChange: (({ nodes }: { nodes: Array<{ id: string }> }) => void) | undefined;

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    nodes,
    nodeTypes: nt,
    onNodeClick,
    onPaneClick,
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
    onNodeClick?: (event: MouseEvent, node: { id: string }) => void;
    onPaneClick?: () => void;
    onSelectionChange?: ({ nodes }: { nodes: Array<{ id: string }> }) => void;
  }) => {
    capturedOnNodeClick = onNodeClick;
    capturedOnPaneClick = onPaneClick;
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
  capturedOnNodeClick = undefined;
  capturedOnPaneClick = undefined;
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

function simulateNodeClick(
  nodeId: string,
  modifiers: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {},
) {
  if (capturedOnNodeClick) {
    const event = new MouseEvent("click", {
      shiftKey: modifiers.shiftKey ?? false,
      ctrlKey: modifiers.ctrlKey ?? false,
      metaKey: modifiers.metaKey ?? false,
    });
    capturedOnNodeClick(event, { id: nodeId });
  }
}

describe("Selection click behavior", () => {
  it("click on a node selects it (replace mode)", () => {
    setupStore();
    const [id1] = addNodes("start", "task");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    act(() => {
      simulateNodeClick(id1);
    });

    const selected = getSelected();
    expect(selected.has(id1)).toBe(true);
    expect(selected.size).toBe(1);
  });

  it("click on another node replaces selection", () => {
    setupStore();
    const [id1, id2] = addNodes("start", "task");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    act(() => {
      simulateNodeClick(id1);
    });
    act(() => {
      simulateNodeClick(id2);
    });

    const selected = getSelected();
    expect(selected.has(id1)).toBe(false);
    expect(selected.has(id2)).toBe(true);
    expect(selected.size).toBe(1);
  });

  it("shift-click adds to selection", () => {
    setupStore();
    const [id1, id2] = addNodes("start", "task");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    act(() => {
      simulateNodeClick(id1);
    });
    act(() => {
      simulateNodeClick(id2, { shiftKey: true });
    });

    const selected = getSelected();
    expect(selected.has(id1)).toBe(true);
    expect(selected.has(id2)).toBe(true);
    expect(selected.size).toBe(2);
  });

  it("ctrl-click toggles selection (adds unselected)", () => {
    setupStore();
    const [id1, id2] = addNodes("start", "task");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    act(() => {
      simulateNodeClick(id1);
    });
    act(() => {
      simulateNodeClick(id2, { ctrlKey: true });
    });

    const selected = getSelected();
    expect(selected.has(id1)).toBe(true);
    expect(selected.has(id2)).toBe(true);
    expect(selected.size).toBe(2);
  });

  it("ctrl-click toggles selection (removes already selected)", () => {
    setupStore();
    const [id1, id2] = addNodes("start", "task");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    act(() => {
      simulateNodeClick(id1);
    });
    act(() => {
      simulateNodeClick(id2, { shiftKey: true });
    });
    // Both selected; now ctrl-click id1 to remove it
    act(() => {
      simulateNodeClick(id1, { ctrlKey: true });
    });

    const selected = getSelected();
    expect(selected.has(id1)).toBe(false);
    expect(selected.has(id2)).toBe(true);
    expect(selected.size).toBe(1);
  });

  it("meta-click (cmd on Mac) toggles selection", () => {
    setupStore();
    const [id1] = addNodes("start");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    act(() => {
      simulateNodeClick(id1);
    });
    act(() => {
      simulateNodeClick(id1, { metaKey: true });
    });

    const selected = getSelected();
    expect(selected.has(id1)).toBe(false);
    expect(selected.size).toBe(0);
  });

  it("pane click clears selection", () => {
    setupStore();
    const [id1] = addNodes("start");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    act(() => {
      simulateNodeClick(id1);
    });
    expect(getSelected().size).toBe(1);

    act(() => {
      capturedOnPaneClick?.();
    });

    expect(getSelected().size).toBe(0);
  });

  it("onSelectionChange routes xyflow selection to store", () => {
    setupStore();
    const [id1, id2] = addNodes("start", "task");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    act(() => {
      capturedOnSelectionChange?.({ nodes: [{ id: id1 }, { id: id2 }] });
    });

    const selected = getSelected();
    expect(selected.has(id1)).toBe(true);
    expect(selected.has(id2)).toBe(true);
    expect(selected.size).toBe(2);
  });
});
