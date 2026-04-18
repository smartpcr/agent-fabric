import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, act, within } from "@testing-library/react";
import { createStore, type WorkflowState } from "@/store/createStore";
import { clearExecutionSelectorCache } from "@/store/selectors/executionSelectors";
import type { StoreApi } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";

/**
 * Integration test: fake execution source drives badge transitions on
 * rendered BaseNode components.
 *
 * Renders 3 nodes, emits `run.started` → per-node `node.started` →
 * `node.succeeded` (or `node.failed`) events via the store's
 * `applyExecutionEvent` action, and asserts badge status at each step.
 */

let store: StoreApi<WorkflowState>;

// Mock only the store-hook boundary to use our controlled test store.
// The real useExecutionState hook + selectNodeExecutionState are exercised.
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

function ThreeNodeCanvas() {
  return (
    <div data-testid="canvas">
      <BaseNode title="Node A" icon="square-check" nodeId={NODE_IDS[0]} />
      <BaseNode title="Node B" icon="square-check" nodeId={NODE_IDS[1]} />
      <BaseNode title="Node C" icon="square-check" nodeId={NODE_IDS[2]} />
    </div>
  );
}

/** Get all status badges from the rendered canvas. */
function getAllBadges() {
  return screen.getAllByTestId("status-badge");
}

/** Get the badge for a specific node by querying the node's container. */
function getBadgeForNode(nodeId: string) {
  const nodes = screen.getAllByTestId("base-node");
  const nodeEl = nodes.find((el) => el.getAttribute("data-node-id") === nodeId);
  if (!nodeEl) return null;
  return within(nodeEl).queryByTestId("status-badge");
}

beforeEach(() => {
  store = createStore();
});

afterEach(() => {
  cleanup();
  clearExecutionSelectorCache();
});

describe("Integration: execution badge transitions", () => {
  it("no badges before any execution events", () => {
    render(<ThreeNodeCanvas />);
    expect(screen.queryAllByTestId("status-badge")).toHaveLength(0);
  });

  it("badges appear for all 3 nodes after run.started + node.started events", () => {
    render(<ThreeNodeCanvas />);

    // Start a run and set it active
    act(() => {
      store.getState().startRun(RUN_ID);
    });

    // Still no badges — nodes have no execution state yet
    expect(screen.queryAllByTestId("status-badge")).toHaveLength(0);

    // Emit node.started for all 3 nodes
    act(() => {
      for (const nodeId of NODE_IDS) {
        store.getState().applyExecutionEvent({
          type: "node.started",
          runId: RUN_ID,
          nodeId,
          at: Date.now(),
        });
      }
    });

    // All 3 nodes should now show running badges
    const badges = getAllBadges();
    expect(badges).toHaveLength(3);
    for (const badge of badges) {
      expect(badge).toHaveAttribute("data-status", "running");
    }
  });

  it("drives node A through started → succeeded transition", () => {
    render(<ThreeNodeCanvas />);

    act(() => {
      store.getState().startRun(RUN_ID);
    });

    // Start node A
    act(() => {
      store.getState().applyExecutionEvent({
        type: "node.started",
        runId: RUN_ID,
        nodeId: "node-A",
        at: 1000,
      });
    });

    const badgeA = getBadgeForNode("node-A");
    expect(badgeA).not.toBeNull();
    expect(badgeA).toHaveAttribute("data-status", "running");

    // Node B and C should not have badges yet
    expect(getBadgeForNode("node-B")).toBeNull();
    expect(getBadgeForNode("node-C")).toBeNull();

    // Succeed node A
    act(() => {
      store.getState().applyExecutionEvent({
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: "node-A",
        at: 2000,
      });
    });

    const updatedBadge = getBadgeForNode("node-A");
    expect(updatedBadge).toHaveAttribute("data-status", "success");
  });

  it("drives full 3-node sequence: started → succeeded for each", () => {
    render(<ThreeNodeCanvas />);

    act(() => {
      store.getState().startRun(RUN_ID);
    });

    // Start all 3 nodes
    act(() => {
      for (const nodeId of NODE_IDS) {
        store.getState().applyExecutionEvent({
          type: "node.started",
          runId: RUN_ID,
          nodeId,
          at: 1000,
        });
      }
    });

    // All running
    for (const nodeId of NODE_IDS) {
      expect(getBadgeForNode(nodeId)).toHaveAttribute("data-status", "running");
    }

    // Succeed node-A
    act(() => {
      store.getState().applyExecutionEvent({
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: "node-A",
        at: 2000,
      });
    });
    expect(getBadgeForNode("node-A")).toHaveAttribute("data-status", "success");
    expect(getBadgeForNode("node-B")).toHaveAttribute("data-status", "running");
    expect(getBadgeForNode("node-C")).toHaveAttribute("data-status", "running");

    // Succeed node-B
    act(() => {
      store.getState().applyExecutionEvent({
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: "node-B",
        at: 3000,
      });
    });
    expect(getBadgeForNode("node-A")).toHaveAttribute("data-status", "success");
    expect(getBadgeForNode("node-B")).toHaveAttribute("data-status", "success");
    expect(getBadgeForNode("node-C")).toHaveAttribute("data-status", "running");

    // Succeed node-C
    act(() => {
      store.getState().applyExecutionEvent({
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

  it("handles mixed success and failure paths", () => {
    render(<ThreeNodeCanvas />);

    act(() => {
      store.getState().startRun(RUN_ID);
    });

    // Start all nodes
    act(() => {
      for (const nodeId of NODE_IDS) {
        store.getState().applyExecutionEvent({
          type: "node.started",
          runId: RUN_ID,
          nodeId,
          at: 1000,
        });
      }
    });

    // Succeed node-A, fail node-B, skip node-C
    act(() => {
      store.getState().applyExecutionEvent({
        type: "node.succeeded",
        runId: RUN_ID,
        nodeId: "node-A",
        at: 2000,
      });
      store.getState().applyExecutionEvent({
        type: "node.failed",
        runId: RUN_ID,
        nodeId: "node-B",
        at: 2000,
        payload: { error: "timeout" },
      });
      store.getState().applyExecutionEvent({
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

  it("badges disappear when run is cleared", () => {
    render(<ThreeNodeCanvas />);

    act(() => {
      store.getState().startRun(RUN_ID);
      store.getState().applyExecutionEvent({
        type: "node.started",
        runId: RUN_ID,
        nodeId: "node-A",
        at: 1000,
      });
    });

    expect(getBadgeForNode("node-A")).not.toBeNull();

    // Clear the run
    act(() => {
      store.getState().clearRun(RUN_ID);
    });

    // Badges should be gone (activeRunId cleared)
    expect(screen.queryAllByTestId("status-badge")).toHaveLength(0);
  });
});
