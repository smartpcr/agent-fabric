import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, renderHook, act, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

// Capture props passed to ReactFlow
let capturedSelectionMode: string | undefined;
let capturedOnSelectionChange: (({ nodes }: { nodes: Array<{ id: string }> }) => void) | undefined;

/**
 * Mock ReactFlow that simulates lasso behavior:
 * - Renders a pane area (data-testid="rf-pane") that listens for pointer drag gestures
 * - On pointerdown + pointermove + pointerup on the pane, computes which nodes
 *   fall within the drag rectangle and fires onSelectionChange with those nodes
 * - Nodes are rendered with position data-attributes so the mock can compute intersection
 */
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

    // Store node list on pane element for the lasso simulation
    const allNodes = nodes ?? [];

    return (
      <div data-testid="mock-reactflow">
        <div
          data-testid="rf-pane"
          data-nodes={JSON.stringify(
            allNodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })),
          )}
          onPointerUp={(e) => {
            // Simulate lasso: compute which nodes intersect the drag box
            // The drag box is defined by data attributes set during pointerdown
            const pane = e.currentTarget;
            const startX = Number(pane.getAttribute("data-drag-start-x") ?? "0");
            const startY = Number(pane.getAttribute("data-drag-start-y") ?? "0");
            const endX = e.clientX;
            const endY = e.clientY;

            if (pane.getAttribute("data-dragging") !== "true") return;
            pane.removeAttribute("data-dragging");

            const minX = Math.min(startX, endX);
            const maxX = Math.max(startX, endX);
            const minY = Math.min(startY, endY);
            const maxY = Math.max(startY, endY);

            // Only trigger lasso if selection mode is partial and there was actual drag distance
            if (selectionMode === "partial" && (maxX - minX > 1 || maxY - minY > 1)) {
              const nodesData = JSON.parse(pane.getAttribute("data-nodes") ?? "[]") as Array<{
                id: string;
                x: number;
                y: number;
              }>;
              const enclosed = nodesData.filter(
                (n) => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY,
              );
              onSelectionChange?.({ nodes: enclosed.map((n) => ({ id: n.id })) });
            }
          }}
          onPointerDown={(e) => {
            const pane = e.currentTarget;
            pane.setAttribute("data-dragging", "true");
            pane.setAttribute("data-drag-start-x", String(e.clientX));
            pane.setAttribute("data-drag-start-y", String(e.clientY));
          }}
        />
        {allNodes.map((n) => {
          const Component = (n.type ? nt?.[n.type] : undefined) as
            | React.ComponentType<{
                id: string;
                type: string;
                data: unknown;
                selected: boolean;
              }>
            | undefined;
          return (
            <div
              key={n.id}
              data-testid={`rf-node-${n.id}`}
              data-pos-x={n.position.x}
              data-pos-y={n.position.y}
            >
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

function addNodesAt(...positions: Array<{ kind: string; x: number; y: number }>) {
  const ids: string[] = [];
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    for (const { kind, x, y } of positions) {
      const spec = result.current.registry.resolve(kind);
      const node = result.current.addNode(spec, { x, y });
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

/** Simulate a lasso drag on the pane from (startX,startY) to (endX,endY) */
function simulateLassoDrag(startX: number, startY: number, endX: number, endY: number) {
  const pane = screen.getByTestId("rf-pane");
  fireEvent.pointerDown(pane, { clientX: startX, clientY: startY });
  fireEvent.pointerUp(pane, { clientX: endX, clientY: endY });
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

  it("drag on empty canvas creates box; 2 of 3 enclosed nodes become selected", () => {
    setupStore();
    // Place nodes at known positions: (10,10), (50,50), (200,200)
    const [id1, id2, id3] = addNodesAt(
      { kind: "start", x: 10, y: 10 },
      { kind: "task", x: 50, y: 50 },
      { kind: "end", x: 200, y: 200 },
    );

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    // Drag a lasso box from (0,0) to (100,100) — encloses node1 (10,10) and node2 (50,50)
    act(() => {
      simulateLassoDrag(0, 0, 100, 100);
    });

    const selected = getSelected();
    expect(selected.has(id1)).toBe(true);
    expect(selected.has(id2)).toBe(true);
    expect(selected.has(id3)).toBe(false);
    expect(selected.size).toBe(2);
  });

  it("drag enclosing all nodes selects all", () => {
    setupStore();
    const [id1, id2, id3] = addNodesAt(
      { kind: "start", x: 10, y: 10 },
      { kind: "task", x: 50, y: 50 },
      { kind: "end", x: 100, y: 100 },
    );

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    act(() => {
      simulateLassoDrag(0, 0, 200, 200);
    });

    const selected = getSelected();
    expect(selected.has(id1)).toBe(true);
    expect(selected.has(id2)).toBe(true);
    expect(selected.has(id3)).toBe(true);
    expect(selected.size).toBe(3);
  });

  it("drag enclosing no nodes clears selection", () => {
    setupStore();
    const [id1] = addNodesAt({ kind: "start", x: 100, y: 100 });

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    // First select the node via a lasso that encloses it
    act(() => {
      simulateLassoDrag(50, 50, 150, 150);
    });
    expect(getSelected().has(id1)).toBe(true);
    expect(getSelected().size).toBe(1);

    // Drag a box that misses all nodes (0,0 to 50,50 — node is at 100,100)
    act(() => {
      simulateLassoDrag(0, 0, 50, 50);
    });

    expect(getSelected().size).toBe(0);
  });

  it("lasso selection replaces previous selection", () => {
    setupStore();
    const [id1, id2, id3] = addNodesAt(
      { kind: "start", x: 10, y: 10 },
      { kind: "task", x: 50, y: 50 },
      { kind: "end", x: 200, y: 200 },
    );

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    // First lasso selects id1
    act(() => {
      simulateLassoDrag(0, 0, 30, 30);
    });
    expect(getSelected().has(id1)).toBe(true);
    expect(getSelected().size).toBe(1);

    // Second lasso selects id3 only
    act(() => {
      simulateLassoDrag(150, 150, 250, 250);
    });

    const selected = getSelected();
    expect(selected.has(id1)).toBe(false);
    expect(selected.has(id2)).toBe(false);
    expect(selected.has(id3)).toBe(true);
    expect(selected.size).toBe(1);
  });
});
