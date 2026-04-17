import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";
import { nodeTypes } from "@/features/canvas/nodeTypes";

// Track nodes and nodeTypes passed to ReactFlow
let capturedNodeTypes: Record<string, unknown> | undefined;
let capturedNodes: Array<{ id: string; type?: string; kind?: string; data: unknown }> | undefined;

// Mock @xyflow/react — resolve renderer strictly from node.type (like real xyflow)
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    nodes,
    nodeTypes: nt,
  }: {
    children?: ReactNode;
    nodes?: Array<{
      id: string;
      type?: string;
      data: unknown;
      position: { x: number; y: number };
    }>;
    nodeTypes?: Record<string, unknown>;
  }) => {
    capturedNodeTypes = nt;
    capturedNodes = nodes;
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
}));

// Mock Background
vi.mock("@/features/canvas/Background", () => ({
  Background: () => <div data-testid="mock-background" />,
}));

// Mock store selector for TaskNode's spec lookup
vi.mock("@/store/selectors/graphSelectors", () => ({
  selectNodeSpec: () => ({ icon: "cog" }),
}));

afterEach(() => {
  cleanup();
  capturedNodeTypes = undefined;
  capturedNodes = undefined;
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

describe("nodeTypes", () => {
  it("exports start, end, and task entries", () => {
    expect(nodeTypes).toHaveProperty("start");
    expect(nodeTypes).toHaveProperty("end");
    expect(nodeTypes).toHaveProperty("task");
    expect(Object.keys(nodeTypes)).toHaveLength(3);
  });
});

describe("Canvas with nodeTypes", () => {
  it("passes nodeTypes to ReactFlow", () => {
    setupStore();
    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );
    expect(capturedNodeTypes).toBeDefined();
    expect(capturedNodeTypes).toHaveProperty("start");
    expect(capturedNodeTypes).toHaveProperty("end");
    expect(capturedNodeTypes).toHaveProperty("task");
  });

  it("maps store nodes with kind to xyflow nodes with type", () => {
    setupStore();
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      result.current.addNode(result.current.registry.resolve("start"), { x: 0, y: 0 });
      result.current.addNode(result.current.registry.resolve("task"), { x: 100, y: 100 });
    });
    unmount();

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );
    expect(capturedNodes).toBeDefined();
    expect(capturedNodes).toHaveLength(2);
    for (const n of capturedNodes ?? []) {
      expect(n.type).toBeDefined();
      expect(typeof n.type).toBe("string");
    }
    expect(capturedNodes?.[0]?.type).toBe("start");
    expect(capturedNodes?.[1]?.type).toBe("task");
  });

  it("renders StartNode for a node of type 'start'", () => {
    setupStore();
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      const spec = result.current.registry.resolve("start");
      result.current.addNode(spec, { x: 0, y: 0 });
    });
    unmount();

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );
    expect(screen.getByRole("group", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByTestId("start-handle-bottom")).toBeInTheDocument();
  });

  it("renders EndNode for a node of type 'end'", () => {
    setupStore();
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      const spec = result.current.registry.resolve("end");
      result.current.addNode(spec, { x: 0, y: 0 });
    });
    unmount();

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );
    expect(screen.getByRole("group", { name: "End" })).toBeInTheDocument();
    expect(screen.getByTestId("end-handle-top")).toBeInTheDocument();
  });

  it("renders TaskNode for a node of type 'task'", () => {
    setupStore();
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      const spec = result.current.registry.resolve("task");
      result.current.addNode(spec, { x: 0, y: 0 });
    });
    unmount();

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );
    expect(screen.getByRole("group", { name: "Task" })).toBeInTheDocument();
    expect(screen.getByTestId("task-handle-top")).toBeInTheDocument();
    expect(screen.getByTestId("task-handle-bottom")).toBeInTheDocument();
  });

  it("renders all three node types simultaneously", () => {
    setupStore();
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      result.current.addNode(result.current.registry.resolve("start"), { x: 0, y: 0 });
      result.current.addNode(result.current.registry.resolve("task"), { x: 100, y: 100 });
      result.current.addNode(result.current.registry.resolve("end"), { x: 200, y: 200 });
    });
    unmount();

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );
    expect(screen.getByRole("group", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Task" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "End" })).toBeInTheDocument();
  });
});
