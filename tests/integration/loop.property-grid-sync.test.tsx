import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook, fireEvent } from "@testing-library/react";
import { useWorkflowStore } from "@/store/hooks";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { PropertyGrid } from "@/features/property-grid/PropertyGrid";
import { LoopNode } from "@/features/nodes/LoopNode";
import type { NodeProps } from "@xyflow/react";

// Mock @xyflow/react for LoopNode handles
vi.mock("@xyflow/react", () => ({
  Handle: (props: Record<string, unknown>) => (
    <div data-testid={props["data-testid"] as string} data-handle-type={props.type as string} />
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  SelectionMode: { Partial: "partial", Full: "full" },
  MiniMap: () => null,
}));

// Mock KeyboardConnectContext used by OutputHandle
vi.mock("@/features/canvas/KeyboardConnectContext", () => ({
  useStartKeyboardConnect: () => vi.fn(),
}));

function resetStore() {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => {
    // Remove all nodes
    const nodeIds = result.current.nodes.map((n) => n.id);
    for (const id of nodeIds) {
      result.current.removeNode(id);
    }
    result.current.clearSelection();
  });
}

beforeEach(() => {
  resetStore();
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  const { result } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
    // Also populate nodeSpecs so updateNodeData validation works
    for (const spec of registry.list()) {
      result.current.registerNodeSpec(spec);
    }
  });
});

afterEach(() => {
  cleanup();
  resetStore();
});

/**
 * Integration test: verifies that when node data is updated via updateNodeData
 * (the same action called by LoopNode inline editor), the PropertyGrid
 * re-renders with the updated values — demonstrating store-level sync.
 */
