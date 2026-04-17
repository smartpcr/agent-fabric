import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { PaletteItem } from "@/features/palette/PaletteItem";
import { DragProvider } from "@/features/palette/DragContext";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { makeOutputPort } from "@/domain/models/port";

afterEach(() => {
  cleanup();
});

function renderWithDrag(ui: React.ReactElement) {
  return render(<DragProvider>{ui}</DragProvider>);
}

const testSpec: NodeSpec = {
  kind: "start",
  category: "flow",
  label: "Start",
  icon: "play",
  ports: [makeOutputPort({ id: "out", label: "Out", dataType: "any" })],
  propertySchema: z.object({}),
  defaultData: {},
  capabilities: ["isEntry"],
};

describe("PaletteItem", () => {
  it("renders with role option", () => {
    renderWithDrag(<PaletteItem spec={testSpec} />);
    expect(screen.getByRole("option")).toBeInTheDocument();
  });

  it("has accessible name equal to spec label", () => {
    renderWithDrag(<PaletteItem spec={testSpec} />);
    expect(screen.getByRole("option", { name: "Start" })).toBeInTheDocument();
  });

  it("renders the spec label text", () => {
    renderWithDrag(<PaletteItem spec={testSpec} />);
    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("has data-kind attribute matching spec.kind", () => {
    renderWithDrag(<PaletteItem spec={testSpec} />);
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("data-kind", "start");
  });

  it("is focusable when not disabled", () => {
    renderWithDrag(<PaletteItem spec={testSpec} />);
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("tabIndex", "0");
  });

  it("renders a lucide icon", () => {
    const { container } = renderWithDrag(<PaletteItem spec={testSpec} />);
    const svgs = container.querySelectorAll("svg");
    // Should have drag handle + spec icon = 2 SVGs
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it("shows tooltip on hover", async () => {
    const user = userEvent.setup();
    renderWithDrag(<PaletteItem spec={testSpec} />);
    const option = screen.getByRole("option");

    await user.hover(option);

    // Radix tooltip content appears after delay
    await vi.waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });
  });

  it("shows tooltip on focus", async () => {
    renderWithDrag(<PaletteItem spec={testSpec} />);
    const option = screen.getByRole("option");

    act(() => {
      option.focus();
    });

    await vi.waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });
  });

  it("tooltip contains description", async () => {
    const user = userEvent.setup();
    renderWithDrag(<PaletteItem spec={testSpec} />);
    const option = screen.getByRole("option");

    await user.hover(option);

    await vi.waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("flow — start");
    });
  });

  it("renders disabled state with aria-disabled", () => {
    renderWithDrag(<PaletteItem spec={testSpec} disabled />);
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("aria-disabled", "true");
  });

  it("disabled item has tabIndex -1", () => {
    renderWithDrag(<PaletteItem spec={testSpec} disabled />);
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("tabIndex", "-1");
  });

  it("disabled item has reduced opacity", () => {
    renderWithDrag(<PaletteItem spec={testSpec} disabled />);
    const option = screen.getByRole("option");
    expect(option.style.opacity).toBe("0.5");
  });

  it("non-disabled item has full opacity", () => {
    renderWithDrag(<PaletteItem spec={testSpec} />);
    const option = screen.getByRole("option");
    expect(option.style.opacity).toBe("1");
  });

  it("renders with cursor grab when enabled", () => {
    renderWithDrag(<PaletteItem spec={testSpec} />);
    const option = screen.getByRole("option");
    expect(option.style.cursor).toBe("grab");
  });

  it("renders with cursor not-allowed when disabled", () => {
    renderWithDrag(<PaletteItem spec={testSpec} disabled />);
    const option = screen.getByRole("option");
    expect(option.style.cursor).toBe("not-allowed");
  });

  it("renders a drag handle affordance", () => {
    renderWithDrag(<PaletteItem spec={testSpec} />);
    const handle = screen.getByTestId("drag-handle");
    expect(handle).toBeInTheDocument();
    expect(handle.tagName.toLowerCase()).toBe("svg");
  });

  it("handles unknown icon gracefully (no SVG rendered for icon)", () => {
    const specWithBadIcon: NodeSpec = {
      ...testSpec,
      icon: "nonexistent-icon-xyz",
    };
    const { container } = renderWithDrag(<PaletteItem spec={specWithBadIcon} />);
    // Only the drag-handle SVG should be present, not a spec icon SVG
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1); // just the grip handle
    expect(svgs[0]).toHaveAttribute("data-testid", "drag-handle");
    // Label still renders
    expect(screen.getByText("Start")).toBeInTheDocument();
  });
});
