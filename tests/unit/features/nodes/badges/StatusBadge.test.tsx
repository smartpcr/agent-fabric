import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatusBadge, type BadgeStatus } from "@/features/nodes/badges/StatusBadge";

afterEach(() => {
  cleanup();
});

// ─── Status × icon × label mapping ──────────────────────────────────

const STATUS_CASES: {
  status: BadgeStatus;
  expectedLabel: string;
  iconTestId: string;
  expectedIconClass: string;
}[] = [
  {
    status: "pending",
    expectedLabel: "Pending",
    iconTestId: "badge-icon-pending",
    expectedIconClass: "lucide-clock",
  },
  {
    status: "running",
    expectedLabel: "Running",
    iconTestId: "badge-icon-running",
    expectedIconClass: "lucide-loader-circle",
  },
  {
    status: "success",
    expectedLabel: "Succeeded",
    iconTestId: "badge-icon-success",
    expectedIconClass: "lucide-circle-check",
  },
  {
    status: "error",
    expectedLabel: "Failed",
    iconTestId: "badge-icon-error",
    expectedIconClass: "lucide-circle-x",
  },
  {
    status: "skipped",
    expectedLabel: "Skipped",
    iconTestId: "badge-icon-skipped",
    expectedIconClass: "lucide-skip-forward",
  },
];

describe("StatusBadge", () => {
  // ── Per-state rendering ──────────────────────────────────────

  describe.each(STATUS_CASES)(
    "status = $status",
    ({ status, expectedLabel, iconTestId, expectedIconClass }) => {
      it("renders the correct icon", () => {
        render(<StatusBadge status={status} />);
        const icon = screen.getByTestId(iconTestId);
        expect(icon).toBeInTheDocument();
        expect(icon.tagName.toLowerCase()).toBe("svg");
      });

      it("renders the expected lucide icon for the status", () => {
        render(<StatusBadge status={status} />);
        const icon = screen.getByTestId(iconTestId);
        expect(icon.classList.toString()).toContain(expectedIconClass);
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
    },
  );

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

  it("all five statuses produce distinct icons", () => {
    const iconClasses = new Set<string>();
    for (const { status, iconTestId } of STATUS_CASES) {
      const { unmount } = render(<StatusBadge status={status} />);
      const icon = screen.getByTestId(iconTestId);
      iconClasses.add(icon.classList.toString());
      unmount();
    }
    expect(iconClasses.size).toBe(5);
  });
});
