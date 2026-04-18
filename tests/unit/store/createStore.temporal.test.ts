import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { StoreApi } from "zustand";
import type { TemporalState } from "zundo";
import { z } from "zod";
import { renderHook, cleanup, act } from "@testing-library/react";
import { createStore, UNDO_LIMIT, type WorkflowState } from "@/store/createStore";
import { useWorkflowStore } from "@/store/hooks";
import { HISTORY_GROUP_DELAY } from "@/store/historyGroup";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";

// ─── Fixtures ────────────────────────────────────────────────────────

const emptySchema = z.object({});

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

const startSpec: NodeSpec = {
  kind: "start",
  category: "flow",
  label: "Start",
  icon: "play",
  ports: [makeOutputPort({ id: "out", label: "Out", dataType: "any" })],
  propertySchema: emptySchema,
  defaultData: {},
  capabilities: ["isEntry"],
};

// ─── Helpers ─────────────────────────────────────────────────────────

type StoreWithTemporal = StoreApi<WorkflowState> & {
  temporal: StoreApi<TemporalState<Pick<WorkflowState, "nodes" | "edges">>>;
};

function createTemporalStore(): StoreWithTemporal {
  return createStore() as StoreWithTemporal;
}

/** Flush the history group debounce timer so history entries are committed. */
function flush(): void {
  vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("createStore temporal middleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes a temporal store with undo and redo functions", () => {
    const store = createTemporalStore();
    const temporal = store.temporal.getState();

    expect(typeof temporal.undo).toBe("function");
    expect(typeof temporal.redo).toBe("function");
    expect(typeof temporal.clear).toBe("function");
  });

  it("pastStates and futureStates start empty", () => {
    const store = createTemporalStore();
    const temporal = store.temporal.getState();

    expect(temporal.pastStates).toHaveLength(0);
    expect(temporal.futureStates).toHaveLength(0);
  });

  it("undo reverts addNode", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 10, y: 20 });
    flush();
    expect(store.getState().nodes).toHaveLength(1);

    store.temporal.getState().undo();
    expect(store.getState().nodes).toHaveLength(0);
  });

  it("redo re-applies after undo", () => {
    const store = createTemporalStore();

    const node = store.getState().addNode(taskSpec, { x: 10, y: 20 });
    flush();
    store.temporal.getState().undo();
    expect(store.getState().nodes).toHaveLength(0);

    store.temporal.getState().redo();
    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().nodes[0].id).toBe(node.id);
  });

  it("undo records past state after mutation", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    flush();

    const temporal = store.temporal.getState();
    expect(temporal.pastStates).toHaveLength(1);
  });

  it("redo populates futureStates after undo", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    flush();
    store.temporal.getState().undo();

    const temporal = store.temporal.getState();
    expect(temporal.futureStates).toHaveLength(1);
  });

  it("multiple undo/redo steps work correctly", () => {
    const store = createTemporalStore();

    // Add 3 nodes with flush between each
    store.getState().addNode(startSpec, { x: 0, y: 0 });
    flush();
    store.getState().addNode(taskSpec, { x: 100, y: 0 });
    flush();
    store.getState().addNode(taskSpec, { x: 200, y: 0 });
    flush();
    expect(store.getState().nodes).toHaveLength(3);

    // Undo all 3
    store.temporal.getState().undo();
    expect(store.getState().nodes).toHaveLength(2);

    store.temporal.getState().undo();
    expect(store.getState().nodes).toHaveLength(1);

    store.temporal.getState().undo();
    expect(store.getState().nodes).toHaveLength(0);

    // Redo all 3
    store.temporal.getState().redo();
    expect(store.getState().nodes).toHaveLength(1);

    store.temporal.getState().redo();
    expect(store.getState().nodes).toHaveLength(2);

    store.temporal.getState().redo();
    expect(store.getState().nodes).toHaveLength(3);
  });

  it("undo after redo clears future states beyond that point", () => {
    const store = createTemporalStore();

    store.getState().addNode(startSpec, { x: 0, y: 0 });
    flush();
    store.getState().addNode(taskSpec, { x: 100, y: 0 });
    flush();

    // Undo once → 1 future state
    store.temporal.getState().undo();
    expect(store.temporal.getState().futureStates).toHaveLength(1);

    // New mutation should clear future states
    store.getState().addNode(taskSpec, { x: 200, y: 0 });
    flush();
    expect(store.temporal.getState().futureStates).toHaveLength(0);
  });

  it("UNDO_LIMIT is exported and equals 50", () => {
    expect(UNDO_LIMIT).toBe(50);
  });

  it("enforces the undo limit of 50 past states", () => {
    const store = createTemporalStore();

    // Perform more mutations than the limit
    for (let i = 0; i < UNDO_LIMIT + 10; i++) {
      store.getState().addNode(taskSpec, { x: i * 10, y: 0 });
      flush();
    }

    const pastCount = store.temporal.getState().pastStates.length;
    expect(pastCount).toBeLessThanOrEqual(UNDO_LIMIT);
    expect(pastCount).toBe(UNDO_LIMIT);
  });

  it("undo does nothing when pastStates is empty", () => {
    const store = createTemporalStore();
    const before = store.getState().nodes;

    store.temporal.getState().undo();

    expect(store.getState().nodes).toBe(before);
  });

  it("redo does nothing when futureStates is empty", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    flush();
    const before = store.getState().nodes;

    store.temporal.getState().redo();

    expect(store.getState().nodes).toBe(before);
  });

  it("clear resets past and future states", () => {
    const store = createTemporalStore();

    store.getState().addNode(taskSpec, { x: 0, y: 0 });
    flush();
    store.getState().addNode(taskSpec, { x: 100, y: 0 });
    flush();
    store.temporal.getState().undo();

    expect(store.temporal.getState().pastStates.length).toBeGreaterThan(0);
    expect(store.temporal.getState().futureStates.length).toBeGreaterThan(0);

    store.temporal.getState().clear();

    expect(store.temporal.getState().pastStates).toHaveLength(0);
    expect(store.temporal.getState().futureStates).toHaveLength(0);
  });

  it("removeNode is also tracked by temporal", () => {
    const store = createTemporalStore();

    const node = store.getState().addNode(taskSpec, { x: 0, y: 0 });
    flush();
    store.getState().removeNode(node.id);
    flush();
    expect(store.getState().nodes).toHaveLength(0);

    store.temporal.getState().undo();
    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().nodes[0].id).toBe(node.id);
  });
});

