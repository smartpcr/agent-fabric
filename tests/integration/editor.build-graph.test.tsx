import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { EditorPage } from "@/features/editor/EditorPage";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

// Mock @xyflow/react — render nodes and edges passed to ReactFlow for assertion
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    nodes,
    edges,
  }: {
    children?: ReactNode;
    nodes?: Array<{ id: string; kind: string; position: { x: number; y: number } }>;
    edges?: Array<{
      id: string;
      source: string;
      target: string;
      sourcePort: string;
      targetPort: string;
    }>;
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
      {edges?.map((e) => (
        <div
          key={e.id}
          data-testid={`rf-edge-${e.id}`}
          data-edge-source={e.source}
          data-edge-target={e.target}
          data-edge-source-port={e.sourcePort}
          data-edge-target-port={e.targetPort}
        />
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
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
    setViewport: vi.fn(),
  }),
  SelectionMode: { Partial: "partial", Full: "full" },
  MiniMap: () => null,
}));

vi.mock("@/features/canvas/Background", () => ({
  Background: () => <div data-testid="mock-background" />,
}));

// Mock @tanstack/react-virtual so palette items render in jsdom
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

// Polyfill pointer capture for jsdom
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
    // Clear any pre-existing nodes
    for (const node of result.current.nodes) {
      result.current.removeNode(node.id);
    }
  });
  unmount();
  return registry;
}

/** Simulate drag from palette item to canvas */
function dragPaletteItemToCanvas(itemName: string, dropX: number, dropY: number) {
  const option = screen.getByRole("option", { name: itemName });

  act(() => {
    fireEvent.pointerDown(option, { clientX: 50, clientY: 50, pointerId: 1 });
  });
  act(() => {
    fireEvent.pointerMove(option, { clientX: 60, clientY: 60, pointerId: 1 });
  });

  const canvas = screen.getByRole("application", { name: /workflow canvas/i });
  act(() => {
    fireEvent.pointerUp(canvas, { clientX: dropX, clientY: dropY });
  });
}

