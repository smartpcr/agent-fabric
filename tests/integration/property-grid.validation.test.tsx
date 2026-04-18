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
import { Toolbar } from "@/features/editor/Toolbar";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ValidationProvider } from "@/features/property-grid/ValidationContext";

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

function renderApp() {
  return render(
    <ThemeProvider>
      <ValidationProvider>
        <Toolbar />
        <PropertyGrid />
      </ValidationProvider>
    </ThemeProvider>,
  );
}

describe("PropertyGrid validation + Toolbar Save gate", () => {
  it("Save button is enabled when no validation errors exist", () => {
    renderApp();

    const saveBtn = screen.getByTestId("save-button");
    expect(saveBtn).not.toBeDisabled();
  });

  it("error count badge is not shown when form is valid", async () => {
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

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("field-wrapper-name")).toBeInTheDocument();
    });

    // No error badge should be visible
    expect(screen.queryByTestId("error-count-badge")).not.toBeInTheDocument();
  });

  it("Save button is disabled when a field has a validation error", async () => {
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

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Clear the name field to trigger min(1) validation error
    act(() => {
      const nameInput = screen.getByTestId("field-name");
      fireEvent.change(nameInput, { target: { value: "" } });
    });

    // Wait for validation to propagate
    await waitFor(() => {
      const saveBtn = screen.getByTestId("save-button");
      expect(saveBtn).toBeDisabled();
    });
  });

  it("error count badge appears with correct count", async () => {
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

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Trigger validation error
    act(() => {
      const nameInput = screen.getByTestId("field-name");
      fireEvent.change(nameInput, { target: { value: "" } });
    });

    await waitFor(() => {
      const badge = screen.getByTestId("error-count-badge");
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toBe("1");
    });
  });

  it("Save button re-enables after correcting validation error", async () => {
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

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Trigger validation error
    act(() => {
      const nameInput = screen.getByTestId("field-name");
      fireEvent.change(nameInput, { target: { value: "" } });
    });

    await waitFor(() => {
      expect(screen.getByTestId("save-button")).toBeDisabled();
    });

    // Fix the validation error
    act(() => {
      const nameInput = screen.getByTestId("field-name");
      fireEvent.change(nameInput, { target: { value: "Valid Name" } });
    });

    // Save button should re-enable
    await waitFor(() => {
      expect(screen.getByTestId("save-button")).not.toBeDisabled();
    });
  });

  it("error badge disappears when errors are corrected", async () => {
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

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Trigger error
    act(() => {
      fireEvent.change(screen.getByTestId("field-name"), { target: { value: "" } });
    });

    await waitFor(() => {
      expect(screen.getByTestId("error-count-badge")).toBeInTheDocument();
    });

    // Correct error
    act(() => {
      fireEvent.change(screen.getByTestId("field-name"), { target: { value: "Fixed" } });
    });

    await waitFor(() => {
      expect(screen.queryByTestId("error-count-badge")).not.toBeInTheDocument();
    });
  });

  it("Save button title shows error summary on hover when errors exist", async () => {
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

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Trigger validation error
    act(() => {
      fireEvent.change(screen.getByTestId("field-name"), { target: { value: "" } });
    });

    // Save button title should contain the error message
    await waitFor(() => {
      const saveBtn = screen.getByTestId("save-button");
      expect(saveBtn).toBeDisabled();
      const titleAttr = saveBtn.getAttribute("title");
      expect(titleAttr).toBeTruthy();
      // The title should not be just "Save" when there are errors
      expect(titleAttr).not.toBe("Save");
    });
  });

  it("Save button title is 'Save' when no errors", () => {
    renderApp();

    const saveBtn = screen.getByTestId("save-button");
    expect(saveBtn.getAttribute("title")).toBe("Save");
  });

  it("inline error message appears for invalid field", async () => {
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

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Clear name to trigger error
    act(() => {
      fireEvent.change(screen.getByTestId("field-name"), { target: { value: "" } });
    });

    // Inline error should appear
    await waitFor(() => {
      const errorEl = screen.getByTestId("error-name");
      expect(errorEl).toBeInTheDocument();
    });
  });

  it("no errors when no node is selected", () => {
    renderApp();

    expect(screen.queryByTestId("error-count-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("save-button")).not.toBeDisabled();
  });

  it("clears validation state when selection is cleared after having errors", async () => {
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

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("field-name")).toBeInTheDocument();
    });

    // Trigger validation error
    act(() => {
      fireEvent.change(screen.getByTestId("field-name"), { target: { value: "" } });
    });

    await waitFor(() => {
      expect(screen.getByTestId("save-button")).toBeDisabled();
      expect(screen.getByTestId("error-count-badge")).toBeInTheDocument();
    });

    // Clear selection — form unmounts
    act(() => {
      store.current.clearSelection();
    });

    // Validation state should be cleared: save re-enabled, badge gone
    await waitFor(() => {
      expect(screen.getByTestId("save-button")).not.toBeDisabled();
      expect(screen.queryByTestId("error-count-badge")).not.toBeInTheDocument();
    });
  });
});
