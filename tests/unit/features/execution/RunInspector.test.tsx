import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunInspector } from "@/features/execution/RunInspector";

afterEach(() => {
  cleanup();
});

describe("RunInspector", () => {
  // ── Open / Close ────────────────────────────────────────────────

  it("renders nothing when closed", () => {
    render(<RunInspector open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("run-inspector")).not.toBeInTheDocument();
  });

  it("renders the inspector panel when open", () => {
    render(<RunInspector open={true} onClose={vi.fn()} />);
    expect(screen.getByTestId("run-inspector")).toBeInTheDocument();
  });

  it("renders the title 'Run Inspector'", () => {
    render(<RunInspector open={true} onClose={vi.fn()} />);
    expect(screen.getByTestId("run-inspector-title")).toHaveTextContent("Run Inspector");
  });

  it("renders the overlay when open", () => {
    render(<RunInspector open={true} onClose={vi.fn()} />);
    expect(screen.getByTestId("run-inspector-overlay")).toBeInTheDocument();
  });

  it("renders children inside the panel body", () => {
    render(
      <RunInspector open={true} onClose={vi.fn()}>
        <p data-testid="inspector-content">Hello World</p>
      </RunInspector>,
    );
    const body = screen.getByTestId("run-inspector-body");
    expect(body).toBeInTheDocument();
    expect(screen.getByTestId("inspector-content")).toHaveTextContent("Hello World");
  });

  // ── Close button ────────────────────────────────────────────────

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<RunInspector open={true} onClose={onClose} />);

    const closeBtn = screen.getByTestId("run-inspector-close");
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("close button has accessible label", () => {
    render(<RunInspector open={true} onClose={vi.fn()} />);
    const closeBtn = screen.getByTestId("run-inspector-close");
    expect(closeBtn).toHaveAttribute("aria-label", "Close inspector");
  });

  // ── Escape dismisses ────────────────────────────────────────────

  it("calls onClose when Escape key is pressed", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<RunInspector open={true} onClose={onClose} />);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Focus trap ──────────────────────────────────────────────────

  it("panel has role='dialog'", () => {
    render(<RunInspector open={true} onClose={vi.fn()} />);
    const panel = screen.getByTestId("run-inspector");
    expect(panel).toHaveAttribute("role", "dialog");
  });

  it("panel has aria-label='Run Inspector'", () => {
    render(<RunInspector open={true} onClose={vi.fn()} />);
    const panel = screen.getByTestId("run-inspector");
    expect(panel).toHaveAttribute("aria-label", "Run Inspector");
  });

  it("focus moves to close button when panel opens", () => {
    render(<RunInspector open={true} onClose={vi.fn()} />);
    const closeBtn = screen.getByTestId("run-inspector-close");
    expect(document.activeElement).toBe(closeBtn);
  });

  it("focus stays within the panel (focus trap)", async () => {
    const user = userEvent.setup();

    render(
      <RunInspector open={true} onClose={vi.fn()}>
        <button data-testid="inner-btn-1">Button 1</button>
        <button data-testid="inner-btn-2">Button 2</button>
      </RunInspector>,
    );

    // Focus should start on close button
    const closeBtn = screen.getByTestId("run-inspector-close");
    expect(document.activeElement).toBe(closeBtn);

    // Tab through focusable elements inside the panel
    await user.tab();
    const btn1 = screen.getByTestId("inner-btn-1");
    expect(document.activeElement).toBe(btn1);

    await user.tab();
    const btn2 = screen.getByTestId("inner-btn-2");
    expect(document.activeElement).toBe(btn2);

    // Tab again — should wrap back to close button (focus trap)
    await user.tab();
    expect(document.activeElement).toBe(closeBtn);
  });

  // ── Overlay click closes ────────────────────────────────────────

  it("calls onClose when overlay is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<RunInspector open={true} onClose={onClose} />);

    const overlay = screen.getByTestId("run-inspector-overlay");
    await user.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Transition: open -> closed ─────────────────────────────────

  it("removes panel from DOM when transitioning from open to closed", () => {
    const { rerender } = render(<RunInspector open={true} onClose={vi.fn()} />);
    expect(screen.getByTestId("run-inspector")).toBeInTheDocument();

    rerender(<RunInspector open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("run-inspector")).not.toBeInTheDocument();
  });

  // ── Right-side positioning ──────────────────────────────────────

  it("panel is positioned on the right side of the viewport", () => {
    render(<RunInspector open={true} onClose={vi.fn()} />);
    const panel = screen.getByTestId("run-inspector");
    expect(panel.style.right).toBe("0px");
    expect(panel.style.top).toBe("0px");
    expect(panel.style.bottom).toBe("0px");
    expect(panel.style.position).toBe("fixed");
  });
});
