import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { z } from "zod";
import { RepositoryProvider } from "@/providers/RepositoryProvider";
import type { IWorkflowRepository } from "@/ports/IWorkflowRepository";
import { ok, err } from "@/domain/result";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { HISTORY_GROUP_DELAY } from "@/store/historyGroup";
import { getStoreInstance, resetDefaultStore } from "@/store/hooks";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { useDebouncedAutoSave, AUTO_SAVE_DEBOUNCE_MS } from "@/features/persistence/useAutoSave";

// ─── Node specs for validation ───────────────────────────────────────

const emptySchema = z.object({});

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

const endSpec: NodeSpec = {
  kind: "end",
  category: "flow",
  label: "End",
  icon: "stop",
  ports: [makeInputPort({ id: "in", label: "In", dataType: "any" })],
  propertySchema: emptySchema,
  defaultData: {},
  capabilities: [],
};

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
  defaultData: { name: "Default" },
  capabilities: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────

function stubRepo(overrides: Partial<IWorkflowRepository> = {}): IWorkflowRepository {
  return {
    get: vi.fn().mockResolvedValue(
      ok({
        graph: { schemaVersion: 1, id: "w-1", name: "Test", nodes: [], edges: [] },
        etag: '"v1"',
      }),
    ),
    save: vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v2"' })),
    create: vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v1"' })),
    list: vi.fn().mockResolvedValue(ok([])),
    ...overrides,
  };
}

function repoWrapper(repo: IWorkflowRepository) {
  function RepoWrapper({ children }: { children: ReactNode }) {
    return createElement(RepositoryProvider, { repository: repo }, children);
  }
  return RepoWrapper;
}

/** Flush the zundo history-group debounce timer. */
function flushHistoryGroup(): void {
  vi.advanceTimersByTime(HISTORY_GROUP_DELAY + 50);
}

