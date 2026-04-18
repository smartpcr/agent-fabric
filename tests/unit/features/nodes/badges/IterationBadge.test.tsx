import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { IterationBadge } from "@/features/nodes/badges/IterationBadge";

afterEach(() => {
  cleanup();
});

describe("IterationBadge", () => {
  // ── Absent when not a loop ─────────────────────────────────────

  it("returns null when iteration is undefined", () => {
    const { container } = render(<IterationBadge />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when iteration is explicitly undefined", () => {
    const { container } = render(<IterationBadge iteration={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  // ── Renders with iteration only ────────────────────────────────

  it("shows iteration number with ? when total is absent", () => {
    render(<IterationBadge iteration={3} />);
    const text = screen.getByTestId("iteration-text");
    expect(text.textContent).toBe("3 / ?");
  });

  it("has correct aria-label without total", () => {
    render(<IterationBadge iteration={5} />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-label", "Iteration 5");
  });

  // ── Renders with iteration and total ───────────────────────────

  it("shows N / total when total is provided", () => {
    render(<IterationBadge iteration={2} total={10} />);
    const text = screen.getByTestId("iteration-text");
    expect(text.textContent).toBe("2 / 10");
  });

  it("has correct aria-label with total", () => {
    render(<IterationBadge iteration={2} total={10} />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-label", "Iteration 2 of 10");
  });

  // ── Increments ─────────────────────────────────────────────────

  it("live-updates when iteration increments via re-render", () => {
    const { rerender } = render(<IterationBadge iteration={1} total={5} />);
    expect(screen.getByTestId("iteration-text").textContent).toBe("1 / 5");

    rerender(<IterationBadge iteration={2} total={5} />);
    expect(screen.getByTestId("iteration-text").textContent).toBe("2 / 5");

    rerender(<IterationBadge iteration={3} total={5} />);
    expect(screen.getByTestId("iteration-text").textContent).toBe("3 / 5");
  });

  it("updates aria-label on iteration change", () => {
    const { rerender } = render(<IterationBadge iteration={1} total={3} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Iteration 1 of 3");

    rerender(<IterationBadge iteration={2} total={3} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Iteration 2 of 3");
  });

  // ── Structural checks ─────────────────────────────────────────

  it("has role=status", () => {
    render(<IterationBadge iteration={1} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders a Repeat icon with aria-hidden", () => {
    render(<IterationBadge iteration={1} />);
    const icon = screen.getByTestId("iteration-icon");
    expect(icon).toBeInTheDocument();
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the expected lucide repeat icon", () => {
    render(<IterationBadge iteration={1} />);
    const icon = screen.getByTestId("iteration-icon");
    expect(icon.classList.toString()).toContain("lucide-repeat");
  });

  it("renders as a span element", () => {
    render(<IterationBadge iteration={1} />);
    const badge = screen.getByTestId("iteration-badge");
    expect(badge.tagName.toLowerCase()).toBe("span");
  });

  it("has data-testid=iteration-badge", () => {
    render(<IterationBadge iteration={1} />);
    expect(screen.getByTestId("iteration-badge")).toBeInTheDocument();
  });

  // ── Edge cases ─────────────────────────────────────────────────

  it("handles iteration 0", () => {
    render(<IterationBadge iteration={0} total={5} />);
    expect(screen.getByTestId("iteration-text").textContent).toBe("0 / 5");
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Iteration 0 of 5");
  });

  it("handles large iteration numbers", () => {
    render(<IterationBadge iteration={999} total={1000} />);
    expect(screen.getByTestId("iteration-text").textContent).toBe("999 / 1000");
  });

  it("disappears when iteration becomes undefined", () => {
    const { rerender, container } = render(<IterationBadge iteration={3} total={5} />);
    expect(screen.getByTestId("iteration-badge")).toBeInTheDocument();

    rerender(<IterationBadge iteration={undefined} />);
    expect(container.innerHTML).toBe("");
  });
});
