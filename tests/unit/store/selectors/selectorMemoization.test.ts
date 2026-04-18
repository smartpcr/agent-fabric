import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "@/store/createStore";
import {
  selectNodeSpec,
  selectIsPortMissing,
  clearSelectorCache,
} from "@/store/selectors/graphSelectors";
import {
  selectNodeExecutionState,
  selectEdgeExecutionState,
  clearExecutionSelectorCache,
} from "@/store/selectors/executionSelectors";
import type { NodeSpec } from "@/domain/models/nodeSpec";

/**
 * Selector memoization audit tests.
 *
 * These tests verify that selectors return referentially stable values
 * when the underlying data hasn't changed — preventing unnecessary
 * re-renders in React components that depend on these selectors.
 */

beforeEach(() => {
  clearSelectorCache();
  clearExecutionSelectorCache();
});

describe("selectNodeSpec reference stability", () => {
  it("returns the same reference on consecutive calls with unchanged registry", () => {
    const store = createStore();
    const spec: NodeSpec = {
      kind: "task",
      label: "Task",
      icon: "cog",
      ports: [],
      defaultData: {},
    };
    store.getState().registerNodeSpec(spec);

    const state = store.getState();
    const first = selectNodeSpec(state, "task");
    const second = selectNodeSpec(state, "task");

    expect(first).toBe(second);
  });

  it("returns the same reference after unrelated state changes", () => {
    const store = createStore();
    const spec: NodeSpec = {
      kind: "task",
      label: "Task",
      icon: "cog",
      ports: [],
      defaultData: {},
    };
    store.getState().registerNodeSpec(spec);

    const first = selectNodeSpec(store.getState(), "task");

    // Unrelated state change — viewport pan
    store.getState().setPan(100, 200);

    const second = selectNodeSpec(store.getState(), "task");
    expect(first).toBe(second);
  });

  it("returns undefined stably for unknown kinds", () => {
    const store = createStore();
    const first = selectNodeSpec(store.getState(), "nonexistent");
    const second = selectNodeSpec(store.getState(), "nonexistent");
    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
  });
});

describe("selectIsPortMissing memoization", () => {
  it("returns cached result on repeat calls with same edges", () => {
    const store = createStore();
    const spec: NodeSpec = {
      kind: "task",
      label: "Task",
      icon: "cog",
      ports: [
        { id: "in", kind: "in" as const, label: "Input", required: true },
        { id: "out", kind: "out" as const, label: "Output" },
      ],
      defaultData: {},
    };
    store.getState().registerNodeSpec(spec);
    const node = store.getState().addNode(spec);

    const state = store.getState();

    // No edges → port is missing
    const first = selectIsPortMissing(state, node.id, "in", true);
    const second = selectIsPortMissing(state, node.id, "in", true);
    expect(first).toBe(true);
    expect(second).toBe(true);
    // Both should have been cached (same edges reference)
  });

  it("invalidates cache when edges change", () => {
    const store = createStore();
    const spec: NodeSpec = {
      kind: "task",
      label: "Task",
      icon: "cog",
      ports: [
        { id: "in", kind: "in" as const, label: "Input", required: true },
        { id: "out", kind: "out" as const, label: "Output" },
      ],
      defaultData: {},
    };
    store.getState().registerNodeSpec(spec);
    const nodeA = store.getState().addNode(spec);
    const nodeB = store.getState().addNode(spec);

    // Before connection — port is missing
    expect(selectIsPortMissing(store.getState(), nodeB.id, "in", true)).toBe(true);

    // Add an edge by restoring graph with the existing nodes + a new edge
    const { nodes } = store.getState();
    store.getState().restoreGraph(nodes, [
      {
        id: "e1",
        source: nodeA.id,
        sourcePort: "out",
        target: nodeB.id,
        targetPort: "in",
      },
    ]);

    // After connection — port is no longer missing
    expect(selectIsPortMissing(store.getState(), nodeB.id, "in", true)).toBe(false);
  });

  it("returns false without checking edges when required is false", () => {
    const store = createStore();
    expect(selectIsPortMissing(store.getState(), "any", "port", false)).toBe(false);
    expect(selectIsPortMissing(store.getState(), "any", "port", undefined)).toBe(false);
  });
});

