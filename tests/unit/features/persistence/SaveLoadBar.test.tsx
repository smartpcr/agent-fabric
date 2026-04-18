import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SaveLoadBar, type SaveLoadBarProps } from "@/features/persistence/SaveLoadBar";

afterEach(cleanup);

// ─── Helpers ─────────────────────────────────────────────────────────

function defaultProps(overrides: Partial<SaveLoadBarProps> = {}): SaveLoadBarProps {
  return {
    name: "My Workflow",
    onNameChange: vi.fn(),
    onSave: vi.fn(),
    onLoad: vi.fn(),
    onNew: vi.fn(),
    dirty: false,
    lastSavedAt: null,
    ...overrides,
  };
}

// ─── Rendering ───────────────────────────────────────────────────────

describe("SaveLoadBar — rendering", () => {
  it("renders the component container", () => {
    render(<SaveLoadBar {...defaultProps()} />);
    expect(screen.getByTestId("save-load-bar")).toBeInTheDocument();
  });

  it("renders a name input with the current workflow name", () => {
    render(<SaveLoadBar {...defaultProps({ name: "Test Flow" })} />);
    const input = screen.getByTestId("workflow-name-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Test Flow");
  });

  it("renders Save, Load, and New buttons", () => {
    render(<SaveLoadBar {...defaultProps()} />);
    expect(screen.getByTestId("save-button")).toBeInTheDocument();
    expect(screen.getByTestId("load-button")).toBeInTheDocument();
    expect(screen.getByTestId("new-button")).toBeInTheDocument();
  });

  it("renders button text correctly", () => {
    render(<SaveLoadBar {...defaultProps()} />);
    expect(screen.getByTestId("save-button")).toHaveTextContent("Save");
    expect(screen.getByTestId("load-button")).toHaveTextContent("Load");
    expect(screen.getByTestId("new-button")).toHaveTextContent("New");
  });
});

// ─── Name field ──────────────────────────────────────────────────────

describe("SaveLoadBar — name field", () => {
  it("calls onNameChange when the name input changes", () => {
    const onNameChange = vi.fn();
    render(<SaveLoadBar {...defaultProps({ onNameChange })} />);

    fireEvent.change(screen.getByTestId("workflow-name-input"), {
      target: { value: "Renamed" },
    });

    expect(onNameChange).toHaveBeenCalledWith("Renamed");
  });

  it("has an accessible label for the name input", () => {
    render(<SaveLoadBar {...defaultProps()} />);
    expect(screen.getByLabelText("Workflow name")).toBeInTheDocument();
  });
});

// ─── Button interactions ─────────────────────────────────────────────

describe("SaveLoadBar — button clicks", () => {
  it("calls onSave when Save is clicked", () => {
    const onSave = vi.fn();
    render(<SaveLoadBar {...defaultProps({ onSave })} />);

    fireEvent.click(screen.getByTestId("save-button"));

    expect(onSave).toHaveBeenCalledOnce();
  });

  it("calls onLoad when Load is clicked", () => {
    const onLoad = vi.fn();
    render(<SaveLoadBar {...defaultProps({ onLoad })} />);

    fireEvent.click(screen.getByTestId("load-button"));

    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("calls onNew when New is clicked", () => {
    const onNew = vi.fn();
    render(<SaveLoadBar {...defaultProps({ onNew })} />);

    fireEvent.click(screen.getByTestId("new-button"));

    expect(onNew).toHaveBeenCalledOnce();
  });
});

// ─── Dirty indicator ─────────────────────────────────────────────────

describe("SaveLoadBar — dirty indicator", () => {
  it("does not show dirty indicator when not dirty", () => {
    render(<SaveLoadBar {...defaultProps({ dirty: false })} />);
    expect(screen.queryByTestId("dirty-indicator")).not.toBeInTheDocument();
  });

  it("shows dirty indicator when dirty", () => {
    render(<SaveLoadBar {...defaultProps({ dirty: true })} />);
    const dot = screen.getByTestId("dirty-indicator");
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute("role", "status");
    expect(dot).toHaveAttribute("aria-label", "Unsaved changes");
  });
});

// ─── Last-saved timestamp ────────────────────────────────────────────

describe("SaveLoadBar — last-saved timestamp", () => {
  it("does not show timestamp when lastSavedAt is null", () => {
    render(<SaveLoadBar {...defaultProps({ lastSavedAt: null })} />);
    expect(screen.queryByTestId("last-saved-timestamp")).not.toBeInTheDocument();
  });

  it("shows timestamp when lastSavedAt is provided", () => {
    const iso = "2026-01-15T10:30:00Z";
    render(<SaveLoadBar {...defaultProps({ lastSavedAt: iso })} />);
    const el = screen.getByTestId("last-saved-timestamp");
    expect(el).toBeInTheDocument();
    expect(el.textContent).toContain("Saved");
  });

  it("formats the timestamp using locale time", () => {
    const iso = "2026-06-15T14:30:00Z";
    render(<SaveLoadBar {...defaultProps({ lastSavedAt: iso })} />);
    const el = screen.getByTestId("last-saved-timestamp");
    // The locale-formatted time should appear after "Saved "
    expect(el.textContent).toMatch(/Saved .+/);
  });

  it("falls back to raw string for invalid timestamp", () => {
    render(<SaveLoadBar {...defaultProps({ lastSavedAt: "not-a-date" })} />);
    const el = screen.getByTestId("last-saved-timestamp");
    expect(el.textContent).toContain("not-a-date");
  });
});

// ─── Saving state ────────────────────────────────────────────────────

describe("SaveLoadBar — saving state", () => {
  it("disables Save button when saving is true", () => {
    render(<SaveLoadBar {...defaultProps({ saving: true })} />);
    const btn = screen.getByTestId("save-button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("Saving…");
  });

  it("enables Save button when saving is false", () => {
    render(<SaveLoadBar {...defaultProps({ saving: false })} />);
    const btn = screen.getByTestId("save-button");
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent("Save");
  });

  it("defaults saving to false when not provided", () => {
    const props = defaultProps();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { saving: _, ...withoutSaving } = { ...props, saving: undefined };
    render(<SaveLoadBar {...withoutSaving} />);
    const btn = screen.getByTestId("save-button");
    expect(btn).not.toBeDisabled();
  });
});

// ─── Accessibility ───────────────────────────────────────────────────

describe("SaveLoadBar — accessibility", () => {
  it("Save button has aria-label", () => {
    render(<SaveLoadBar {...defaultProps()} />);
    expect(screen.getByTestId("save-button")).toHaveAttribute("aria-label", "Save");
  });

  it("Load button has aria-label", () => {
    render(<SaveLoadBar {...defaultProps()} />);
    expect(screen.getByTestId("load-button")).toHaveAttribute("aria-label", "Load");
  });

  it("New button has aria-label", () => {
    render(<SaveLoadBar {...defaultProps()} />);
    expect(screen.getByTestId("new-button")).toHaveAttribute("aria-label", "New");
  });
});
