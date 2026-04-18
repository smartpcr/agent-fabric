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

describe("PropertyGrid", () => {
  describe("empty state", () => {
    it("shows 'Select a node' when no node is selected", () => {
      render(<PropertyGrid />);

      const empty = screen.getByTestId("property-grid-empty");
      expect(empty).toBeInTheDocument();
      expect(empty.textContent).toBe("Select a node");
    });

    it("has the Properties heading", () => {
      render(<PropertyGrid />);

      expect(screen.getByText("Properties")).toBeInTheDocument();
    });

    it("has role=complementary with aria-label", () => {
      render(<PropertyGrid />);

      const grid = screen.getByRole("complementary");
      expect(grid).toBeInTheDocument();
      expect(grid.getAttribute("aria-label")).toBe("Property Grid");
    });

    it("does not render property-grid-fields when nothing is selected", () => {
      render(<PropertyGrid />);

      expect(screen.queryByTestId("property-grid-fields")).not.toBeInTheDocument();
    });
  });

  describe("selection binding", () => {
    it("renders SchemaForm when a node is selected", async () => {
      const { result } = renderHook(() => useWorkflowStore());

      let nodeId = "";
      act(() => {
        const spec = result.current.registry.get("task");
        if (spec) {
          const node = result.current.addNode(spec, { x: 0, y: 0 });
          nodeId = node.id;
        }
      });
      expect(nodeId).not.toBe("");

      // Select the node
      act(() => {
        result.current.select(nodeId, "replace");
      });

      render(<PropertyGrid />);

      await waitFor(() => {
        expect(screen.getByTestId("property-grid-fields")).toBeInTheDocument();
      });

      // Should show the node kind
      expect(screen.getByTestId("header-kind-badge").textContent).toContain("task");
      expect(screen.getByTestId("schema-form")).toBeInTheDocument();
    });

    it("shows empty state after selection is cleared", async () => {
      const { result } = renderHook(() => useWorkflowStore());

      let nodeId = "";
      act(() => {
        const spec = result.current.registry.get("task");
        if (spec) {
          const node = result.current.addNode(spec, { x: 0, y: 0 });
          nodeId = node.id;
        }
      });

      // Select then clear
      act(() => {
        result.current.select(nodeId, "replace");
      });

      const { rerender } = render(<PropertyGrid />);

      await waitFor(() => {
        expect(screen.getByTestId("property-grid-fields")).toBeInTheDocument();
      });

      // Clear selection
      act(() => {
        result.current.clear();
      });

      rerender(<PropertyGrid />);

      expect(screen.getByTestId("property-grid-empty")).toBeInTheDocument();
      expect(screen.queryByTestId("property-grid-fields")).not.toBeInTheDocument();
    });

    it("switches to different node when selection changes", async () => {
      const { result } = renderHook(() => useWorkflowStore());

      let taskNodeId = "";
      let decisionNodeId = "";

      act(() => {
        const taskSpec = result.current.registry.get("task");
        const decisionSpec = result.current.registry.get("decision");
        if (taskSpec) {
          const node = result.current.addNode(taskSpec, { x: 0, y: 0 });
          taskNodeId = node.id;
        }
        if (decisionSpec) {
          const node = result.current.addNode(decisionSpec, { x: 100, y: 0 });
          decisionNodeId = node.id;
        }
      });

      // Select task node
      act(() => {
        result.current.select(taskNodeId, "replace");
      });

      const { rerender } = render(<PropertyGrid />);

      await waitFor(() => {
        expect(screen.getByTestId("header-kind-badge").textContent).toContain("task");
      });

      // Switch to decision node
      act(() => {
        result.current.select(decisionNodeId, "replace");
      });

      rerender(<PropertyGrid />);

      await waitFor(() => {
        expect(screen.getByTestId("header-kind-badge").textContent).toContain("decision");
      });
    });

    it("uses lastSelectedNodeId not inspectorNodeId", () => {
      const { result } = renderHook(() => useWorkflowStore());

      let nodeId = "";
      act(() => {
        const spec = result.current.registry.get("task");
        if (spec) {
          const node = result.current.addNode(spec, { x: 0, y: 0 });
          nodeId = node.id;
        }
      });

      // Open inspector (old way) — should NOT show node in new PropertyGrid
      act(() => {
        result.current.openInspector(nodeId);
      });

      render(<PropertyGrid />);

      // Without selection, PropertyGrid shows empty state
      expect(screen.getByTestId("property-grid-empty")).toBeInTheDocument();
    });
  });

  describe("lastSelectedNodeId in selection slice", () => {
    it("is null initially", () => {
      const { result } = renderHook(() => useWorkflowStore());
      expect(result.current.lastSelectedNodeId).toBeNull();
    });

    it("is set when a node is selected via select()", () => {
      const { result } = renderHook(() => useWorkflowStore());

      act(() => {
        const spec = result.current.registry.get("task");
        if (spec) {
          const node = result.current.addNode(spec, { x: 0, y: 0 });
          result.current.select(node.id, "replace");
        }
      });

      expect(result.current.lastSelectedNodeId).not.toBeNull();
    });

    it("is cleared when selection is cleared", () => {
      const { result } = renderHook(() => useWorkflowStore());

      act(() => {
        const spec = result.current.registry.get("task");
        if (spec) {
          const node = result.current.addNode(spec, { x: 0, y: 0 });
          result.current.select(node.id, "replace");
        }
      });

      expect(result.current.lastSelectedNodeId).not.toBeNull();

      act(() => {
        result.current.clear();
      });

      expect(result.current.lastSelectedNodeId).toBeNull();
    });

    it("tracks the most recent selection in multi-select", () => {
      const { result } = renderHook(() => useWorkflowStore());

      let nodeId1 = "";
      let nodeId2 = "";

      act(() => {
        const spec = result.current.registry.get("task");
        if (spec) {
          nodeId1 = result.current.addNode(spec, { x: 0, y: 0 }).id;
          nodeId2 = result.current.addNode(spec, { x: 100, y: 0 }).id;
        }
      });

      act(() => {
        result.current.select(nodeId1, "replace");
      });
      expect(result.current.lastSelectedNodeId).toBe(nodeId1);

      act(() => {
        result.current.select(nodeId2, "add");
      });
      expect(result.current.lastSelectedNodeId).toBe(nodeId2);
    });

    it("updates via selectMany", () => {
      const { result } = renderHook(() => useWorkflowStore());

      let nodeId1 = "";
      let nodeId2 = "";

      act(() => {
        const spec = result.current.registry.get("task");
        if (spec) {
          nodeId1 = result.current.addNode(spec, { x: 0, y: 0 }).id;
          nodeId2 = result.current.addNode(spec, { x: 100, y: 0 }).id;
        }
      });

      act(() => {
        result.current.selectMany([nodeId1, nodeId2]);
      });

      // lastSelectedNodeId should be one of the selected nodes
      expect(result.current.lastSelectedNodeId).not.toBeNull();
      expect([nodeId1, nodeId2]).toContain(result.current.lastSelectedNodeId);
    });

    it("is cleared by clearSelection", () => {
      const { result } = renderHook(() => useWorkflowStore());

      act(() => {
        const spec = result.current.registry.get("task");
        if (spec) {
          const node = result.current.addNode(spec, { x: 0, y: 0 });
          result.current.select(node.id, "replace");
        }
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.lastSelectedNodeId).toBeNull();
    });
  });

  describe("SchemaForm rendering", () => {
    it("renders field inputs for node data schema", async () => {
      const { result } = renderHook(() => useWorkflowStore());

      let nodeId = "";
      act(() => {
        const spec = result.current.registry.get("task");
        if (spec) {
          const node = result.current.addNode(spec, { x: 0, y: 0 });
          nodeId = node.id;
        }
      });

      act(() => {
        result.current.select(nodeId, "replace");
      });

      render(<PropertyGrid />);

      await waitFor(() => {
        // TaskNode schema has 'name' field — look for the field wrapper
        expect(screen.getByTestId("field-wrapper-name")).toBeInTheDocument();
      });
    });

    it("displays node kind in the grid", async () => {
      const { result } = renderHook(() => useWorkflowStore());

      let nodeId = "";
      act(() => {
        const spec = result.current.registry.get("decision");
        if (spec) {
          const node = result.current.addNode(spec, { x: 0, y: 0 });
          nodeId = node.id;
        }
      });

      act(() => {
        result.current.select(nodeId, "replace");
      });

      render(<PropertyGrid />);

      await waitFor(() => {
        expect(screen.getByTestId("header-kind-badge").textContent).toContain("decision");
      });
    });

    it("multi-select label editing updates all nodes", async () => {
      const { result } = renderHook(() => useWorkflowStore());

      let nodeId1 = "";
      let nodeId2 = "";
      act(() => {
        const spec = result.current.registry.get("task");
        if (spec) {
          nodeId1 = result.current.addNode(spec, { x: 0, y: 0 }).id;
          nodeId2 = result.current.addNode(spec, { x: 100, y: 0 }).id;
        }
      });

      act(() => {
        result.current.selectMany([nodeId1, nodeId2]);
      });

      render(<PropertyGrid />);

      await waitFor(() => {
        expect(screen.getByTestId("multi-select-indicator")).toBeInTheDocument();
      });

      // Find the label display and click to edit
      const label = screen.getByTestId("header-label");
      fireEvent.click(label);

      const input = screen.getByTestId("header-label-input");
      fireEvent.change(input, { target: { value: "SharedName" } });
      fireEvent.blur(input);

      // Both nodes should have the new name
      const store = result.current;
      const node1 = store.nodes.find((n) => n.id === nodeId1);
      const node2 = store.nodes.find((n) => n.id === nodeId2);
      expect((node1?.data as Record<string, unknown>).name).toBe("SharedName");
      expect((node2?.data as Record<string, unknown>).name).toBe("SharedName");
    });
  });
});