describe("selectNodeExecutionState reference stability", () => {
  it("returns the same reference for unchanged node execution state", () => {
    const store = createStore();
    const runId = "run-1";
    store.getState().startRun(runId);

    // Apply an event to create node state
    store.getState().applyExecutionEvent({
      type: "node.started",
      runId,
      nodeId: "n1",
      at: Date.now(),
    });

    const first = selectNodeExecutionState(store.getState(), runId, "n1");

    // Unrelated state change
    store.getState().setPan(50, 50);

    const second = selectNodeExecutionState(store.getState(), runId, "n1");
    expect(first).toBe(second);
  });

  it("returns new reference when node execution state changes", () => {
    const store = createStore();
    const runId = "run-1";
    store.getState().startRun(runId);

    store.getState().applyExecutionEvent({
      type: "node.started",
      runId,
      nodeId: "n1",
      at: Date.now(),
    });
    const first = selectNodeExecutionState(store.getState(), runId, "n1");

    store.getState().applyExecutionEvent({
      type: "node.succeeded",
      runId,
      nodeId: "n1",
      at: Date.now(),
    });
    const second = selectNodeExecutionState(store.getState(), runId, "n1");

    expect(first).not.toBe(second);
    expect(first?.status).toBe("running");
    expect(second?.status).toBe("succeeded");
  });
});

describe("selectEdgeExecutionState reference stability", () => {
  it("returns the same reference for unchanged edge execution state", () => {
    const store = createStore();
    const runId = "run-1";
    store.getState().startRun(runId);

    store.getState().applyExecutionEvent({
      type: "edge.activated",
      runId,
      edgeId: "e1",
      at: Date.now(),
    });

    const first = selectEdgeExecutionState(store.getState(), runId, "e1");

    // Unrelated state change
    store.getState().setPan(100, 100);

    const second = selectEdgeExecutionState(store.getState(), runId, "e1");
    expect(first).toBe(second);
  });
});

describe("React.memo on node/edge components", () => {
  it("node components are wrapped in memo", async () => {
    const taskMod = await import("@/features/nodes/TaskNode");
    const startMod = await import("@/features/nodes/StartNode");
    const endMod = await import("@/features/nodes/EndNode");
    const decisionMod = await import("@/features/nodes/DecisionNode");
    const loopMod = await import("@/features/nodes/LoopNode");

    // React.memo components have a $$typeof of Symbol.for("react.memo")
    const MEMO_TYPE = Symbol.for("react.memo");
    expect((taskMod.TaskNode as unknown as { $$typeof: symbol }).$$typeof).toBe(MEMO_TYPE);
    expect((startMod.StartNode as unknown as { $$typeof: symbol }).$$typeof).toBe(MEMO_TYPE);
    expect((endMod.EndNode as unknown as { $$typeof: symbol }).$$typeof).toBe(MEMO_TYPE);
    expect((decisionMod.DecisionNode as unknown as { $$typeof: symbol }).$$typeof).toBe(MEMO_TYPE);
    expect((loopMod.LoopNode as unknown as { $$typeof: symbol }).$$typeof).toBe(MEMO_TYPE);
  });

  it("edge components are wrapped in memo", async () => {
    const defaultMod = await import("@/features/edges/DefaultEdge");
    const conditionalMod = await import("@/features/edges/ConditionalEdge");
    const loopBackMod = await import("@/features/edges/LoopBackEdge");

    const MEMO_TYPE = Symbol.for("react.memo");
    expect((defaultMod.DefaultEdge as unknown as { $$typeof: symbol }).$$typeof).toBe(MEMO_TYPE);
    expect((conditionalMod.ConditionalEdge as unknown as { $$typeof: symbol }).$$typeof).toBe(
      MEMO_TYPE,
    );
    expect((loopBackMod.LoopBackEdge as unknown as { $$typeof: symbol }).$$typeof).toBe(MEMO_TYPE);
  });
});
