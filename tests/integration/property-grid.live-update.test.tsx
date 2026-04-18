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
import { BaseNode } from "@/features/nodes/BaseNode";

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

/**
 * A component that reads a node's data from the store and renders BaseNode,
 * mirroring how TaskNode works at runtime: `title={data.name}`.
 */
function LiveBaseNode({ nodeId }: { readonly nodeId: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
  if (!node) return <p data-testid="node-missing">Node not found</p>;
  const data = node.data as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name : "Untitled";
  return <BaseNode title={name} icon="cog" nodeId={nodeId} />;
}

describe("PropertyGrid → BaseNode live update", () => {
  it("editing name in PropertyGrid updates the BaseNode header", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    let nodeId = "";
    act(() => {
      const spec = store.current.registry.get("task");
      if (spec) {
        const node = store.current.addNode(spec, { x: 0, y: 0 });
        nodeId = node.id;
      }
    });

    // Select the node
    act(() => {
      store.current.select(nodeId, "replace");
    });

    // Render PropertyGrid and a store-connected BaseNode side by side
    render(
      <>
        <PropertyGrid />
        <LiveBaseNode nodeId={nodeId} />
      </>,
    );

    // Wait for the name field to appear in the property grid
    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Verify BaseNode header starts with default "Task"
    const header = screen.getByTestId("node-header");
    expect(header.textContent).toContain("Task");

    // Edit the name field
    const nameInput = screen.getByTestId("field-name");
    act(() => {
      fireEvent.change(nameInput, { target: { value: "Renamed Task" } });
    });

    // After the change propagates through the store, BaseNode header should update
    await waitFor(() => {
      expect(screen.getByTestId("node-header").textContent).toContain("Renamed Task");
    });
  });

  it("store node data updates when PropertyGrid name field is edited", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());

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

    // Edit name
    const nameInput = screen.getByTestId("field-name");
    act(() => {
      fireEvent.change(nameInput, { target: { value: "Updated" } });
    });

    // Verify the store's node data has the new name
    await waitFor(() => {
      const node = store.current.nodes.find((n) => n.id === nodeId);
      expect((node?.data as Record<string, unknown>).name).toBe("Updated");
    });
  });

  it("BaseNode header reflects sequential name edits", async () => {
    const { result: store } = renderHook(() => useWorkflowStore());

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

    render(
      <>
        <PropertyGrid />
        <LiveBaseNode nodeId={nodeId} />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // First edit
    const nameInput = screen.getByTestId("field-name");
    act(() => {
      fireEvent.change(nameInput, { target: { value: "First" } });
    });

    await waitFor(() => {
      expect(screen.getByTestId("node-header").textContent).toContain("First");
    });

    // Second edit
    act(() => {
      fireEvent.change(nameInput, { target: { value: "Second" } });
    });

    await waitFor(() => {
      expect(screen.getByTestId("node-header").textContent).toContain("Second");
    });
  });

  it("changing selection updates both PropertyGrid and BaseNode header", async () => {
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

    /** Renders the BaseNode for the currently selected node. */
    function SelectedBaseNode() {
      const selectedId = useWorkflowStore((s) => s.lastSelectedNodeId);
      if (!selectedId) return null;
      return <LiveBaseNode nodeId={selectedId} />;
    }

    render(
      <>
        <PropertyGrid />
        <SelectedBaseNode />
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

    // BaseNode header should now show "Node B"
    await waitFor(() => {
      expect(screen.getByTestId("node-header").textContent).toContain("Node B");
    });
  });
});
