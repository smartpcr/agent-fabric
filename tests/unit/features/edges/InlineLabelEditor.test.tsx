import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { InlineLabelEditor } from "@/features/edges/InlineLabelEditor";

afterEach(() => {
  cleanup();
});

describe("InlineLabelEditor", () => {
  it("renders an input with the provided value", () => {
    render(<InlineLabelEditor value="hello" onCommit={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByTestId("inline-label-input");
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("hello");
  });

  it("auto-focuses the input on mount", () => {
    render(<InlineLabelEditor value="test" onCommit={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByTestId("inline-label-input");
    expect(document.activeElement).toBe(input);
  });

  it("Enter key commits with the current text", () => {
    const onCommit = vi.fn();
    render(<InlineLabelEditor value="original" onCommit={onCommit} onCancel={vi.fn()} />);

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.change(input, { target: { value: "updated" } });
    });

    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(onCommit).toHaveBeenCalledWith("updated");
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("Enter key commits unchanged text if no edits were made", () => {
    const onCommit = vi.fn();
    render(<InlineLabelEditor value="same" onCommit={onCommit} onCancel={vi.fn()} />);

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(onCommit).toHaveBeenCalledWith("same");
  });

  it("Escape key cancels editing without committing", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<InlineLabelEditor value="original" onCommit={onCommit} onCancel={onCancel} />);

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.change(input, { target: { value: "changed" } });
    });

    act(() => {
      fireEvent.keyDown(input, { key: "Escape" });
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("Blur commits with the current text", () => {
    const onCommit = vi.fn();
    render(<InlineLabelEditor value="original" onCommit={onCommit} onCancel={vi.fn()} />);

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.change(input, { target: { value: "blur-value" } });
    });

    act(() => {
      fireEvent.blur(input);
    });

    expect(onCommit).toHaveBeenCalledWith("blur-value");
  });

  it("updates internal text state when typing", () => {
    render(<InlineLabelEditor value="start" onCommit={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.change(input, { target: { value: "modified" } });
    });

    expect(input.value).toBe("modified");
  });

  it("stops keyboard event propagation to prevent canvas shortcuts", () => {
    render(<InlineLabelEditor value="test" onCommit={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByTestId("inline-label-input");
    const stopPropagation = vi.fn();

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "a",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "stopPropagation", { value: stopPropagation });
      input.dispatchEvent(event);
    });

    expect(stopPropagation).toHaveBeenCalled();
  });

  it("prevents default on Enter key", () => {
    render(<InlineLabelEditor value="test" onCommit={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByTestId("inline-label-input");
    const preventDefault = vi.fn();

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "preventDefault", { value: preventDefault });
      Object.defineProperty(event, "stopPropagation", { value: vi.fn() });
      input.dispatchEvent(event);
    });

    expect(preventDefault).toHaveBeenCalled();
  });

  it("prevents default on Escape key", () => {
    render(<InlineLabelEditor value="test" onCommit={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByTestId("inline-label-input");
    const preventDefault = vi.fn();

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "preventDefault", { value: preventDefault });
      Object.defineProperty(event, "stopPropagation", { value: vi.fn() });
      input.dispatchEvent(event);
    });

    expect(preventDefault).toHaveBeenCalled();
  });

  it("commits empty string when input is cleared", () => {
    const onCommit = vi.fn();
    render(<InlineLabelEditor value="test" onCommit={onCommit} onCancel={vi.fn()} />);

    const input = screen.getByTestId("inline-label-input");

    act(() => {
      fireEvent.change(input, { target: { value: "" } });
    });

    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(onCommit).toHaveBeenCalledWith("");
  });

  it("renders as a text input", () => {
    render(<InlineLabelEditor value="test" onCommit={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByTestId("inline-label-input");
    expect(input.tagName.toLowerCase()).toBe("input");
    expect(input.type).toBe("text");
  });
});
