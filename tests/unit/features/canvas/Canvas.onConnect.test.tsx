import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { MultiPortTaskNodeSpec } from "@/registry/builtins/MultiPortTaskNode.spec";
import { useWorkflowStore } from "@/store/hooks";

// Capture the onConnect handler passed to ReactFlow
let capturedOnConnect: ((connection: Record<string, unknown>) => void) | null = null;

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    onConnect,
  }: {
    children?: ReactNode;
    onConnect?: (connection: Record<string, unknown>) => void;
  }) => {
    capturedOnConnect = onConnect ?? null;
    return <div data-testid="mock-reactflow">{children}</div>;
  },
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
  }),
  SelectionMode: { Partial: "partial", Full: "full" },
  MiniMap: () => null,
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

vi.mock("@/features/canvas/Background", () => ({
  Background: () => <div data-testid="mock-background" />,
}));

afterEach(() => {
  cleanup();
  capturedOnConnect = null;
});

function setupStoreWithMultiPort() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  registry.register(MultiPortTaskNodeSpec);

  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
    // Clear existing nodes
    for (const node of result.current.nodes) {
      result.current.removeNode(node.id);
    }
  });
  unmount();
}

function addMultiPortNodes(): { sourceId: string; targetId: string } {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  let sourceId = "";
  let targetId = "";
  act(() => {
    const source = result.current.addNode(MultiPortTaskNodeSpec, { x: 0, y: 0 });
    const target = result.current.addNode(MultiPortTaskNodeSpec, { x: 200, y: 200 });
    sourceId = source.id;
    targetId = target.id;
  });
  unmount();
  return { sourceId, targetId };
}

function getStoreEdges() {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const edges = result.current.edges;
  unmount();
  return edges;
}

function renderCanvas() {
  return render(
    <DragProvider>
      <Canvas />
    </DragProvider>,
  );
}

describe("Canvas onConnect", () => {
  beforeEach(() => {
    setupStoreWithMultiPort();
  });

  it("passes onConnect to ReactFlow", () => {
    renderCanvas();
    expect(capturedOnConnect).toBeTypeOf("function");
  });

  it("creates an edge when a valid connection is made", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvas();

    expect(getStoreEdges()).toHaveLength(0);

    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outA",
        target: targetId,
        targetHandle: "inA",
      });
    });

    const edges = getStoreEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0]?.source).toBe(sourceId);
    expect(edges[0]?.sourcePort).toBe("outA");
    expect(edges[0]?.target).toBe(targetId);
    expect(edges[0]?.targetPort).toBe("inA");
  });

  it("persists edge with correct port ids for json → json connection", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvas();

    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outB",
        target: targetId,
        targetHandle: "inB",
      });
    });

    const edges = getStoreEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0]?.sourcePort).toBe("outB");
    expect(edges[0]?.targetPort).toBe("inB");
  });

  it("does not create an edge for incompatible data types", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvas();

    // outA is string, inB is json — incompatible (strict matching, not any)
    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outA",
        target: targetId,
        targetHandle: "inB",
      });
    });

    expect(getStoreEdges()).toHaveLength(0);
  });

  it("ignores connection with missing source", () => {
    addMultiPortNodes();
    renderCanvas();

    act(() => {
      capturedOnConnect?.({
        source: null,
        sourceHandle: "outA",
        target: "some-id",
        targetHandle: "inA",
      });
    });

    expect(getStoreEdges()).toHaveLength(0);
  });

  it("ignores connection with missing target", () => {
    addMultiPortNodes();
    renderCanvas();

    act(() => {
      capturedOnConnect?.({
        source: "some-id",
        sourceHandle: "outA",
        target: null,
        targetHandle: "inA",
      });
    });

    expect(getStoreEdges()).toHaveLength(0);
  });

  it("falls back to 'out' and 'in' when handles are null", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvas();

    // outC is "any" type which connects to anything, but default handles "out"/"in"
    // don't exist on multi-port nodes, so this should fail validation (port not found)
    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: null,
        target: targetId,
        targetHandle: null,
      });
    });

    // "out" and "in" are the default port ids for regular task nodes
    // For multi-port nodes, these ports don't exist, so the connection should fail
    expect(getStoreEdges()).toHaveLength(0);
  });

  it("allows multiple valid connections between different ports", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvas();

    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outA",
        target: targetId,
        targetHandle: "inA",
      });
    });

    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outB",
        target: targetId,
        targetHandle: "inB",
      });
    });

    const edges = getStoreEdges();
    expect(edges).toHaveLength(2);
  });

  it("rejects duplicate connection to single-cardinality port", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvas();

    // First connection succeeds
    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outA",
        target: targetId,
        targetHandle: "inA",
      });
    });
    expect(getStoreEdges()).toHaveLength(1);

    // Second connection to same target port should be rejected (single cardinality)
    act(() => {
      capturedOnConnect?.({
        source: sourceId,
        sourceHandle: "outC",
        target: targetId,
        targetHandle: "inA",
      });
    });
    expect(getStoreEdges()).toHaveLength(1);
  });
});
