import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { BaseNode } from "@/features/nodes/BaseNode";

afterEach(() => {
  cleanup();
});

describe("BaseNode", () => {
  it("renders with role=group and aria-label matching title", () => {
    render(<BaseNode title="Task" icon="square-check" />);
    const node = screen.getByRole("group", { name: "Task" });
    expect(node).toBeInTheDocument();
  });

  it("renders the title in the header", () => {
    render(<BaseNode title="My Node" icon="play" />);
    const header = screen.getByTestId("node-header");
    expect(header.textContent).toContain("My Node");
  });

  it("renders an icon in the header", () => {
    render(<BaseNode title="Start" icon="play" />);
    const icon = screen.getByTestId("node-icon");
    expect(icon).toBeInTheDocument();
    expect(icon.tagName.toLowerCase()).toBe("svg");
  });

  it("renders children in the body slot", () => {
    render(
      <BaseNode title="Task" icon="square-check">
        <span data-testid="child-content">Hello</span>
      </BaseNode>,
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByTestId("node-body")).toBeInTheDocument();
  });

  it("does not render body section when no children provided", () => {
    render(<BaseNode title="Task" icon="square-check" />);
    expect(screen.queryByTestId("node-body")).not.toBeInTheDocument();
  });

  it("has data-selected=false and aria-selected=false by default", () => {
    render(<BaseNode title="Task" icon="square-check" />);
    const node = screen.getByTestId("base-node");
    expect(node.getAttribute("data-selected")).toBe("false");
    expect(node.getAttribute("aria-selected")).toBe("false");
  });

  it("has data-selected=true and aria-selected=true when selected", () => {
    render(<BaseNode title="Task" icon="square-check" selected />);
    const node = screen.getByTestId("base-node");
    expect(node.getAttribute("data-selected")).toBe("true");
    expect(node.getAttribute("aria-selected")).toBe("true");
  });

  it("reflects selection change from prop update", () => {
    const { rerender } = render(<BaseNode title="Task" icon="square-check" selected={false} />);
    const node = screen.getByTestId("base-node");
    expect(node.getAttribute("data-selected")).toBe("false");

    rerender(<BaseNode title="Task" icon="square-check" selected />);
    expect(node.getAttribute("data-selected")).toBe("true");
  });

  it("has tabIndex=0 for keyboard focusability", () => {
    render(<BaseNode title="Task" icon="square-check" />);
    const node = screen.getByTestId("base-node");
    expect(node.tabIndex).toBe(0);
  });

  it("is keyboard focusable", () => {
    render(<BaseNode title="Task" icon="square-check" />);
    const node = screen.getByTestId("base-node");

    act(() => {
      node.focus();
    });

    expect(document.activeElement).toBe(node);
  });

  it("shows a focus ring on focus and removes it on blur", () => {
    render(<BaseNode title="Task" icon="square-check" />);
    const node = screen.getByTestId("base-node");

    act(() => {
      fireEvent.focus(node);
    });

    expect(node.style.boxShadow).toContain("rgba(59,130,246,0.4)");

    act(() => {
      fireEvent.blur(node);
    });

    expect(node.style.boxShadow).toBe("");
  });

  it("applies selection border when selected", () => {
    render(<BaseNode title="Task" icon="square-check" selected />);
    const node = screen.getByTestId("base-node");
    expect(node.style.border).toContain("rgb(59, 130, 246)");
  });

  it("has transparent border when not selected", () => {
    render(<BaseNode title="Task" icon="square-check" />);
    const node = screen.getByTestId("base-node");
    expect(node.style.border).toContain("transparent");
  });

  it("gracefully handles an unknown icon name", () => {
    render(<BaseNode title="Task" icon="nonexistent-icon-xyz" />);
    // Should not crash; icon simply not rendered
    expect(screen.queryByTestId("node-icon")).not.toBeInTheDocument();
    // But header text still visible
    expect(screen.getByTestId("node-header").textContent).toContain("Task");
  });
});