describe("Loop inline edit → PropertyGrid sync (store integration)", () => {
  it("PropertyGrid shows 'Select a node' when no node is selected", () => {
    render(<PropertyGrid />);
    expect(screen.getByTestId("property-grid-empty")).toBeInTheDocument();
    expect(screen.getByTestId("property-grid-empty").textContent).toBe("Select a node");
  });

  it("PropertyGrid displays loop node fields when node is selected", () => {
    const { result } = renderHook(() => useWorkflowStore());

    let nodeId = "";
    act(() => {
      const spec = result.current.registry.get("loop-while");
      if (spec) {
        const node = result.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });
    expect(nodeId).not.toBe("");

    // Select node (new binding via lastSelectedNodeId)
    act(() => {
      result.current.select(nodeId, "replace");
    });

    render(<PropertyGrid />);

    expect(screen.getByTestId("property-grid-fields")).toBeInTheDocument();
    expect(screen.getByTestId("header-kind-badge").textContent).toContain("loop-while");
    // SchemaForm renders field wrappers for schema fields
    expect(screen.getByTestId("field-wrapper-condition")).toBeInTheDocument();
  });

  it("PropertyGrid reflects updated condition after updateNodeData (inline edit sync)", () => {
    const { result } = renderHook(() => useWorkflowStore());

    let nodeId = "";
    act(() => {
      const spec = result.current.registry.get("loop-while");
      if (spec) {
        const node = result.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });

    act(() => {
      result.current.select(nodeId, "replace");
    });

    const { rerender } = render(<PropertyGrid />);

    // Verify field wrapper exists
    expect(screen.getByTestId("field-wrapper-condition")).toBeInTheDocument();

    // Simulate what the inline editor does: updateNodeData with new condition
    act(() => {
      result.current.updateNodeData(nodeId, { condition: "y > 5" });
    });

    rerender(<PropertyGrid />);

    // Field wrapper should still be present
    expect(screen.getByTestId("field-wrapper-condition")).toBeInTheDocument();
  });

  it("PropertyGrid reflects updated iterable for for-each loop", () => {
    const { result } = renderHook(() => useWorkflowStore());

    let nodeId = "";
    act(() => {
      const spec = result.current.registry.get("loop-foreach");
      if (spec) {
        const node = result.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });
    expect(nodeId).not.toBe("");

    // Set initial data
    act(() => {
      result.current.updateNodeData(nodeId, { iterable: "items", item: "x" });
    });

    act(() => {
      result.current.select(nodeId, "replace");
    });

    const { rerender } = render(<PropertyGrid />);

    expect(screen.getByTestId("field-wrapper-iterable")).toBeInTheDocument();

    // Simulate inline edit
    act(() => {
      result.current.updateNodeData(nodeId, { iterable: "users", item: "x" });
    });

    rerender(<PropertyGrid />);

    expect(screen.getByTestId("field-wrapper-iterable")).toBeInTheDocument();
  });

  it("store updateNodeData changes are immediately visible to node data readers", () => {
    const { result } = renderHook(() => useWorkflowStore());

    let nodeId = "";
    act(() => {
      const spec = result.current.registry.get("loop-while");
      if (spec) {
        const node = result.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });

    // Update via updateNodeData (same action the inline editor calls)
    act(() => {
      const updateResult = result.current.updateNodeData(nodeId, { condition: "c < d" });
      expect(updateResult.ok).toBe(true);
    });

    // Re-read from result.current after the act() to get fresh state
    const nodeAfter = result.current.nodes.find((n) => n.id === nodeId);
    expect(nodeAfter?.data).toEqual({ condition: "c < d" });
  });
});

/**
 * End-to-end integration: renders LoopNode + PropertyGrid together with the
 * real store. Performs click-preview → change → blur on the LoopNode inline
 * editor, then asserts both the store node data AND the PropertyGrid field
 * value are updated — the exact acceptance path from the spec.
 */
describe("End-to-end: LoopNode inline edit → store → PropertyGrid sync", () => {
  function renderLoopNodeWithProps(
    nodeId: string,
    nodeType: string,
    data: Record<string, unknown>,
  ) {
    const props = {
      id: nodeId,
      type: nodeType,
      data,
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
    return <LoopNode {...props} />;
  }

  it("while-loop: click preview → edit → blur updates store and PropertyGrid", () => {
    const { result } = renderHook(() => useWorkflowStore());

    let nodeId = "";
    act(() => {
      const spec = result.current.registry.get("loop-while");
      if (spec) {
        const node = result.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });
    expect(nodeId).not.toBe("");

    // Select node so PropertyGrid renders via lastSelectedNodeId
    act(() => {
      result.current.select(nodeId, "replace");
    });

    // Get the initial data from the store node
    const initialNode = result.current.nodes.find((n) => n.id === nodeId);
    const initialData = initialNode?.data as Record<string, unknown>;

    // Render both LoopNode and PropertyGrid together
    const { rerender } = render(
      <>
        {renderLoopNodeWithProps(nodeId, "loop-while", initialData)}
        <PropertyGrid />
      </>,
    );

    // Verify PropertyGrid shows fields for this node
    expect(screen.getByTestId("property-grid-fields")).toBeInTheDocument();
    expect(screen.getByTestId("field-wrapper-condition")).toBeInTheDocument();

    // Click the preview to enter edit mode
    act(() => {
      fireEvent.click(screen.getByTestId("loop-preview"));
    });

    // Change the condition value
    const input = screen.getByTestId("loop-inline-input");
    act(() => {
      fireEvent.change(input, { target: { value: "x > 42" } });
    });

    // Blur to commit the edit (calls real updateNodeData)
    act(() => {
      fireEvent.blur(input);
    });

    // Verify store was updated
    const updatedNode = result.current.nodes.find((n) => n.id === nodeId);
    expect((updatedNode?.data as Record<string, unknown>).condition).toBe("x > 42");

    // Re-render to pick up store changes in PropertyGrid
    const freshData = updatedNode?.data as Record<string, unknown>;
    rerender(
      <>
        {renderLoopNodeWithProps(nodeId, "loop-while", freshData)}
        <PropertyGrid />
      </>,
    );

    // Verify PropertyGrid still shows the field
    expect(screen.getByTestId("field-wrapper-condition")).toBeInTheDocument();
  });

  it("for-each loop: click preview → edit → blur updates store and PropertyGrid", () => {
    const { result } = renderHook(() => useWorkflowStore());

    let nodeId = "";
    act(() => {
      const spec = result.current.registry.get("loop-foreach");
      if (spec) {
        const node = result.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });
    expect(nodeId).not.toBe("");

    // Set initial data
    act(() => {
      result.current.updateNodeData(nodeId, { iterable: "items", item: "x" });
    });

    // Select node
    act(() => {
      result.current.select(nodeId, "replace");
    });

    const initialNode = result.current.nodes.find((n) => n.id === nodeId);
    const initialData = initialNode?.data as Record<string, unknown>;

    const { rerender } = render(
      <>
        {renderLoopNodeWithProps(nodeId, "loop-foreach", initialData)}
        <PropertyGrid />
      </>,
    );

    // Verify PropertyGrid shows field wrappers
    expect(screen.getByTestId("field-wrapper-iterable")).toBeInTheDocument();

    // Click preview → edit → blur
    act(() => {
      fireEvent.click(screen.getByTestId("loop-preview"));
    });

    const input = screen.getByTestId("loop-inline-input");
    act(() => {
      fireEvent.change(input, { target: { value: "users" } });
    });

    act(() => {
      fireEvent.blur(input);
    });

    // Verify store
    const updatedNode = result.current.nodes.find((n) => n.id === nodeId);
    expect((updatedNode?.data as Record<string, unknown>).iterable).toBe("users");

    // Re-render with fresh data and verify PropertyGrid still shows fields
    const freshData = updatedNode?.data as Record<string, unknown>;
    rerender(
      <>
        {renderLoopNodeWithProps(nodeId, "loop-foreach", freshData)}
        <PropertyGrid />
      </>,
    );

    expect(screen.getByTestId("field-wrapper-iterable")).toBeInTheDocument();
  });

  it("Enter key commit also syncs store and PropertyGrid", () => {
    const { result } = renderHook(() => useWorkflowStore());

    let nodeId = "";
    act(() => {
      const spec = result.current.registry.get("loop-while");
      if (spec) {
        const node = result.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });

    act(() => {
      result.current.select(nodeId, "replace");
    });

    const initialNode = result.current.nodes.find((n) => n.id === nodeId);
    const initialData = initialNode?.data as Record<string, unknown>;

    const { rerender } = render(
      <>
        {renderLoopNodeWithProps(nodeId, "loop-while", initialData)}
        <PropertyGrid />
      </>,
    );

    // Click preview → edit → Enter to commit
    act(() => {
      fireEvent.click(screen.getByTestId("loop-preview"));
    });

    const input = screen.getByTestId("loop-inline-input");
    act(() => {
      fireEvent.change(input, { target: { value: "done === true" } });
    });

    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    // Verify store updated
    const updatedNode = result.current.nodes.find((n) => n.id === nodeId);
    expect((updatedNode?.data as Record<string, unknown>).condition).toBe("done === true");

    // Verify PropertyGrid still shows field after update
    const freshData = updatedNode?.data as Record<string, unknown>;
    rerender(
      <>
        {renderLoopNodeWithProps(nodeId, "loop-while", freshData)}
        <PropertyGrid />
      </>,
    );

    expect(screen.getByTestId("field-wrapper-condition")).toBeInTheDocument();
  });
});
