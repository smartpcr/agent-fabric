import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  renderHook,
  act,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { useWorkflowStore } from "@/store/hooks";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { PropertyGrid } from "@/features/property-grid/PropertyGrid";
import { TaskNode } from "@/features/nodes/TaskNode";
import type { NodeProps } from "@xyflow/react";

// Mock @monaco-editor/react to avoid Monaco in tests
vi.mock("@monaco-editor/react", () => ({
  default: function MockMonacoEditor() {
    return <div data-testid="mock-monaco" />;
  },
}));

// Mock @xyflow/react — provide Handle + Position used by TaskNode
vi.mock("@xyflow/react", () => ({
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

function resetStore() {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => {
    const nodeIds = result.current.nodes.map((n) => n.id);
    for (const id of nodeIds) {
      result.current.removeNode(id);
    }
    result.current.clearSelection();
  });
}

function setupRegistry() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  const { result } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
    for (const spec of registry.list()) {
      result.current.registerNodeSpec(spec);
    }
  });
}

beforeEach(() => {
  resetStore();
  setupRegistry();
});

afterEach(() => {
  cleanup();
  resetStore();
});

/**
 * Renders a real TaskNode reading live data from the store.
 * Mirrors the runtime path: store node data → TaskNode → BaseNode title.
 */
function StoreTaskNode({ nodeId }: { readonly nodeId: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
  if (!node) return null;
  const props: NodeProps = {
    id: node.id,
    type: node.kind,
    data: node.data,
    selected: false,
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    deletable: true,
    selectable: true,
    parentId: undefined,
    sourcePosition: undefined,
    targetPosition: undefined,
    dragHandle: undefined,
  } as unknown as NodeProps;
  return <TaskNode {...props} />;
}

describe("PropertyGrid → TaskNode live update (300ms debounce)", () => {
  it("does NOT update TaskNode header before 300ms debounce fires", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    let nodeId = "";
    act(() => {
      const spec = store.current.registry.get("task");
      if (spec) {
        nodeId = store.current.addNode(spec, { x: 0, y: 0 }).id;
      }
    });

    act(() => {
      store.current.select(nodeId, "replace");
    });

    render(
      <>
        <PropertyGrid />
        <StoreTaskNode nodeId={nodeId} />
      </>,
    );

    // Wait for PropertyGrid fields
    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Verify initial header
    const header = screen.getByTestId("node-header");
    expect(header.textContent).toContain("Task");

    // Switch to fake timers for debounce testing
    vi.useFakeTimers();

    // Edit the name field
    act(() => {
      fireEvent.change(screen.getByTestId("field-name"), {
        target: { value: "Delayed Name" },
      });
    });

    // Advance only 200ms — store should NOT have updated yet
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Header should still show the original name
    expect(screen.getByTestId("node-header").textContent).toContain("Task");
    expect(screen.getByTestId("node-header").textContent).not.toContain("Delayed Name");

    // Store data should also be unchanged
    const nodeBeforeDebounce = store.current.nodes.find((n) => n.id === nodeId);
    expect((nodeBeforeDebounce?.data as Record<string, unknown>).name).toBe("Task");

    // Cleanup
    act(() => {
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();
  });

  it("updates TaskNode header AFTER 300ms debounce fires", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    let nodeId = "";
    act(() => {
      const spec = store.current.registry.get("task");
      if (spec) {
        nodeId = store.current.addNode(spec, { x: 0, y: 0 }).id;
      }
    });

    act(() => {
      store.current.select(nodeId, "replace");
    });

    render(
      <>
        <PropertyGrid />
        <StoreTaskNode nodeId={nodeId} />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    expect(screen.getByTestId("node-header").textContent).toContain("Task");

    // Switch to fake timers for debounce testing
    vi.useFakeTimers();

    // Edit the name field
    act(() => {
      fireEvent.change(screen.getByTestId("field-name"), {
        target: { value: "Updated Name" },
      });
    });

    // Advance past the 300ms debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    vi.useRealTimers();

    // Now the store should have updated and TaskNode header should reflect the new name
    await waitFor(() => {
      expect(screen.getByTestId("node-header").textContent).toContain("Updated Name");
    });

    // Verify store data also updated
    const updatedNode = store.current.nodes.find((n) => n.id === nodeId);
    expect((updatedNode?.data as Record<string, unknown>).name).toBe("Updated Name");
  });

  it("debounce resets on rapid sequential edits — only last value committed", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    let nodeId = "";
    act(() => {
      const spec = store.current.registry.get("task");
      if (spec) {
        nodeId = store.current.addNode(spec, { x: 0, y: 0 }).id;
      }
    });

    act(() => {
      store.current.select(nodeId, "replace");
    });

    render(
      <>
        <PropertyGrid />
        <StoreTaskNode nodeId={nodeId} />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Switch to fake timers for debounce testing
    vi.useFakeTimers();

    // Type "A", wait 100ms, type "AB", wait 100ms, type "ABC"
    act(() => {
      fireEvent.change(screen.getByTestId("field-name"), { target: { value: "A" } });
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      fireEvent.change(screen.getByTestId("field-name"), { target: { value: "AB" } });
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      fireEvent.change(screen.getByTestId("field-name"), { target: { value: "ABC" } });
    });

    // After 200ms total since last change — NOT yet committed
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId("node-header").textContent).toContain("Task");

    // After 300ms from last change — committed with "ABC"
    act(() => {
      vi.advanceTimersByTime(100);
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("node-header").textContent).toContain("ABC");
    });

    // Store should have the final value, not intermediate ones
    const finalNode = store.current.nodes.find((n) => n.id === nodeId);
    expect((finalNode?.data as Record<string, unknown>).name).toBe("ABC");
  });

  it("changing selection shows correct header without debounce interference", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    let nodeId1 = "";
    let nodeId2 = "";
    act(() => {
      const spec = store.current.registry.get("task");
      if (spec) {
        nodeId1 = store.current.addNode(spec, { x: 0, y: 0 }).id;
        nodeId2 = store.current.addNode(spec, { x: 100, y: 0 }).id;
      }
    });

    // Give second node a distinct name
    act(() => {
      store.current.updateNodeData(nodeId2, { name: "Node B", params: {}, apiKey: "" });
    });

    // Select first node
    act(() => {
      store.current.select(nodeId1, "replace");
    });

    /** Renders the TaskNode for the currently selected node. */
    function SelectedTaskNode() {
      const selectedId = useWorkflowStore((s) => s.lastSelectedNodeId);
      const matchedNode = useWorkflowStore((s) =>
        selectedId ? s.nodes.find((n) => n.id === selectedId) : undefined,
      );
      if (!matchedNode) return null;
      return <StoreTaskNode nodeId={matchedNode.id} />;
    }

    render(
      <>
        <PropertyGrid />
        <SelectedTaskNode />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // First node header shows "Task"
    expect(screen.getByTestId("node-header").textContent).toContain("Task");

    // Switch selection to second node
    act(() => {
      store.current.select(nodeId2, "replace");
    });

    // Header should show "Node B" — selection changes don't require debounce
    await waitFor(() => {
      expect(screen.getByTestId("node-header").textContent).toContain("Node B");
    });
  });
});