// ─── useWorkflowStore.temporal API tests ─────────────────────────────

describe("useWorkflowStore.temporal API", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clear the singleton store's nodes and temporal history
    const temporal = useWorkflowStore.temporal.getState();
    temporal.clear();
    const state = useWorkflowStore.temporal.getState();
    // Ensure clean state
    expect(state.pastStates).toHaveLength(0);
    expect(state.futureStates).toHaveLength(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("useWorkflowStore.temporal is defined and has getState", () => {
    expect(useWorkflowStore.temporal).toBeDefined();
    expect(typeof useWorkflowStore.temporal.getState).toBe("function");
  });

  it("useWorkflowStore.temporal.getState() exposes undo and redo", () => {
    const temporal = useWorkflowStore.temporal.getState();
    expect(typeof temporal.undo).toBe("function");
    expect(typeof temporal.redo).toBe("function");
    expect(typeof temporal.clear).toBe("function");
  });

  it("undo via useWorkflowStore.temporal reverts a mutation", () => {
    const { result, unmount } = renderHook(() => useWorkflowStore());

    act(() => {
      result.current.addNode(taskSpec, { x: 10, y: 20 });
    });
    act(() => {
      flush();
    });
    expect(result.current.nodes).toHaveLength(1);

    act(() => {
      useWorkflowStore.temporal.getState().undo();
    });
    expect(result.current.nodes).toHaveLength(0);

    unmount();
  });

  it("redo via useWorkflowStore.temporal re-applies after undo", () => {
    const { result, unmount } = renderHook(() => useWorkflowStore());

    act(() => {
      result.current.addNode(taskSpec, { x: 10, y: 20 });
    });
    act(() => {
      flush();
    });
    const nodeId = result.current.nodes[0].id;

    act(() => {
      useWorkflowStore.temporal.getState().undo();
    });
    expect(result.current.nodes).toHaveLength(0);

    act(() => {
      useWorkflowStore.temporal.getState().redo();
    });
    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].id).toBe(nodeId);

    unmount();
  });

  it("useWorkflowStore.temporal tracks pastStates and futureStates", () => {
    const { result, unmount } = renderHook(() => useWorkflowStore());

    act(() => {
      result.current.addNode(taskSpec, { x: 0, y: 0 });
    });
    act(() => {
      flush();
    });

    expect(useWorkflowStore.temporal.getState().pastStates.length).toBeGreaterThan(0);
    expect(useWorkflowStore.temporal.getState().futureStates).toHaveLength(0);

    act(() => {
      useWorkflowStore.temporal.getState().undo();
    });

    expect(useWorkflowStore.temporal.getState().futureStates.length).toBeGreaterThan(0);

    unmount();
  });
});