describe("Integration — build 3-node chain via palette + canvas interactions", () => {
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = setupStore();
  });

  it("drag Start, Task, End from palette → connect via ports → graph has 3 nodes and 2 edges in chain", () => {
    render(<ThemeProvider><EditorPage /></ThemeProvider>);

    // 1. Drag all three node types from palette onto canvas
    dragPaletteItemToCanvas("Start", 100, 100);
    dragPaletteItemToCanvas("Task", 300, 100);
    dragPaletteItemToCanvas("End", 500, 100);

    // Verify all three nodes rendered on canvas
    expect(screen.getByTestId("rf-node-start")).toBeInTheDocument();
    expect(screen.getByTestId("rf-node-task")).toBeInTheDocument();
    expect(screen.getByTestId("rf-node-end")).toBeInTheDocument();

    // 2. Get node IDs from the store to wire connections
    const { result: storeResult } = renderHook(() => useWorkflowStore());
    const nodes = storeResult.current.nodes;
    expect(nodes).toHaveLength(3);

    const startNode = nodes.find((n) => n.kind === "start");
    const taskNode = nodes.find((n) => n.kind === "task");
    const endNode = nodes.find((n) => n.kind === "end");
    expect(startNode).toBeDefined();
    expect(taskNode).toBeDefined();
    expect(endNode).toBeDefined();

    // 3. Connect via ports (Phase 3 handles not yet available; use store API)
    //    start.out → task.in
    act(() => {
      const conn1 = storeResult.current.connectPorts({
        source: { nodeId: startNode?.id ?? "", portId: "out" },
        target: { nodeId: taskNode?.id ?? "", portId: "in" },
        registry,
      });
      expect(conn1.ok).toBe(true);
    });

    //    task.out → end.in
    act(() => {
      const conn2 = storeResult.current.connectPorts({
        source: { nodeId: taskNode?.id ?? "", portId: "out" },
        target: { nodeId: endNode?.id ?? "", portId: "in" },
        registry,
      });
      expect(conn2.ok).toBe(true);
    });

    // 4. Assert final graph shape
    const finalState = storeResult.current;
    expect(finalState.nodes).toHaveLength(3);
    expect(finalState.edges).toHaveLength(2);

    // Verify node kinds
    expect(finalState.nodes.map((n) => n.kind)).toEqual(["start", "task", "end"]);

    // Verify node positions from drag
    expect(finalState.nodes[0].position).toEqual({ x: 100, y: 100 });
    expect(finalState.nodes[1].position).toEqual({ x: 300, y: 100 });
    expect(finalState.nodes[2].position).toEqual({ x: 500, y: 100 });

    // Verify edge chain: start → task → end
    const edge1 = finalState.edges.find((e) => e.source === startNode?.id);
    expect(edge1).toBeDefined();
    expect(edge1?.target).toBe(taskNode?.id);
    expect(edge1?.sourcePort).toBe("out");
    expect(edge1?.targetPort).toBe("in");

    const edge2 = finalState.edges.find((e) => e.source === taskNode?.id);
    expect(edge2).toBeDefined();
    expect(edge2?.target).toBe(endNode?.id);
    expect(edge2?.sourcePort).toBe("out");
    expect(edge2?.targetPort).toBe("in");
  });

  it("edges render in the mock ReactFlow after connection", () => {
    render(<ThemeProvider><EditorPage /></ThemeProvider>);

    // Drag all three nodes
    dragPaletteItemToCanvas("Start", 50, 50);
    dragPaletteItemToCanvas("Task", 250, 50);
    dragPaletteItemToCanvas("End", 450, 50);

    // Connect via store
    const { result } = renderHook(() => useWorkflowStore());
    const nodes = result.current.nodes;
    const startNode = nodes.find((n) => n.kind === "start");
    const taskNode = nodes.find((n) => n.kind === "task");
    const endNode = nodes.find((n) => n.kind === "end");

    act(() => {
      result.current.connectPorts({
        source: { nodeId: startNode?.id ?? "", portId: "out" },
        target: { nodeId: taskNode?.id ?? "", portId: "in" },
        registry,
      });
      result.current.connectPorts({
        source: { nodeId: taskNode?.id ?? "", portId: "out" },
        target: { nodeId: endNode?.id ?? "", portId: "in" },
        registry,
      });
    });

    // Re-render to pick up edges
    cleanup();
    render(<ThemeProvider><EditorPage /></ThemeProvider>);

    // Edges should be rendered by the mock ReactFlow
    const edges = result.current.edges;
    expect(edges).toHaveLength(2);

    // Verify edge data attributes in rendered output
    const edgeEls = screen.getAllByTestId(/^rf-edge-/);
    expect(edgeEls).toHaveLength(2);

    // First edge: start → task
    const firstEdge = edgeEls.find((el) => el.getAttribute("data-edge-source") === startNode?.id);
    expect(firstEdge).toBeDefined();
    expect(firstEdge?.getAttribute("data-edge-target")).toBe(taskNode?.id);

    // Second edge: task → end
    const secondEdge = edgeEls.find((el) => el.getAttribute("data-edge-source") === taskNode?.id);
    expect(secondEdge).toBeDefined();
    expect(secondEdge?.getAttribute("data-edge-target")).toBe(endNode?.id);
  });

  it("rejects invalid connection in the user flow (end has no output port)", () => {
    render(<ThemeProvider><EditorPage /></ThemeProvider>);

    dragPaletteItemToCanvas("Start", 100, 100);
    dragPaletteItemToCanvas("End", 300, 100);

    const { result } = renderHook(() => useWorkflowStore());
    const nodes = result.current.nodes;
    const endNode = nodes.find((n) => n.kind === "end");
    const startNode = nodes.find((n) => n.kind === "start");

    // Try to connect end.out → start.out (invalid)
    let connectionResult: { ok: boolean };
    act(() => {
      connectionResult = result.current.connectPorts({
        source: { nodeId: endNode?.id ?? "", portId: "out" },
        target: { nodeId: startNode?.id ?? "", portId: "out" },
        registry,
      });
    });
    expect(connectionResult.ok).toBe(false);
    expect(result.current.edges).toHaveLength(0);
  });
});
