import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, renderHook, act, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { ToastProvider } from "@/features/editor/Toast";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore, useTemporalStore } from "@/store/hooks";
import { HISTORY_GROUP_DELAY } from "@/store/historyGroup";

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-reactflow">{children}</div>
  ),
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
  MiniMap: () => null,
}));

vi.mock("@/features/canvas/Background", () => ({
  Background: () => <div data-testid="mock-background" />,
}));

vi.mock("@/store/selectors/graphSelectors", () => ({
  selectNodeSpec: () => ({ icon: "cog" }),
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
    result.current.clear();
    temporal.current.clear();
  });
  unmount();
  unmountTemporal();
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

function selectNodes(...ids: string[]) {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.selectMany(ids);
  });
  unmount();
}

function getNodes() {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const nodes = result.current.nodes;
  unmount();
  return nodes;
}

function getEdges() {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const edges = result.current.edges;
  unmount();
  return edges;
}

function getSelected(): Set<string> {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const selected = result.current.selected;
  unmount();
  return selected;
}

function connectNodes(sourceId: string, targetId: string) {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.connectPorts({
      source: { nodeId: sourceId, portId: "out" },
      target: { nodeId: targetId, portId: "in" },
      registry: result.current.registry,
    });
  });
  unmount();
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

describe("Delete / Backspace removes selected nodes + edges", () => {
  function flush(): void {
    vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Delete key removes 2 selected nodes", () => {
    setupStore();
    const [id1, id2, id3] = addNodesAt(
      { kind: "start", x: 0, y: 0 },
      { kind: "task", x: 100, y: 0 },
      { kind: "end", x: 200, y: 0 },
    );

    selectNodes(id1, id2);
    renderCanvas();

    const canvas = screen.getByRole("application");
    fireEvent.keyDown(canvas, { key: "Delete" });

    const nodes = getNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(id3);
  });

  it("Backspace key also removes selected nodes", () => {
    setupStore();
    const [id1, id2] = addNodesAt({ kind: "start", x: 0, y: 0 }, { kind: "task", x: 100, y: 0 });

    selectNodes(id1);
    renderCanvas();

    const canvas = screen.getByRole("application");
    fireEvent.keyDown(canvas, { key: "Backspace" });

    const nodes = getNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(id2);
  });

  it("connected edges are removed when source node is deleted", () => {
    setupStore();
    const [id1, id2] = addNodesAt({ kind: "start", x: 0, y: 0 }, { kind: "task", x: 100, y: 0 });
    connectNodes(id1, id2);
    expect(getEdges()).toHaveLength(1);

    selectNodes(id1);
    renderCanvas();

    const canvas = screen.getByRole("application");
    fireEvent.keyDown(canvas, { key: "Delete" });

    expect(getNodes()).toHaveLength(1);
    expect(getEdges()).toHaveLength(0);
  });

  it("selection is cleared after deletion", () => {
    setupStore();
    const [id1, id2] = addNodesAt({ kind: "start", x: 0, y: 0 }, { kind: "task", x: 100, y: 0 });

    selectNodes(id1, id2);
    expect(getSelected().size).toBe(2);

    renderCanvas();
    const canvas = screen.getByRole("application");
    fireEvent.keyDown(canvas, { key: "Delete" });

    expect(getSelected().size).toBe(0);
  });

  it("Delete with no selection does nothing", () => {
    setupStore();
    addNodesAt({ kind: "start", x: 0, y: 0 }, { kind: "task", x: 100, y: 0 });

    renderCanvas();
    const canvas = screen.getByRole("application");
    fireEvent.keyDown(canvas, { key: "Delete" });

    expect(getNodes()).toHaveLength(2);
  });

  it("undo restores both deleted nodes in a single step", () => {
    setupStore();
    const [id1, id2, id3] = addNodesAt(
      { kind: "start", x: 0, y: 0 },
      { kind: "task", x: 100, y: 0 },
      { kind: "end", x: 200, y: 0 },
    );

    expect(getNodes()).toHaveLength(3);

    selectNodes(id1, id2);

    renderCanvas();
    const canvas = screen.getByRole("application");
    act(() => {
      flush();
      fireEvent.keyDown(canvas, { key: "Delete" });
    });

    expect(getNodes()).toHaveLength(1);

    // Undo — single step should restore both nodes
    const { result: temporal, unmount } = renderHook(() => useTemporalStore());
    act(() => {
      flush();
      temporal.current.undo();
    });
    unmount();

    const restoredNodes = getNodes();
    expect(restoredNodes).toHaveLength(3);
    const restoredIds = restoredNodes.map((n) => n.id);
    expect(restoredIds).toContain(id1);
    expect(restoredIds).toContain(id2);
    expect(restoredIds).toContain(id3);
  });

  it("undo restores deleted edges along with nodes", () => {
    setupStore();
    const [id1, id2] = addNodesAt({ kind: "start", x: 0, y: 0 }, { kind: "task", x: 100, y: 0 });
    connectNodes(id1, id2);
    expect(getEdges()).toHaveLength(1);

    selectNodes(id1);
    renderCanvas();

    const canvas = screen.getByRole("application");
    act(() => {
      flush();
      fireEvent.keyDown(canvas, { key: "Delete" });
    });

    expect(getNodes()).toHaveLength(1);
    expect(getEdges()).toHaveLength(0);

    // Undo — should restore node and edge
    const { result: temporal, unmount } = renderHook(() => useTemporalStore());
    act(() => {
      flush();
      temporal.current.undo();
    });
    unmount();

    expect(getNodes()).toHaveLength(2);
    expect(getEdges()).toHaveLength(1);
  });
});