function setupValidGraph(): void {
  const store = getStoreInstance();
  const state = store.getState();

  // Register specs in both nodeSpecs and the NodeRegistry
  state.registerNodeSpec(startSpec);
  state.registerNodeSpec(endSpec);
  state.registerNodeSpec(taskSpec);

  // Also populate the NodeRegistry (used by validateGraph)
  const registry = new NodeRegistry();
  registry.register(startSpec);
  registry.register(endSpec);
  registry.register(taskSpec);
  state.setRegistry(registry);

  // Build a valid graph: start -> task -> end
  const startNode = state.addNode(startSpec, { x: 0, y: 0 });
  flushHistoryGroup();
  const taskNode = state.addNode(taskSpec, { x: 200, y: 0 });
  flushHistoryGroup();
  const endNode = state.addNode(endSpec, { x: 400, y: 0 });
  flushHistoryGroup();

  // Connect them
  state.tryConnect({
    source: startNode.id,
    sourcePort: "out",
    target: taskNode.id,
    targetPort: "in",
  });
  flushHistoryGroup();
  state.tryConnect({
    source: taskNode.id,
    sourcePort: "out",
    target: endNode.id,
    targetPort: "in",
  });
  flushHistoryGroup();
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("useDebouncedAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDefaultStore();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── dirty flag ───────────────────────────────────────────────────

  it("starts not dirty", () => {
    const repo = stubRepo();
    const { result } = renderHook(
      () => useDebouncedAutoSave({ workflowId: "w-1", debounceMs: 100 }),
      { wrapper: repoWrapper(repo) },
    );
    expect(result.current.dirty).toBe(false);
  });

  it("becomes dirty after a store mutation", () => {
    const repo = stubRepo();
    setupValidGraph();

    const { result } = renderHook(
      () => useDebouncedAutoSave({ workflowId: "w-1", debounceMs: 5000 }),
      { wrapper: repoWrapper(repo) },
    );

    // Position update + flush commits to temporal → triggers subscription
    act(() => {
      getStoreInstance()
        .getState()
        .updateNodePosition(getStoreInstance().getState().nodes[0].id, { x: 100, y: 100 });
      flushHistoryGroup();
    });

    expect(result.current.dirty).toBe(true);
  });

  // ── no save when clean ────────────────────────────────────────────

  it("does not call save when no mutations occur", () => {
    const save = vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v2"' }));
    const repo = stubRepo({ save });

    renderHook(() => useDebouncedAutoSave({ workflowId: "w-1", debounceMs: 100 }), {
      wrapper: repoWrapper(repo),
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(save).not.toHaveBeenCalled();
  });

  // ── save on dirty ─────────────────────────────────────────────────

  it("calls repo.save after debounce when graph is dirty and valid", () => {
    const save = vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v2"' }));
    const repo = stubRepo({ save });
    setupValidGraph();

    renderHook(() => useDebouncedAutoSave({ workflowId: "w-1", debounceMs: 2000 }), {
      wrapper: repoWrapper(repo),
    });

    act(() => {
      getStoreInstance()
        .getState()
        .updateNodePosition(getStoreInstance().getState().nodes[0].id, { x: 50, y: 50 });
      // Flush history group (~250ms) then advance past auto-save debounce
      vi.advanceTimersByTime(3000);
    });

    expect(save).toHaveBeenCalledTimes(1);
    const firstCall = save.mock.calls[0] as [string, Record<string, unknown>];
    expect(firstCall[0]).toBe("w-1");
    expect(firstCall[1]).toHaveProperty("schemaVersion", 1);
    expect(firstCall[1]).toHaveProperty("id", "w-1");
    expect(Array.isArray(firstCall[1].nodes)).toBe(true);
    expect(Array.isArray(firstCall[1].edges)).toBe(true);
  });

  it("clears dirty flag after successful save", async () => {
    const save = vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v2"' }));
    const repo = stubRepo({ save });
    setupValidGraph();

    const { result } = renderHook(
      () => useDebouncedAutoSave({ workflowId: "w-1", debounceMs: 2000 }),
      { wrapper: repoWrapper(repo) },
    );

    act(() => {
      getStoreInstance()
        .getState()
        .updateNodePosition(getStoreInstance().getState().nodes[0].id, { x: 50, y: 50 });
      flushHistoryGroup();
    });

    expect(result.current.dirty).toBe(true);

    // Advance past debounce to fire the timer
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(save).toHaveBeenCalledTimes(1);

    // Flush the async save promise so setDirty(false) is called
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.dirty).toBe(false);
  });

  it("keeps dirty flag true when save fails", async () => {
    const save = vi.fn().mockResolvedValue(err({ code: "NETWORK" as const, message: "offline" }));
    const repo = stubRepo({ save });
    setupValidGraph();

    const { result } = renderHook(
      () => useDebouncedAutoSave({ workflowId: "w-1", debounceMs: 2000 }),
      { wrapper: repoWrapper(repo) },
    );

    act(() => {
      getStoreInstance()
        .getState()
        .updateNodePosition(getStoreInstance().getState().nodes[0].id, { x: 50, y: 50 });
      flushHistoryGroup();
    });

    expect(result.current.dirty).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(save).toHaveBeenCalledTimes(1);

    // Flush the async save promise
    await act(async () => {
      await Promise.resolve();
    });

    // dirty should remain true because save failed
    expect(result.current.dirty).toBe(true);
  });

  // ── skip on invalid graph ─────────────────────────────────────────

  it("skips save when graph has validation errors", () => {
    const save = vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v2"' }));
    const repo = stubRepo({ save });

    const store = getStoreInstance();
    const state = store.getState();
    state.registerNodeSpec(startSpec);
    state.registerNodeSpec(endSpec);
    state.registerNodeSpec(taskSpec);

    // Only add a task node — no start node → NO_ENTRY_NODE error
    state.addNode(taskSpec, { x: 0, y: 0 });

    renderHook(() => useDebouncedAutoSave({ workflowId: "w-1", debounceMs: 500 }), {
      wrapper: repoWrapper(repo),
    });

    // Trigger another mutation
    act(() => {
      getStoreInstance().getState().addNode(taskSpec, { x: 100, y: 100 });
    });

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(save).not.toHaveBeenCalled();
  });

  // ── debounce resets on rapid mutations ─────────────────────────────

  it("resets debounce timer on each new mutation", () => {
    const save = vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v2"' }));
    const repo = stubRepo({ save });
    setupValidGraph();

    // Debounce 3000ms >> HISTORY_GROUP_DELAY (250ms flush)
    renderHook(() => useDebouncedAutoSave({ workflowId: "w-1", debounceMs: 3000 }), {
      wrapper: repoWrapper(repo),
    });

    const nodeId = getStoreInstance().getState().nodes[0].id;

    // First mutation — position update + flush (~250ms consumed from timer)
    act(() => {
      getStoreInstance().getState().updateNodePosition(nodeId, { x: 10, y: 10 });
      flushHistoryGroup(); // ~250ms elapsed from 3000ms timer
    });

    // Advance 1000ms more (total ~1250ms from timer start, well under 3000ms)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(save).not.toHaveBeenCalled();

    // Second mutation — resets the 3000ms timer
    act(() => {
      getStoreInstance().getState().updateNodePosition(nodeId, { x: 20, y: 20 });
      flushHistoryGroup(); // ~250ms consumed from NEW timer
    });

    // Advance 2000ms from new timer (~2250ms total since second mutation flush)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(save).not.toHaveBeenCalled();

    // Advance remaining 1000ms+ to cross the 3000ms threshold
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  // ── enabled = false ───────────────────────────────────────────────

  it("does not subscribe or save when enabled is false", () => {
    const save = vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v2"' }));
    const repo = stubRepo({ save });
    setupValidGraph();

    renderHook(
      () => useDebouncedAutoSave({ workflowId: "w-1", debounceMs: 2000, enabled: false }),
      { wrapper: repoWrapper(repo) },
    );

    act(() => {
      getStoreInstance()
        .getState()
        .updateNodePosition(getStoreInstance().getState().nodes[0].id, { x: 50, y: 50 });
      flushHistoryGroup();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(save).not.toHaveBeenCalled();
  });

  // ── cleanup on unmount ────────────────────────────────────────────

  it("cleans up timer on unmount", () => {
    const save = vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v2"' }));
    const repo = stubRepo({ save });
    setupValidGraph();

    const { unmount } = renderHook(
      () => useDebouncedAutoSave({ workflowId: "w-1", debounceMs: 2000 }),
      { wrapper: repoWrapper(repo) },
    );

    act(() => {
      getStoreInstance()
        .getState()
        .updateNodePosition(getStoreInstance().getState().nodes[0].id, { x: 50, y: 50 });
      flushHistoryGroup();
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(save).not.toHaveBeenCalled();
  });

  // ── default debounce constant ─────────────────────────────────────

  it("exports AUTO_SAVE_DEBOUNCE_MS as 10000", () => {
    expect(AUTO_SAVE_DEBOUNCE_MS).toBe(10_000);
  });
});
