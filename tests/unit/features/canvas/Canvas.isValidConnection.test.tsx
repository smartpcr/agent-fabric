import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { ToastProvider } from "@/features/editor/Toast";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { MultiPortTaskNodeSpec } from "@/registry/builtins/MultiPortTaskNode.spec";
import { useWorkflowStore } from "@/store/hooks";

// Capture the isValidConnection callback passed to ReactFlow
let capturedIsValidConnection: ((connection: Record<string, unknown>) => boolean) | null = null;

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    isValidConnection,
  }: {
    children?: ReactNode;
    isValidConnection?: (connection: Record<string, unknown>) => boolean;
  }) => {
    capturedIsValidConnection = isValidConnection ?? null;
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
  capturedIsValidConnection = null;
});

function setupStoreWithMultiPort() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  registry.register(MultiPortTaskNodeSpec);

  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
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

function renderCanvas() {
  return render(
    <ToastProvider>
      <DragProvider>
        <Canvas />
      </DragProvider>
    </ToastProvider>,
  );
}

describe("Canvas isValidConnection", () => {
  beforeEach(() => {
    setupStoreWithMultiPort();
  });

  it("passes isValidConnection to ReactFlow", () => {
    renderCanvas();
    expect(capturedIsValidConnection).toBeTypeOf("function");
  });

  it("returns true for compatible ports (string → string)", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvas();

    const result = capturedIsValidConnection?.({
      source: sourceId,
      sourceHandle: "outA",
      target: targetId,
      targetHandle: "inA",
    });

    expect(result).toBe(true);
  });

  it("returns true for compatible ports (json → json)", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvas();

    const result = capturedIsValidConnection?.({
      source: sourceId,
      sourceHandle: "outB",
      target: targetId,
      targetHandle: "inB",
    });

    expect(result).toBe(true);
  });

  it("returns true for any → string (any is assignable to everything)", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvas();

    const result = capturedIsValidConnection?.({
      source: sourceId,
      sourceHandle: "outC", // dataType: any
      target: targetId,
      targetHandle: "inA", // dataType: string
    });

    expect(result).toBe(true);
  });

  it("returns false for incompatible types (string → json)", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvas();

    const result = capturedIsValidConnection?.({
      source: sourceId,
      sourceHandle: "outA", // dataType: string
      target: targetId,
      targetHandle: "inB", // dataType: json
    });

    expect(result).toBe(false);
  });

  it("returns false when source is null", () => {
    addMultiPortNodes();
    renderCanvas();

    const result = capturedIsValidConnection?.({
      source: null,
      sourceHandle: "outA",
      target: "any",
      targetHandle: "inA",
    });

    expect(result).toBe(false);
  });

  it("returns false when target is null", () => {
    addMultiPortNodes();
    renderCanvas();

    const result = capturedIsValidConnection?.({
      source: "any",
      sourceHandle: "outA",
      target: null,
      targetHandle: "inA",
    });

    expect(result).toBe(false);
  });

  it("returns false when source node does not exist in graph", () => {
    addMultiPortNodes();
    renderCanvas();

    const result = capturedIsValidConnection?.({
      source: "nonexistent-node",
      sourceHandle: "outA",
      target: "another-nonexistent",
      targetHandle: "inA",
    });

    expect(result).toBe(false);
  });

  it("returns false when port id does not exist on spec", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvas();

    const result = capturedIsValidConnection?.({
      source: sourceId,
      sourceHandle: "nonexistent-port",
      target: targetId,
      targetHandle: "inA",
    });

    expect(result).toBe(false);
  });

  it("returns false when connecting input to input (wrong direction)", () => {
    const { sourceId, targetId } = addMultiPortNodes();
    renderCanvas();

    // inA is an input port on source; inA is an input port on target
    const result = capturedIsValidConnection?.({
      source: sourceId,
      sourceHandle: "inA",
      target: targetId,
      targetHandle: "inA",
    });

    expect(result).toBe(false);
  });

  it("returns false for single-cardinality port with existing inbound edge", () => {
    const { sourceId, targetId } = addMultiPortNodes();

    // Pre-create an edge to inA on the target node
    const { result: storeResult, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      storeResult.current.tryConnect({
        source: sourceId,
        sourcePort: "outA",
        target: targetId,
        targetPort: "inA",
      });
    });
    unmount();

    renderCanvas();

    // Now trying to connect another source to the same inA target port
    const result = capturedIsValidConnection?.({
      source: sourceId,
      sourceHandle: "outC", // dataType: any — assignable to string
      target: targetId,
      targetHandle: "inA",
    });

    expect(result).toBe(false);
  });

  it("uses current store state (reflects newly added edges)", () => {
    const { sourceId, targetId } = addMultiPortNodes();

    // First render — outA→inA should be valid
    const { unmount: unmountCanvas } = renderCanvas();

    expect(
      capturedIsValidConnection?.({
        source: sourceId,
        sourceHandle: "outA",
        target: targetId,
        targetHandle: "inA",
      }),
    ).toBe(true);

    unmountCanvas();

    // Connect outA→inA via store
    const { result: storeResult, unmount: unmountStore } = renderHook(() => useWorkflowStore());
    act(() => {
      storeResult.current.tryConnect({
        source: sourceId,
        sourcePort: "outA",
        target: targetId,
        targetPort: "inA",
      });
    });
    unmountStore();

    // Re-render — now inA is occupied (single cardinality), should be invalid
    renderCanvas();

    expect(
      capturedIsValidConnection?.({
        source: sourceId,
        sourceHandle: "outC",
        target: targetId,
        targetHandle: "inA",
      }),
    ).toBe(false);
  });
});
