import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, renderHook } from "@testing-library/react";
import { useWorkflowStore } from "@/store/hooks";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { PropertyGrid } from "@/features/property-grid/PropertyGrid";

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
  it("PropertyGrid shows 'No node selected' when no inspector node set", () => {
    render(<PropertyGrid />);
    expect(screen.getByTestId("property-grid-empty")).toBeInTheDocument();
    expect(screen.getByTestId("property-grid-empty").textContent).toBe("No node selected");
  });

  it("PropertyGrid displays loop node condition when inspector is open", () => {
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

    // Open inspector
    act(() => {
      result.current.openInspector(nodeId);
    });

    render(<PropertyGrid />);

    expect(screen.getByTestId("property-grid-fields")).toBeInTheDocument();
    expect(screen.getByTestId("property-grid-kind").textContent).toContain("loop-while");
    // Default data from spec: { condition: "count < 10" }
    expect(screen.getByTestId("property-value-condition").textContent).toBe("count < 10");
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
      result.current.openInspector(nodeId);
    });

    const { rerender } = render(<PropertyGrid />);

    // Verify initial default data
    expect(screen.getByTestId("property-value-condition").textContent).toBe("count < 10");

    // Simulate what the inline editor does: updateNodeData with new condition
    act(() => {
      result.current.updateNodeData(nodeId, { condition: "y > 5" });
    });

    rerender(<PropertyGrid />);

    // PropertyGrid should now show the updated value
    expect(screen.getByTestId("property-value-condition").textContent).toBe("y > 5");
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
      result.current.openInspector(nodeId);
    });

    const { rerender } = render(<PropertyGrid />);

    expect(screen.getByTestId("property-value-iterable").textContent).toBe("items");
    expect(screen.getByTestId("property-value-item").textContent).toBe("x");

    // Simulate inline edit
    act(() => {
      result.current.updateNodeData(nodeId, { iterable: "users", item: "x" });
    });

    rerender(<PropertyGrid />);

    expect(screen.getByTestId("property-value-iterable").textContent).toBe("users");
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
