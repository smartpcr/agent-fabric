import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, renderHook } from "@testing-library/react";
import { InlineLabelEditor } from "@/features/edges/InlineLabelEditor";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { StartNodeSpec } from "@/registry/builtins/StartNode.spec";
import { TaskNodeSpec } from "@/registry/builtins/TaskNode.spec";
import { useWorkflowStore } from "@/store/hooks";

afterEach(() => {
  cleanup();
});

describe("InlineLabelEditor", () => {
  // --- Double-click transition ---

  it("initially renders a label display, not an input", () => {
    render(<InlineLabelEditor value="hello" onCommit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByTestId("inline-label-display")).toBeInTheDocument();
    expect(screen.getByTestId("inline-label-display").textContent).toBe("hello");
    expect(screen.queryByTestId("inline-label-input")).toBeNull();
  });

  it("double-click on label enters edit mode showing an input", () => {
    render(<InlineLabelEditor value="hello" onCommit={vi.fn()} onCancel={vi.fn()} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    expect(screen.getByTestId("inline-label-input")).toBeInTheDocument();
    expect(screen.queryByTestId("inline-label-display")).toBeNull();
  });

  it("input shows current value after entering edit mode", () => {
    render(<InlineLabelEditor value="my-label" onCommit={vi.fn()} onCancel={vi.fn()} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    const input = screen.getByTestId("inline-label-input");
    expect(input.value).toBe("my-label");
  });

  it("auto-focuses the input when entering edit mode", () => {
    render(<InlineLabelEditor value="test" onCommit={vi.fn()} onCancel={vi.fn()} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    expect(document.activeElement).toBe(screen.getByTestId("inline-label-input"));
  });

  // --- Enter commits ---

  it("Enter key commits with the current text and exits edit mode", () => {
    const onCommit = vi.fn();
    render(<InlineLabelEditor value="original" onCommit={onCommit} onCancel={vi.fn()} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.change(input, { target: { value: "updated" } });
    });

    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(onCommit).toHaveBeenCalledWith("updated");
    expect(onCommit).toHaveBeenCalledTimes(1);
    // Should exit edit mode back to label display
    expect(screen.getByTestId("inline-label-display")).toBeInTheDocument();
  });

  it("Enter key commits unchanged text if no edits were made", () => {
    const onCommit = vi.fn();
    render(<InlineLabelEditor value="same" onCommit={onCommit} onCancel={vi.fn()} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    act(() => {
      fireEvent.keyDown(screen.getByTestId("inline-label-input"), { key: "Enter" });
    });

    expect(onCommit).toHaveBeenCalledWith("same");
  });

  // --- Escape cancels ---

  it("Escape key cancels editing without committing and exits edit mode", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<InlineLabelEditor value="original" onCommit={onCommit} onCancel={onCancel} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.change(input, { target: { value: "changed" } });
    });

    act(() => {
      fireEvent.keyDown(input, { key: "Escape" });
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    // Should exit edit mode
    expect(screen.getByTestId("inline-label-display")).toBeInTheDocument();
  });

  // --- Blur commits ---

  it("Blur commits with the current text and exits edit mode", () => {
    const onCommit = vi.fn();
    render(<InlineLabelEditor value="original" onCommit={onCommit} onCancel={vi.fn()} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.change(input, { target: { value: "blur-value" } });
    });

    act(() => {
      fireEvent.blur(input);
    });

    expect(onCommit).toHaveBeenCalledWith("blur-value");
    expect(screen.getByTestId("inline-label-display")).toBeInTheDocument();
  });

  // --- Focus trap ---

  it("Tab key is trapped inside the input during editing", () => {
    render(<InlineLabelEditor value="test" onCommit={vi.fn()} onCancel={vi.fn()} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.keyDown(input, { key: "Tab" });
    });

    // Focus should remain on the input
    expect(document.activeElement).toBe(input);
  });

  it("Shift+Tab key is trapped inside the input during editing", () => {
    render(<InlineLabelEditor value="test" onCommit={vi.fn()} onCancel={vi.fn()} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    });

    // Focus should remain on the input
    expect(document.activeElement).toBe(input);
  });

  // --- Other behaviors ---

  it("updates internal text state when typing", () => {
    render(<InlineLabelEditor value="start" onCommit={vi.fn()} onCancel={vi.fn()} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.change(input, { target: { value: "modified" } });
    });

    expect(input.value).toBe("modified");
  });

  it("stops keyboard event propagation to prevent canvas shortcuts", () => {
    render(<InlineLabelEditor value="test" onCommit={vi.fn()} onCancel={vi.fn()} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    const input = screen.getByTestId("inline-label-input");
    const stopPropagation = vi.fn();

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "a",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "stopPropagation", { value: stopPropagation });
      input.dispatchEvent(event);
    });

    expect(stopPropagation).toHaveBeenCalled();
  });

  it("commits empty string when input is cleared", () => {
    const onCommit = vi.fn();
    render(<InlineLabelEditor value="test" onCommit={onCommit} onCancel={vi.fn()} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.change(input, { target: { value: "" } });
    });

    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(onCommit).toHaveBeenCalledWith("");
  });

  it("renders input as text type when in edit mode", () => {
    render(<InlineLabelEditor value="test" onCommit={vi.fn()} onCancel={vi.fn()} />);

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    const input = screen.getByTestId("inline-label-input");
    expect(input.tagName.toLowerCase()).toBe("input");
    expect(input.type).toBe("text");
  });
});

