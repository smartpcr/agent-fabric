import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatusBadge, type BadgeStatus } from "@/features/nodes/badges/StatusBadge";

afterEach(() => {
  cleanup();
});

// ─── Status × icon × label mapping ──────────────────────────────────

const STATUS_CASES: { status: BadgeStatus; expectedLabel: string; iconTestId: string }[] = [
  { status: "pending", expectedLabel: "Pending", iconTestId: "badge-icon-pending" },
  { status: "running", expectedLabel: "Running", iconTestId: "badge-icon-running" },
  { status: "success", expectedLabel: "Succeeded", iconTestId: "badge-icon-success" },
  { status: "error", expectedLabel: "Failed", iconTestId: "badge-icon-error" },
  { status: "skipped", expectedLabel: "Skipped", iconTestId: "badge-icon-skipped" },
];

describe("StatusBadge", () => {
  // ── Per-state rendering ──────────────────────────────────────

  describe.each(STATUS_CASES)("status = $status", ({ status, expectedLabel, iconTestId }) => {
    it("renders the correct icon", () => {
      render(<StatusBadge status={status} />);
      const icon = screen.getByTestId(iconTestId);
      expect(icon).toBeInTheDocument();
      expect(icon.tagName.toLowerCase()).toBe("svg");
    });

    it("renders the correct label text", () => {
      render(<StatusBadge status={status} />);
      const label = screen.getByTestId("badge-label");
      expect(label.textContent).toBe(expectedLabel);
    });

    it("has role=status", () => {
      render(<StatusBadge status={status} />);
      const badge = screen.getByRole("status");
      expect(badge).toBeInTheDocument();
    });

    it("has aria-label describing the state", () => {
      render(<StatusBadge status={status} />);
      const badge = screen.getByRole("status");
      expect(badge).toHaveAttribute("aria-label", expectedLabel);
    });

    it("sets data-status attribute", () => {
      render(<StatusBadge status={status} />);
      const badge = screen.getByTestId("status-badge");
      expect(badge).toHaveAttribute("data-status", status);
    });

    it("icon has aria-hidden=true", () => {
      render(<StatusBadge status={status} />);
      const icon = screen.getByTestId(iconTestId);
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  // ── Structural checks ────────────────────────────────────────

  it("renders as a span element", () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge.tagName.toLowerCase()).toBe("span");
  });

  it("renders exactly one icon and one label", () => {
    render(<StatusBadge status="success" />);
    const badge = screen.getByTestId("status-badge");
    const svg = badge.querySelector("svg");
    expect(svg).not.toBeNull();
    const label = screen.getByTestId("badge-label");
    expect(label).toBeInTheDocument();
  });

  it("renders different icons for different statuses", () => {
    const { unmount } = render(<StatusBadge status="pending" />);
    const pendingIcon = screen.getByTestId("badge-icon-pending").innerHTML;
    unmount();

    render(<StatusBadge status="error" />);
    const errorIcon = screen.getByTestId("badge-icon-error").innerHTML;

    expect(pendingIcon).not.toBe(errorIcon);
  });
});
