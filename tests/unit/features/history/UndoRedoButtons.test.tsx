import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, renderHook, act, fireEvent } from "@testing-library/react";
import { z } from "zod";
import { UndoRedoButtons } from "@/features/history/UndoRedoButtons";
import { useWorkflowStore, useTemporalStore } from "@/store/hooks";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";

// ─── Fixtures ────────────────────────────────────────────────────────

const taskSpec: NodeSpec<{ name: string }> = {
  kind: "task",
  category: "flow",
  label: "Task",
  icon: "cog",
  ports: [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
  ],
  propertySchema: z.object({ name: z.string() }),
  defaultData: { name: "Default Task" },
  capabilities: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────

function resetStore() {
  const { result } = renderHook(() => useWorkflowStore());
  const { result: temporal } = renderHook(() => useTemporalStore());
  act(() => {
    const nodeIds = result.current.nodes.map((n) => n.id);
    for (const id of nodeIds) {
      result.current.removeNode(id);
    }
    temporal.current.clear();
  });
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("UndoRedoButtons", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("renders undo and redo buttons", () => {
    render(<UndoRedoButtons />);

    expect(screen.getByTestId("undo-redo-buttons")).toBeInTheDocument();
    expect(screen.getByTestId("undo-button")).toBeInTheDocument();
    expect(screen.getByTestId("redo-button")).toBeInTheDocument();
  });

  it("has toolbar role with accessible label", () => {
    render(<UndoRedoButtons />);

    const toolbar = screen.getByTestId("undo-redo-buttons");
    expect(toolbar).toHaveAttribute("role", "toolbar");
    expect(toolbar).toHaveAttribute("aria-label", "Undo / Redo");
  });

  it("undo button has correct aria-label and title", () => {
    render(<UndoRedoButtons />);

    const undoBtn = screen.getByTestId("undo-button");
    expect(undoBtn).toHaveAttribute("aria-label", "Undo");
    expect(undoBtn).toHaveAttribute("title", "Undo");
  });

  it("redo button has correct aria-label and title", () => {
    render(<UndoRedoButtons />);

    const redoBtn = screen.getByTestId("redo-button");
    expect(redoBtn).toHaveAttribute("aria-label", "Redo");
    expect(redoBtn).toHaveAttribute("title", "Redo");
  });

  it("both buttons are disabled when no history exists", () => {
    render(<UndoRedoButtons />);

    expect(screen.getByTestId("undo-button")).toBeDisabled();
    expect(screen.getByTestId("redo-button")).toBeDisabled();
  });

  it("undo button is enabled after a mutation", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });

    render(<UndoRedoButtons />);

    expect(screen.getByTestId("undo-button")).not.toBeDisabled();
    expect(screen.getByTestId("redo-button")).toBeDisabled();
  });

  it("redo button is enabled after an undo", () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });

    act(() => {
      temporal.current.undo();
    });

    render(<UndoRedoButtons />);

    // After undo: can redo, but cannot undo (back to initial)
    expect(screen.getByTestId("undo-button")).toBeDisabled();
    expect(screen.getByTestId("redo-button")).not.toBeDisabled();
  });

  it("clicking undo button triggers undo", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });

    expect(store.current.nodes).toHaveLength(1);

    render(<UndoRedoButtons />);

    act(() => {
      fireEvent.click(screen.getByTestId("undo-button"));
    });

    expect(store.current.nodes).toHaveLength(0);
  });

  it("clicking redo button triggers redo", () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });

    act(() => {
      temporal.current.undo();
    });

    expect(store.current.nodes).toHaveLength(0);

    render(<UndoRedoButtons />);

    act(() => {
      fireEvent.click(screen.getByTestId("redo-button"));
    });

    expect(store.current.nodes).toHaveLength(1);
  });

  it("undo button becomes disabled again after undoing all history", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });

    const { unmount } = render(<UndoRedoButtons />);

    expect(screen.getByTestId("undo-button")).not.toBeDisabled();

    act(() => {
      fireEvent.click(screen.getByTestId("undo-button"));
    });

    expect(screen.getByTestId("undo-button")).toBeDisabled();

    unmount();
  });

  it("redo button becomes disabled after redoing all future states", () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });

    act(() => {
      temporal.current.undo();
    });

    const { unmount } = render(<UndoRedoButtons />);

    expect(screen.getByTestId("redo-button")).not.toBeDisabled();

    act(() => {
      fireEvent.click(screen.getByTestId("redo-button"));
    });

    expect(screen.getByTestId("redo-button")).toBeDisabled();

    unmount();
  });

  it("renders undo and redo icons", () => {
    render(<UndoRedoButtons />);

    // lucide-react renders SVGs — check that buttons contain SVG children
    const undoBtn = screen.getByTestId("undo-button");
    const redoBtn = screen.getByTestId("redo-button");

    expect(undoBtn.querySelector("svg")).not.toBeNull();
    expect(redoBtn.querySelector("svg")).not.toBeNull();
  });

  it("both buttons are disabled after clearing history", () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });

    const { unmount } = render(<UndoRedoButtons />);

    expect(screen.getByTestId("undo-button")).not.toBeDisabled();

    act(() => {
      temporal.current.clear();
    });

    expect(screen.getByTestId("undo-button")).toBeDisabled();
    expect(screen.getByTestId("redo-button")).toBeDisabled();

    unmount();
  });

  it("disabled state updates reactively across multiple undo/redo cycles", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    // Add two nodes
    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    act(() => {
      store.current.addNode(taskSpec, { x: 100, y: 0 });
    });

    const { unmount } = render(<UndoRedoButtons />);

    const undoBtn = () => screen.getByTestId("undo-button");
    const redoBtn = () => screen.getByTestId("redo-button");

    // Can undo, cannot redo
    expect(undoBtn()).not.toBeDisabled();
    expect(redoBtn()).toBeDisabled();

    // Undo once
    act(() => {
      fireEvent.click(undoBtn());
    });
    expect(undoBtn()).not.toBeDisabled();
    expect(redoBtn()).not.toBeDisabled();

    // Undo again (back to empty)
    act(() => {
      fireEvent.click(undoBtn());
    });
    expect(undoBtn()).toBeDisabled();
    expect(redoBtn()).not.toBeDisabled();

    // Redo once
    act(() => {
      fireEvent.click(redoBtn());
    });
    expect(undoBtn()).not.toBeDisabled();
    expect(redoBtn()).not.toBeDisabled();

    // Redo again (fully restored)
    act(() => {
      fireEvent.click(redoBtn());
    });
    expect(undoBtn()).not.toBeDisabled();
    expect(redoBtn()).toBeDisabled();

    unmount();
  });
});