describe("InlineLabelEditor store integration", () => {
  it("onCommit triggers updateEdgeLabel on the store", () => {
    // Set up store with registry and nodes
    const registry = new NodeRegistry();
    registerBuiltins(registry);

    const { result, unmount } = renderHook(() => useWorkflowStore());

    act(() => {
      result.current.setRegistry(registry);
      // Clear default nodes
      for (const node of result.current.nodes) {
        result.current.removeNode(node.id);
      }
    });

    // Add nodes and create an edge
    let edgeId = "";
    act(() => {
      const startNode = result.current.addNode(StartNodeSpec, { x: 0, y: 0 });
      const taskNode = result.current.addNode(TaskNodeSpec, { x: 200, y: 0 });
      const connectResult = result.current.tryConnect({
        source: startNode.id,
        sourcePort: "out",
        target: taskNode.id,
        targetPort: "in",
      });
      if (connectResult.ok) {
        edgeId = connectResult.value.id;
      }
    });

    expect(edgeId).not.toBe("");
    expect(result.current.edges).toHaveLength(1);

    // Simulate what DefaultEdge would do: wire onCommit to updateEdgeLabel
    const updateEdgeLabel = result.current.updateEdgeLabel;

    // Render the InlineLabelEditor with the store action as onCommit
    render(
      <InlineLabelEditor
        value="old-label"
        onCommit={(newLabel) => {
          updateEdgeLabel(edgeId, newLabel);
        }}
        onCancel={vi.fn()}
      />,
    );

    // Double-click to enter edit mode
    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    const input = screen.getByTestId("inline-label-input");

    // Type new label
    act(() => {
      fireEvent.change(input, { target: { value: "new-label" } });
    });

    // Press Enter to commit
    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    // Verify store received the label update
    expect(result.current.edges[0]?.label).toBe("new-label");

    unmount();
  });

  it("Blur triggers updateEdgeLabel on the store", () => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);

    const { result, unmount } = renderHook(() => useWorkflowStore());

    act(() => {
      result.current.setRegistry(registry);
      for (const node of result.current.nodes) {
        result.current.removeNode(node.id);
      }
    });

    let edgeId = "";
    act(() => {
      const startNode = result.current.addNode(StartNodeSpec, { x: 0, y: 0 });
      const taskNode = result.current.addNode(TaskNodeSpec, { x: 200, y: 0 });
      const connectResult = result.current.tryConnect({
        source: startNode.id,
        sourcePort: "out",
        target: taskNode.id,
        targetPort: "in",
      });
      if (connectResult.ok) {
        edgeId = connectResult.value.id;
      }
    });

    const updateEdgeLabel = result.current.updateEdgeLabel;

    render(
      <InlineLabelEditor
        value=""
        onCommit={(newLabel) => {
          updateEdgeLabel(edgeId, newLabel);
        }}
        onCancel={vi.fn()}
      />,
    );

    act(() => {
      fireEvent.doubleClick(screen.getByTestId("inline-label-display"));
    });

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.change(input, { target: { value: "blur-label" } });
    });

    act(() => {
      fireEvent.blur(input);
    });

    expect(result.current.edges[0]?.label).toBe("blur-label");

    unmount();
  });
});
