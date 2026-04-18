import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { NodeExecutionState } from "@/store/slices/executionSlice";

// ─── Mock useExecutionState ──────────────────────────────────────────
// The hook is mocked so we can control execution state without a real store.

let mockExecState: NodeExecutionState | undefined;
const subscribedNodeIds: string[] = [];

vi.mock("@/features/execution/useExecutionState", () => ({
  useExecutionState: (nodeId: string) => {
    subscribedNodeIds.push(nodeId);
    return mockExecState;
  },
}));

// Must import after mock setup
const { BaseNode } = await import("@/features/nodes/BaseNode");

afterEach(() => {
  cleanup();
  mockExecState = undefined;
  subscribedNodeIds.length = 0;
});

describe("BaseNode execution badges", () => {
  // ── No badge when no execution state ────────────────────────────

  it("does not render badges when there is no execution state", () => {
    mockExecState = undefined;
    render(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    expect(screen.queryByTestId("node-badges")).not.toBeInTheDocument();
    expect(screen.queryByTestId("status-badge")).not.toBeInTheDocument();
  });

  it("does not render badges when nodeId is not provided", () => {
    mockExecState = { status: "running", startedAt: 100 };
    render(<BaseNode title="Task" icon="square-check" />);
    expect(screen.queryByTestId("node-badges")).not.toBeInTheDocument();
  });

  // ── Badge appears for each execution status ────────────────────

  it("renders a running StatusBadge when node is running", () => {
    mockExecState = { status: "running", startedAt: 100 };
    render(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-status", "running");
  });

  it("renders a pending StatusBadge when node is idle", () => {
    mockExecState = { status: "idle" };
    render(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveAttribute("data-status", "pending");
  });

  it("renders a success StatusBadge when node succeeded", () => {
    mockExecState = { status: "succeeded", startedAt: 100, finishedAt: 200 };
    render(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveAttribute("data-status", "success");
  });

  it("renders an error StatusBadge when node failed", () => {
    mockExecState = { status: "failed", startedAt: 100, finishedAt: 200, error: "oops" };
    render(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveAttribute("data-status", "error");
  });

  it("renders a skipped StatusBadge when node is skipped", () => {
    mockExecState = { status: "skipped" };
    render(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveAttribute("data-status", "skipped");
  });

  // ── Badge updates on store change ──────────────────────────────

  it("updates badge when execution state changes via re-render", () => {
    mockExecState = { status: "idle" };
    const { rerender } = render(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-status", "pending");

    mockExecState = { status: "running", startedAt: 100 };
    rerender(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-status", "running");

    mockExecState = { status: "succeeded", startedAt: 100, finishedAt: 200 };
    rerender(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-status", "success");
  });

  // ── IterationBadge ─────────────────────────────────────────────

  it("renders IterationBadge when iteration is present", () => {
    mockExecState = { status: "running", startedAt: 100, iteration: 3, totalIterations: 10 };
    render(<BaseNode title="Loop" icon="repeat" nodeId="loop-1" />);
    expect(screen.getByTestId("iteration-badge")).toBeInTheDocument();
    expect(screen.getByTestId("iteration-text").textContent).toBe("3 / 10");
  });

  it("does not render IterationBadge when iteration is absent", () => {
    mockExecState = { status: "running", startedAt: 100 };
    render(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    expect(screen.queryByTestId("iteration-badge")).not.toBeInTheDocument();
  });

  it("updates IterationBadge on iteration change", () => {
    mockExecState = { status: "running", startedAt: 100, iteration: 1, totalIterations: 5 };
    const { rerender } = render(<BaseNode title="Loop" icon="repeat" nodeId="loop-1" />);
    expect(screen.getByTestId("iteration-text").textContent).toBe("1 / 5");

    mockExecState = { status: "running", startedAt: 100, iteration: 4, totalIterations: 5 };
    rerender(<BaseNode title="Loop" icon="repeat" nodeId="loop-1" />);
    expect(screen.getByTestId("iteration-text").textContent).toBe("4 / 5");
  });

  // ── Hook subscribes to correct nodeId ──────────────────────────

  it("passes nodeId to useExecutionState hook", () => {
    mockExecState = undefined;
    render(<BaseNode title="Task" icon="square-check" nodeId="my-node-42" />);
    expect(subscribedNodeIds).toContain("my-node-42");
  });

  // ── No subscription leak ───────────────────────────────────────

  it("stops subscribing after unmount (no leak)", () => {
    mockExecState = { status: "running", startedAt: 100 };
    const { unmount } = render(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    unmount();

    // After unmount, subsequent renders of unrelated components should not
    // invoke the hook for this node. We verify by re-rendering a fresh node.
    mockExecState = undefined;
    subscribedNodeIds.length = 0;
    render(<BaseNode title="Other" icon="play" nodeId="node-2" />);
    // Only node-2 should be subscribed, not node-1
    expect(subscribedNodeIds).not.toContain("node-1");
    expect(subscribedNodeIds).toContain("node-2");
  });

  // ── Badge container structure ──────────────────────────────────

  it("renders badge container with proper test id", () => {
    mockExecState = { status: "running", startedAt: 100 };
    render(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    const container = screen.getByTestId("node-badges");
    expect(container).toBeInTheDocument();
    // Contains both StatusBadge and potentially IterationBadge
    expect(container.querySelector("[data-testid='status-badge']")).not.toBeNull();
  });

  it("badge container disappears when state returns to undefined", () => {
    mockExecState = { status: "running", startedAt: 100 };
    const { rerender } = render(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    expect(screen.getByTestId("node-badges")).toBeInTheDocument();

    mockExecState = undefined;
    rerender(<BaseNode title="Task" icon="square-check" nodeId="node-1" />);
    expect(screen.queryByTestId("node-badges")).not.toBeInTheDocument();
  });

  // ── Does not break existing BaseNode features ──────────────────

  it("still renders header, body, and selection when badges are active", () => {
    mockExecState = { status: "running", startedAt: 100 };
    render(
      <BaseNode title="My Task" icon="square-check" nodeId="node-1" selected>
        <span data-testid="child">content</span>
      </BaseNode>,
    );
    expect(screen.getByTestId("node-header").textContent).toContain("My Task");
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByTestId("base-node")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("status-badge")).toBeInTheDocument();
  });
});
