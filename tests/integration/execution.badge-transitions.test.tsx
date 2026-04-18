import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, act, within } from "@testing-library/react";
import { createStore, type WorkflowState } from "@/store/createStore";
import { clearExecutionSelectorCache } from "@/store/selectors/executionSelectors";
import { FakeExecutionEventSource } from "@/adapters/FakeExecutionEventSource";
import type { StoreApi } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";

/**
 * Integration test: FakeExecutionEventSource drives badge transitions on
 * rendered canvas nodes (BaseNode).
 *
 * Uses the real adapter → store → selector → hook → component path:
 *   FakeExecutionEventSource.emit()
 *     → subscriber calls store.applyExecutionEvent()
 *     → zustand update
 *     → useExecutionState re-renders BaseNode
 *     → StatusBadge shows updated state
 *
 * Mocks only @/store/hooks to redirect useWorkflowStore to a test store.
 * Everything else (FakeExecutionEventSource, applyEvent, selectors,
 * useExecutionState, BaseNode, StatusBadge) is real.
 */

let store: StoreApi<WorkflowState>;

// Mock only the store-hook boundary to use our controlled test store.
vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector?: unknown, equalityFn?: unknown) =>
    useStoreWithEqualityFn(
      store,
      selector as (s: WorkflowState) => unknown,
      equalityFn as ((a: unknown, b: unknown) => boolean) | undefined,
    ),
}));

// Import after mock so the real hook binds to our test store
const { BaseNode } = await import("@/features/nodes/BaseNode");

const RUN_ID = "run-integration-1";
const NODE_IDS = ["node-A", "node-B", "node-C"] as const;

/** Renders 3 BaseNodes as a canvas surface. */
function ThreeNodeCanvas() {
  return (
    <div data-testid="canvas" role="application" aria-label="workflow canvas">
      <BaseNode title="Node A" icon="square-check" nodeId={NODE_IDS[0]} />
      <BaseNode title="Node B" icon="square-check" nodeId={NODE_IDS[1]} />
      <BaseNode title="Node C" icon="square-check" nodeId={NODE_IDS[2]} />
    </div>
  );
}

/** Get the badge for a specific node by querying the node's container. */
function getBadgeForNode(nodeId: string) {
  const nodes = screen.getAllByTestId("base-node");
  const nodeEl = nodes.find((el) => el.getAttribute("data-node-id") === nodeId);
  if (!nodeEl) return null;
  return within(nodeEl).queryByTestId("status-badge");
}

let fakeSource: FakeExecutionEventSource;
let unsubscribe: () => void;

beforeEach(() => {
  store = createStore();
  fakeSource = new FakeExecutionEventSource();

  // Start a run in the store and set it active
  store.getState().startRun(RUN_ID);

  // Bridge: subscribe the fake source for this run and feed events to the store
  unsubscribe = fakeSource.subscribe(RUN_ID, (event) => {
    store.getState().applyExecutionEvent(event);
  });
});

afterEach(() => {
  unsubscribe();
  fakeSource.close();
  cleanup();
  clearExecutionSelectorCache();
});

describe("Integration: FakeExecutionEventSource drives badge transitions", () => {
  it("no badges before any events are emitted", () => {
    render(<ThreeNodeCanvas />);
    expect(screen.queryAllByTestId("status-badge")).toHaveLength(0);
  });

  it("emitting node.started shows running badge on canvas node", () => {
    render(<ThreeNodeCanvas />);

    act(() => {
      fakeSource.emit({
        type: "node.started",
        runId: RUN_ID,
        nodeId: "node-A",
        at: 1000,
      });
    });

    const badge = getBadgeForNode("node-A");
    expect(badge).not.toBeNull();
    expect(badge).toHaveAttribute("data-status", "running");

    // Other nodes still have no badge
    expect(getBadgeForNode("node-B")).toBeNull();
    expect(getBadgeForNode("node-C")).toBeNull();
  });

  it("emitting node.started → node.succeeded transitions badge on canvas", () => {
    render(<ThreeNodeCanvas />);

    // Step 1: node.started
    act(() => {
      fakeSource.emit({
        type: "node.started",
        runId: RUN_ID,
        nodeId: "node-A",
        at: 1000,
      });
    });
    expect(getBadgeForNode("node-A")).toHaveAttribute("data-status", "running");

    // Step 2: node.succeeded
    act(() => {
      fakeSource.emit({
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: "node-A",
        at: 2000,
      });
    });
    expect(getBadgeForNode("node-A")).toHaveAttribute("data-status", "success");
  });

  it("drives all 3 canvas nodes through started → succeeded via emit", () => {
    render(<ThreeNodeCanvas />);

    // Emit node.started for all 3
    act(() => {
      for (const nodeId of NODE_IDS) {
        fakeSource.emit({
          type: "node.started",
          runId: RUN_ID,
          nodeId,
          at: 1000,
        });
      }
    });

    // All 3 should show running
    for (const nodeId of NODE_IDS) {
      expect(getBadgeForNode(nodeId)).toHaveAttribute("data-status", "running");
    }

    // Succeed them one by one and assert at each step
    act(() => {
      fakeSource.emit({
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: "node-A",
        at: 2000,
      });
    });
    expect(getBadgeForNode("node-A")).toHaveAttribute("data-status", "success");
    expect(getBadgeForNode("node-B")).toHaveAttribute("data-status", "running");
    expect(getBadgeForNode("node-C")).toHaveAttribute("data-status", "running");

    act(() => {
      fakeSource.emit({
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: "node-B",
        at: 3000,
      });
    });
    expect(getBadgeForNode("node-B")).toHaveAttribute("data-status", "success");
    expect(getBadgeForNode("node-C")).toHaveAttribute("data-status", "running");

    act(() => {
      fakeSource.emit({
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: "node-C",
        at: 4000,
      });
    });
    for (const nodeId of NODE_IDS) {
      expect(getBadgeForNode(nodeId)).toHaveAttribute("data-status", "success");
    }
  });

  it("handles success + error paths via fake source emit", () => {
    render(<ThreeNodeCanvas />);

    act(() => {
      for (const nodeId of NODE_IDS) {
        fakeSource.emit({
          type: "node.started",
          runId: RUN_ID,
          nodeId,
          at: 1000,
        });
      }
    });

    act(() => {
      fakeSource.emit({
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: "node-A",
        at: 2000,
      });
      fakeSource.emit({
        type: "node.failed",
        runId: RUN_ID,
        nodeId: "node-B",
        at: 2000,
        payload: { error: "timeout" },
      });
      fakeSource.emit({
        type: "node.skipped",
        runId: RUN_ID,
        nodeId: "node-C",
        at: 2000,
      });
    });

    expect(getBadgeForNode("node-A")).toHaveAttribute("data-status", "success");
    expect(getBadgeForNode("node-B")).toHaveAttribute("data-status", "error");
    expect(getBadgeForNode("node-C")).toHaveAttribute("data-status", "skipped");
  });

  it("closing the fake source stops event delivery", () => {
    render(<ThreeNodeCanvas />);

    act(() => {
      fakeSource.emit({
        type: "node.started",
        runId: RUN_ID,
        nodeId: "node-A",
        at: 1000,
      });
    });
    expect(getBadgeForNode("node-A")).toHaveAttribute("data-status", "running");

    // Close the source
    fakeSource.close();

    // Emit after close — should not change state
    act(() => {
      fakeSource.emit({
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: "node-A",
        at: 2000,
      });
    });

    // Still running — the emit was swallowed
    expect(getBadgeForNode("node-A")).toHaveAttribute("data-status", "running");
  });
});
