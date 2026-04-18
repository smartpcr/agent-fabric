import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusBadge } from "@/features/nodes/badges/StatusBadge";
import type { NodeExecutionState } from "@/store/slices/executionSlice";

// ─── Mock for BaseNode openInspector integration test ────────────────

let mockExecState: NodeExecutionState | undefined;
const mockOpenInspector = vi.fn();

vi.mock("@/features/execution/useExecutionState", () => ({
  useExecutionState: (_nodeId: string) => mockExecState,
}));

vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      openInspector: mockOpenInspector,
    }),
}));

const { BaseNode } = await import("@/features/nodes/BaseNode");

afterEach(() => {
  cleanup();
  mockExecState = undefined;
  mockOpenInspector.mockClear();
});

describe("StatusBadge — error tooltip", () => {
  // ── Tooltip present on error with message ──────────────────────

  it("renders tooltip trigger when status is error with errorMessage", () => {
    render(<StatusBadge status="error" errorMessage="Something went wrong" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-status", "error");
  });

  it("shows tooltip content on hover with error message", async () => {
    render(<StatusBadge status="error" errorMessage="Something went wrong" />);
    const badge = screen.getByTestId("status-badge");

    // Hover over the badge to trigger tooltip
    await userEvent.hover(badge);

    // Radix tooltip should appear
    await waitFor(() => {
      expect(screen.getByTestId("error-tooltip")).toBeInTheDocument();
    });
    expect(screen.getByTestId("error-tooltip").textContent).toContain("Something went wrong");
  });

  it("truncates error message to 200 characters", async () => {
    const longMessage = "A".repeat(250);
    render(<StatusBadge status="error" errorMessage={longMessage} />);
    const badge = screen.getByTestId("status-badge");
    await userEvent.hover(badge);

    await waitFor(() => {
      expect(screen.getByTestId("error-tooltip")).toBeInTheDocument();
    });

    const tooltipEl = screen.getByTestId("error-tooltip");
    const tooltipText = tooltipEl.textContent ?? "";
    // Should contain truncated text (200 A's) + ellipsis
    expect(tooltipText).toContain("A".repeat(200));
    expect(tooltipText).toContain("…");
    // Should NOT contain the full 250 A's
    expect(tooltipText).not.toContain("A".repeat(201));
  });

  it("shows full message when under 200 characters", async () => {
    const shortMessage = "Stack overflow at line 42";
    render(<StatusBadge status="error" errorMessage={shortMessage} />);
    const badge = screen.getByTestId("status-badge");
    await userEvent.hover(badge);

    await waitFor(() => {
      expect(screen.getByTestId("error-tooltip")).toBeInTheDocument();
    });
    const tooltipText = screen.getByTestId("error-tooltip").textContent ?? "";
    expect(tooltipText).toContain(shortMessage);
    expect(tooltipText).not.toContain("…");
  });

  // ── No tooltip when not error or no message ────────────────────

  it("does not render tooltip when status is not error", () => {
    render(<StatusBadge status="success" />);
    // No tooltip trigger wrapper — just the badge
    expect(screen.getByTestId("status-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("error-tooltip")).not.toBeInTheDocument();
  });

  it("does not render tooltip when error but no errorMessage", () => {
    render(<StatusBadge status="error" />);
    expect(screen.getByTestId("status-badge")).toBeInTheDocument();
    // No tooltip should be wrapping
    expect(screen.queryByTestId("error-tooltip")).not.toBeInTheDocument();
  });

  it("does not render tooltip when errorMessage is empty string", () => {
    render(<StatusBadge status="error" errorMessage="" />);
    expect(screen.getByTestId("status-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("error-tooltip")).not.toBeInTheDocument();
  });

  // ── Click dispatches onErrorClick ──────────────────────────────

  it("calls onErrorClick when the error badge is clicked", () => {
    const handleClick = vi.fn();
    render(<StatusBadge status="error" errorMessage="oops" onErrorClick={handleClick} />);
    const badge = screen.getByTestId("status-badge");
    fireEvent.click(badge);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onErrorClick when status is not error", () => {
    const handleClick = vi.fn();
    render(<StatusBadge status="success" onErrorClick={handleClick} />);
    const badge = screen.getByTestId("status-badge");
    fireEvent.click(badge);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("has cursor pointer style on error badge with onErrorClick", () => {
    const handleClick = vi.fn();
    render(<StatusBadge status="error" errorMessage="oops" onErrorClick={handleClick} />);
    const badge = screen.getByTestId("status-badge");
    expect(badge.style.cursor).toBe("pointer");
  });

  it("does not have cursor pointer when no onErrorClick", () => {
    render(<StatusBadge status="error" errorMessage="oops" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge.style.cursor).not.toBe("pointer");
  });

  // ── Does not break non-error states ────────────────────────────

  it("still renders correctly for pending state", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-status", "pending");
    expect(screen.getByTestId("badge-label").textContent).toBe("Pending");
  });

  it("still renders correctly for running state", () => {
    render(<StatusBadge status="running" />);
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-status", "running");
    expect(screen.getByTestId("badge-label").textContent).toBe("Running");
  });

  // ── role="status" preserved even when clickable ────────────────

  it("keeps role=status on clickable error badge", () => {
    const handleClick = vi.fn();
    render(<StatusBadge status="error" errorMessage="oops" onErrorClick={handleClick} />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveAttribute("role", "status");
  });
});

// ─── Integration: error badge click dispatches openInspector ─────────

describe("BaseNode error badge → openInspector integration", () => {
  it("clicking error badge dispatches openInspector(nodeId)", () => {
    mockExecState = { status: "failed", startedAt: 100, finishedAt: 200, error: "some error" };
    render(<BaseNode title="Task" icon="square-check" nodeId="node-42" />);

    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveAttribute("data-status", "error");
    fireEvent.click(badge);

    expect(mockOpenInspector).toHaveBeenCalledTimes(1);
    expect(mockOpenInspector).toHaveBeenCalledWith("node-42");
  });

  it("clicking non-error badge does not dispatch openInspector", () => {
    mockExecState = { status: "running", startedAt: 100 };
    render(<BaseNode title="Task" icon="square-check" nodeId="node-42" />);

    const badge = screen.getByTestId("status-badge");
    fireEvent.click(badge);

    expect(mockOpenInspector).not.toHaveBeenCalled();
  });

  it("error badge shows tooltip with error message from execution state", async () => {
    mockExecState = {
      status: "failed",
      startedAt: 100,
      finishedAt: 200,
      error: "Connection timeout",
    };
    render(<BaseNode title="Task" icon="square-check" nodeId="node-42" />);

    const badge = screen.getByTestId("status-badge");
    await userEvent.hover(badge);

    await waitFor(() => {
      expect(screen.getByTestId("error-tooltip")).toBeInTheDocument();
    });
    expect(screen.getByTestId("error-tooltip").textContent).toContain("Connection timeout");
  });
});
