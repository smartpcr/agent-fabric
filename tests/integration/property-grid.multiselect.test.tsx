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
import {
  PropertyGrid,
  MIXED_SENTINEL,
  computeCommonValues,
} from "@/features/property-grid/PropertyGrid";

// Mock @monaco-editor/react to avoid Monaco in tests
vi.mock("@monaco-editor/react", () => ({
  default: function MockMonacoEditor() {
    return <div data-testid="mock-monaco" />;
  },
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

describe("computeCommonValues", () => {
  it("returns empty object for empty list", () => {
    expect(computeCommonValues([])).toEqual({});
  });

  it("returns the single item for a list of one", () => {
    const data = { name: "Task", count: 5 };
    expect(computeCommonValues([data])).toEqual({ name: "Task", count: 5 });
  });

  it("returns common values when all match", () => {
    const a = { name: "Task", count: 5 };
    const b = { name: "Task", count: 5 };
    expect(computeCommonValues([a, b])).toEqual({ name: "Task", count: 5 });
  });

  it("uses MIXED_SENTINEL for differing values", () => {
    const a = { name: "Alpha", count: 5 };
    const b = { name: "Beta", count: 5 };
    const result = computeCommonValues([a, b]);
    expect(result.name).toBe(MIXED_SENTINEL);
    expect(result.count).toBe(5);
  });

  it("handles object values with deep comparison", () => {
    const a = { name: "A", params: { x: 1 } };
    const b = { name: "B", params: { x: 1 } };
    const result = computeCommonValues([a, b]);
    expect(result.name).toBe(MIXED_SENTINEL);
    expect(result.params).toEqual({ x: 1 });
  });

  it("marks objects with different values as mixed", () => {
    const a = { name: "A", params: { x: 1 } };
    const b = { name: "A", params: { x: 2 } };
    const result = computeCommonValues([a, b]);
    expect(result.name).toBe("A");
    expect(result.params).toBe(MIXED_SENTINEL);
  });
});

describe("PropertyGrid multi-select", () => {
  it("shows multi-select indicator when multiple nodes of same kind are selected", async () => {
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

    // Multi-select both nodes
    act(() => {
      store.current.selectMany([nodeId1, nodeId2]);
    });

    render(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.getByTestId("multi-select-indicator")).toBeInTheDocument();
    });

    expect(screen.getByTestId("multi-select-indicator").textContent).toContain("2 nodes");
  });

  it("shows mixed-kinds message when selected nodes have different kinds", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    let taskId = "";
    let decisionId = "";
    act(() => {
      const taskSpec = store.current.registry.get("task");
      const decisionSpec = store.current.registry.get("decision");
      if (taskSpec && decisionSpec) {
        taskId = store.current.addNode(taskSpec, { x: 0, y: 0 }).id;
        decisionId = store.current.addNode(decisionSpec, { x: 100, y: 0 }).id;
      }
    });

    act(() => {
      store.current.selectMany([taskId, decisionId]);
    });

    render(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.getByTestId("property-grid-mixed-kinds")).toBeInTheDocument();
    });
  });

  it("shows common field values and 'mixed' placeholder for differing values", async () => {
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

    // Give them different names
    act(() => {
      store.current.updateNodeData(nodeId1, { name: "Alpha", params: {}, apiKey: "" });
    });
    act(() => {
      store.current.updateNodeData(nodeId2, { name: "Beta", params: {}, apiKey: "" });
    });

    // Multi-select
    act(() => {
      store.current.selectMany([nodeId1, nodeId2]);
    });

    render(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Name should show "mixed" placeholder
    const nameInput = screen.getByTestId("field-name");
    expect(nameInput.placeholder).toBe("mixed");
    expect(nameInput.getAttribute("data-mixed")).toBe("true");
  });

  it("edit name applies to both nodes in multi-select", async () => {
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

    // Both start with default name "Task"
    act(() => {
      store.current.selectMany([nodeId1, nodeId2]);
    });

    render(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Both have same name, so it should show "Task"
    const nameInput = screen.getByTestId("field-name");
    expect(nameInput.value).toBe("Task");

    // Edit the name
    act(() => {
      fireEvent.change(nameInput, { target: { value: "Renamed" } });
    });

    // Wait for the store to update both nodes
    await waitFor(() => {
      const node1 = store.current.nodes.find((n) => n.id === nodeId1);
      const node2 = store.current.nodes.find((n) => n.id === nodeId2);
      expect((node1?.data as Record<string, unknown>).name).toBe("Renamed");
      expect((node2?.data as Record<string, unknown>).name).toBe("Renamed");
    });
  });

  it("shows common values for fields that match across nodes", async () => {
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

    // Both have same name (default "Task"), same apiKey (default "")
    act(() => {
      store.current.selectMany([nodeId1, nodeId2]);
    });

    render(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId("field-name");
    // Common value should be displayed
    expect(nameInput.value).toBe("Task");
    expect(nameInput.getAttribute("data-mixed")).toBeNull();
  });

  it("returns to single-select mode when selection changes", async () => {
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

    // Multi-select
    act(() => {
      store.current.selectMany([nodeId1, nodeId2]);
    });

    const { rerender } = render(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.getByTestId("multi-select-indicator")).toBeInTheDocument();
    });

    // Switch to single select
    act(() => {
      store.current.select(nodeId1, "replace");
    });

    rerender(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.queryByTestId("multi-select-indicator")).not.toBeInTheDocument();
    });

    // PropertyGrid should show single node fields
    expect(screen.getByTestId("property-grid-fields")).toBeInTheDocument();
  });

  it("header shows kind badge for multi-select of same kind", async () => {
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

    act(() => {
      store.current.selectMany([nodeId1, nodeId2]);
    });

    render(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.getByTestId("header-kind-badge")).toBeInTheDocument();
    });

    expect(screen.getByTestId("header-kind-badge").textContent).toContain("task");
  });

  it("typing into a mixed field reflects keystrokes and applies to all nodes", async () => {
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

    // Give them different names to trigger mixed state
    act(() => {
      store.current.updateNodeData(nodeId1, { name: "Alpha", params: {}, apiKey: "" });
    });
    act(() => {
      store.current.updateNodeData(nodeId2, { name: "Beta", params: {}, apiKey: "" });
    });

    act(() => {
      store.current.selectMany([nodeId1, nodeId2]);
    });

    render(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId("field-name");

    // Initially shows mixed placeholder
    expect(nameInput.placeholder).toBe("mixed");
    expect(nameInput.value).toBe("");

    // Simulate keystroke-by-keystroke typing
    act(() => {
      fireEvent.focus(nameInput);
    });
    act(() => {
      fireEvent.change(nameInput, { target: { value: "N" } });
    });

    // After first keystroke, the input should reflect the typed value
    await waitFor(() => {
      const input = screen.getByTestId("field-name");
      expect(input.value).toBe("N");
    });

    // Re-query input (it may have been replaced after field exited mixed state)
    const updatedInput = screen.getByTestId("field-name");
    act(() => {
      fireEvent.change(updatedInput, { target: { value: "New" } });
    });

    await waitFor(() => {
      const input = screen.getByTestId("field-name");
      expect(input.value).toBe("New");
    });

    // Final value should be applied to both nodes
    await waitFor(() => {
      const node1 = store.current.nodes.find((n) => n.id === nodeId1);
      const node2 = store.current.nodes.find((n) => n.id === nodeId2);
      expect((node1?.data as Record<string, unknown>).name).toBe("New");
      expect((node2?.data as Record<string, unknown>).name).toBe("New");
    });
  });
});
