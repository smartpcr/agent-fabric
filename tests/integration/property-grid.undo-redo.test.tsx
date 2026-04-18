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
import { useWorkflowStore, useTemporalStore } from "@/store/hooks";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { PropertyGrid } from "@/features/property-grid/PropertyGrid";

// Mock @monaco-editor/react to avoid Monaco in tests
vi.mock("@monaco-editor/react", () => ({
  default: function MockMonacoEditor() {
    return <div data-testid="mock-monaco" />;
  },
}));

function resetStore() {
  const { result } = renderHook(() => useWorkflowStore());
  const { result: temporal } = renderHook(() => useTemporalStore());
  act(() => {
    const nodeIds = result.current.nodes.map((n) => n.id);
    for (const id of nodeIds) {
      result.current.removeNode(id);
    }
    result.current.clearSelection();
    temporal.current.clear();
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

describe("PropertyGrid undo/redo integration", () => {
  it("undo restores previous form values", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    // Add a task node and select it
    let nodeId = "";
    act(() => {
      const spec = store.current.registry.get("task");
      if (spec) {
        const node = store.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });
    expect(nodeId).not.toBe("");

    act(() => {
      store.current.select(nodeId, "replace");
    });

    render(<PropertyGrid />);

    // Verify initial name field value
    await waitFor(() => {
      expect(screen.getByTestId("field-wrapper-name")).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId("field-name");
    expect(nameInput.value).toBe("Task");

    // Update the node data (simulates user edit committed to store)
    act(() => {
      store.current.updateNodeData(nodeId, { name: "Updated Task", params: [], apiKey: "" });
    });

    // Wait for form to re-render with new value
    await waitFor(() => {
      const input = screen.getByTestId("field-name");
      expect(input.value).toBe("Updated Task");
    });

    // Undo should restore the previous value
    act(() => {
      temporal.current.undo();
    });

    await waitFor(() => {
      const input = screen.getByTestId("field-name");
      expect(input.value).toBe("Task");
    });
  });

  it("redo re-applies the undone change", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    let nodeId = "";
    act(() => {
      const spec = store.current.registry.get("task");
      if (spec) {
        const node = store.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });

    act(() => {
      store.current.select(nodeId, "replace");
    });

    render(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Update and then undo
    act(() => {
      store.current.updateNodeData(nodeId, { name: "Changed", params: [], apiKey: "" });
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-name").value).toBe("Changed");
    });

    act(() => {
      temporal.current.undo();
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-name").value).toBe("Task");
    });

    // Redo should re-apply
    act(() => {
      temporal.current.redo();
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-name").value).toBe("Changed");
    });
  });

  it("preserves focused field after undo", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    let nodeId = "";
    act(() => {
      const spec = store.current.registry.get("task");
      if (spec) {
        const node = store.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });

    act(() => {
      store.current.select(nodeId, "replace");
    });

    render(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Focus the name input
    const nameInput = screen.getByTestId("field-name");
    act(() => {
      nameInput.focus();
    });
    expect(document.activeElement).toBe(nameInput);

    // Update data (creates undo history)
    act(() => {
      store.current.updateNodeData(nodeId, { name: "Edited", params: [], apiKey: "" });
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-name").value).toBe("Edited");
    });

    // Re-focus (simulating user still having focus during undo)
    act(() => {
      screen.getByTestId("field-name").focus();
    });

    // Undo while focused
    act(() => {
      temporal.current.undo();
    });

    // After undo + rAF, focus should be preserved on the name field
    await waitFor(() => {
      expect(screen.getByTestId("field-name").value).toBe("Task");
    });

    // Use waitFor with a slight delay for rAF to execute
    await waitFor(() => {
      const focused = document.activeElement;
      expect(focused).toBe(screen.getByTestId("field-name"));
    });
  });

  it("multiple sequential undos restore earlier states", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    let nodeId = "";
    act(() => {
      const spec = store.current.registry.get("task");
      if (spec) {
        const node = store.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });

    act(() => {
      store.current.select(nodeId, "replace");
    });

    render(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Make two sequential updates
    act(() => {
      store.current.updateNodeData(nodeId, { name: "First Edit", params: [], apiKey: "" });
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-name").value).toBe("First Edit");
    });

    act(() => {
      store.current.updateNodeData(nodeId, { name: "Second Edit", params: [], apiKey: "" });
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-name").value).toBe("Second Edit");
    });

    // Undo once → back to "First Edit"
    act(() => {
      temporal.current.undo();
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-name").value).toBe("First Edit");
    });

    // Undo again → back to "Task"
    act(() => {
      temporal.current.undo();
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-name").value).toBe("Task");
    });
  });

  it("form re-renders with correct data after undo of node addition", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    // Start with empty selection
    render(<PropertyGrid />);
    expect(screen.getByTestId("property-grid-empty")).toBeInTheDocument();

    // Add a node and select it
    act(() => {
      const spec = store.current.registry.get("task");
      if (spec) {
        const node = store.current.addNode(spec, { x: 0, y: 0 });
        store.current.select(node.id, "replace");
      }
    });

    await waitFor(() => {
      expect(screen.getByTestId("property-grid-fields")).toBeInTheDocument();
    });

    // Undo the node addition — node is removed, grid should show empty state
    act(() => {
      temporal.current.undo();
    });

    await waitFor(() => {
      expect(screen.getByTestId("property-grid-empty")).toBeInTheDocument();
    });
  });

  it("form value update via fireEvent.change followed by undo restores original", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    let nodeId = "";
    act(() => {
      const spec = store.current.registry.get("task");
      if (spec) {
        const node = store.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });

    act(() => {
      store.current.select(nodeId, "replace");
    });

    render(<PropertyGrid />);

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Simulate user changing the field value via the form (wrapped in act to flush updates)
    act(() => {
      const nameInput = screen.getByTestId("field-name");
      fireEvent.change(nameInput, { target: { value: "User Typed" } });
    });

    // The form shows the typed value
    await waitFor(() => {
      expect(screen.getByTestId("field-name").value).toBe("User Typed");
    });

    // Wait for the 300ms debounce to commit to the store
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    // Undo returns to original
    act(() => {
      temporal.current.undo();
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-name").value).toBe("Task");
    });
  });
});
