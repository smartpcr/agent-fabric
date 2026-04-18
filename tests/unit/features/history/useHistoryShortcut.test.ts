import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { z } from "zod";
import { useHistoryShortcut } from "@/features/history/useHistoryShortcut";
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

function fireKey(key: string, options: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  document.dispatchEvent(event);
  return event;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("useHistoryShortcut", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("Ctrl+Z triggers undo", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    expect(store.current.nodes).toHaveLength(1);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    act(() => {
      fireKey("z", { ctrlKey: true });
    });

    expect(store.current.nodes).toHaveLength(0);
    unmount();
  });

  it("Cmd+Z triggers undo (Mac)", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    expect(store.current.nodes).toHaveLength(1);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    act(() => {
      fireKey("z", { metaKey: true });
    });

    expect(store.current.nodes).toHaveLength(0);
    unmount();
  });

  it("Ctrl+Shift+Z triggers redo", () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    act(() => {
      temporal.current.undo();
    });
    expect(store.current.nodes).toHaveLength(0);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    act(() => {
      fireKey("z", { ctrlKey: true, shiftKey: true });
    });

    expect(store.current.nodes).toHaveLength(1);
    unmount();
  });

  it("Cmd+Shift+Z triggers redo (Mac)", () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    act(() => {
      temporal.current.undo();
    });
    expect(store.current.nodes).toHaveLength(0);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    act(() => {
      fireKey("z", { metaKey: true, shiftKey: true });
    });

    expect(store.current.nodes).toHaveLength(1);
    unmount();
  });

  it("Ctrl+Y triggers redo", () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    act(() => {
      temporal.current.undo();
    });
    expect(store.current.nodes).toHaveLength(0);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    act(() => {
      fireKey("y", { ctrlKey: true });
    });

    expect(store.current.nodes).toHaveLength(1);
    unmount();
  });

  it("Ctrl+Z is suppressed when focus is inside an input element", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    expect(store.current.nodes).toHaveLength(1);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    // Create and focus an input element
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      fireKey("z", { ctrlKey: true });
    });

    // Should NOT have undone — input was focused
    expect(store.current.nodes).toHaveLength(1);

    document.body.removeChild(input);
    unmount();
  });

  it("Ctrl+Z is suppressed when focus is inside a textarea", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    expect(store.current.nodes).toHaveLength(1);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    act(() => {
      fireKey("z", { ctrlKey: true });
    });

    expect(store.current.nodes).toHaveLength(1);

    document.body.removeChild(textarea);
    unmount();
  });

  it("Ctrl+Z is suppressed when focus is inside a contenteditable", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    expect(store.current.nodes).toHaveLength(1);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    const div = document.createElement("div");
    div.contentEditable = "true";
    div.tabIndex = 0;
    document.body.appendChild(div);
    div.focus();

    act(() => {
      fireKey("z", { ctrlKey: true });
    });

    expect(store.current.nodes).toHaveLength(1);

    document.body.removeChild(div);
    unmount();
  });

  it("Ctrl+Shift+Z (redo) is also suppressed inside inputs", () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    act(() => {
      temporal.current.undo();
    });
    expect(store.current.nodes).toHaveLength(0);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      fireKey("z", { ctrlKey: true, shiftKey: true });
    });

    // Should NOT have redone
    expect(store.current.nodes).toHaveLength(0);

    document.body.removeChild(input);
    unmount();
  });

  it("Ctrl+Y (redo) is also suppressed inside inputs", () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    act(() => {
      temporal.current.undo();
    });
    expect(store.current.nodes).toHaveLength(0);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      fireKey("y", { ctrlKey: true });
    });

    expect(store.current.nodes).toHaveLength(0);

    document.body.removeChild(input);
    unmount();
  });

  it("fires undo outside inputs after previously suppressing inside input", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    // Focus input → suppressed
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      fireKey("z", { ctrlKey: true });
    });
    expect(store.current.nodes).toHaveLength(1);

    // Blur input → focus back to body
    input.blur();

    act(() => {
      fireKey("z", { ctrlKey: true });
    });
    expect(store.current.nodes).toHaveLength(0);

    document.body.removeChild(input);
    unmount();
  });

  it("preventDefault is called on handled shortcut", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    let event: KeyboardEvent | undefined;
    act(() => {
      event = fireKey("z", { ctrlKey: true });
    });

    expect(event).toBeDefined();
    expect(event?.defaultPrevented).toBe(true);
    unmount();
  });

  it("non-shortcut keys are ignored", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    // Random key without ctrl
    act(() => {
      fireKey("z");
    });
    expect(store.current.nodes).toHaveLength(1);

    // Ctrl+X (not undo/redo)
    act(() => {
      fireKey("x", { ctrlKey: true });
    });
    expect(store.current.nodes).toHaveLength(1);

    unmount();
  });

  it("cleanup removes event listener on unmount", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });
    unmount();

    // After unmount, Ctrl+Z should not trigger undo
    act(() => {
      fireKey("z", { ctrlKey: true });
    });
    expect(store.current.nodes).toHaveLength(1);
  });

  it("Ctrl+Z with uppercase key 'Z' still triggers undo", () => {
    const { result: store } = renderHook(() => useWorkflowStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    expect(store.current.nodes).toHaveLength(1);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    act(() => {
      fireKey("Z", { ctrlKey: true });
    });

    expect(store.current.nodes).toHaveLength(0);
    unmount();
  });

  it("Ctrl+Shift+Z with uppercase key 'Z' still triggers redo", () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    act(() => {
      temporal.current.undo();
    });
    expect(store.current.nodes).toHaveLength(0);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    act(() => {
      fireKey("Z", { ctrlKey: true, shiftKey: true });
    });

    expect(store.current.nodes).toHaveLength(1);
    unmount();
  });

  it("Ctrl+Y with uppercase key 'Y' still triggers redo", () => {
    const { result: store } = renderHook(() => useWorkflowStore());
    const { result: temporal } = renderHook(() => useTemporalStore());

    act(() => {
      store.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    act(() => {
      temporal.current.undo();
    });
    expect(store.current.nodes).toHaveLength(0);

    const { unmount } = renderHook(() => {
      useHistoryShortcut();
    });

    act(() => {
      fireKey("Y", { ctrlKey: true });
    });

    expect(store.current.nodes).toHaveLength(1);
    unmount();
  });
});
