import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, renderHook, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

// Mock @xyflow/react — render node components so Tab/Enter work in jsdom
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
  }) => (
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
  act(() => {
    result.current.setRegistry(registry);
    for (const node of result.current.nodes) {
      result.current.removeNode(node.id);
    }
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

describe("Accessible node focus (keyboard)", () => {
  it("Tab moves focus between nodes in DOM order", async () => {
    setupStore();
    const [id1, id2] = addNodes("start", "task");
    const user = userEvent.setup();

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    const allNodes = screen.getAllByTestId("base-node");
    expect(allNodes).toHaveLength(2);

    // Tab into the first focusable node
    await user.tab();
    expect(document.activeElement).toBe(allNodes[0]);
    expect(allNodes[0].getAttribute("data-node-id")).toBe(id1);

    // Tab to the second node
    await user.tab();
    expect(document.activeElement).toBe(allNodes[1]);
    expect(allNodes[1].getAttribute("data-node-id")).toBe(id2);
  });

  it("Tab twice focuses the second node", async () => {
    setupStore();
    addNodes("start", "task", "end");
    const user = userEvent.setup();

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    const allNodes = screen.getAllByTestId("base-node");
    expect(allNodes).toHaveLength(3);

    // Tab to first node
    await user.tab();
    expect(document.activeElement).toBe(allNodes[0]);

    // Tab to second node
    await user.tab();
    expect(document.activeElement).toBe(allNodes[1]);
  });

  it("focus ring is visible on focused node", () => {
    setupStore();
    addNodes("start");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    const node = screen.getByTestId("base-node");

    act(() => {
      fireEvent.focus(node);
    });

    expect(node.style.boxShadow).toContain("rgba(59,130,246,0.4)");
  });

  it("Enter on focused node dispatches openInspector(nodeId)", () => {
    setupStore();
    const [id1] = addNodes("start");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    const node = screen.getByTestId("base-node");

    act(() => {
      node.focus();
    });

    act(() => {
      fireEvent.keyDown(node, { key: "Enter" });
    });

    // Check that inspectorNodeId was set in store
    const { result, unmount } = renderHook(() => useWorkflowStore());
    expect(result.current.inspectorNodeId).toBe(id1);
    unmount();
  });

  it("Enter on second node calls openInspector with correct nodeId", () => {
    setupStore();
    const [, id2] = addNodes("start", "task");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    const allNodes = screen.getAllByTestId("base-node");

    act(() => {
      allNodes[1].focus();
    });

    act(() => {
      fireEvent.keyDown(allNodes[1], { key: "Enter" });
    });

    const { result, unmount } = renderHook(() => useWorkflowStore());
    expect(result.current.inspectorNodeId).toBe(id2);
    unmount();
  });

  it("nodes have tabIndex=0 for keyboard focusability", () => {
    setupStore();
    addNodes("start", "end");

    render(
      <DragProvider>
        <Canvas />
      </DragProvider>,
    );

    const allNodes = screen.getAllByTestId("base-node");
    for (const node of allNodes) {
      expect(node.tabIndex).toBe(0);
    }
  });
});
