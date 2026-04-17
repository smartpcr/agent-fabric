import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ToastProvider } from "@/features/editor/Toast";
import { useToast } from "@/hooks/useToast";

function TestConsumer() {
  const { show } = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        show({ title: "Test toast", description: "Hello world", variant: "success" });
      }}
    >
      Show toast
    </button>
  );
}

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("shows a toast that is visible", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Show toast"));

    expect(screen.getByText("Test toast")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("auto-dismisses toast after 4 seconds", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Show toast"));
    expect(screen.getByText("Test toast")).toBeInTheDocument();

    // Advance time by 4 seconds
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText("Test toast")).not.toBeInTheDocument();
  });

  it("manually dismisses toast via dismiss button", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Show toast"));
    expect(screen.getByText("Test toast")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByText("Test toast")).not.toBeInTheDocument();
  });

  it("throws when used outside of ToastProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    function Bare() {
      useToast();
      return null;
    }

    expect(() => render(<Bare />)).toThrow("useToast used outside of ToastProvider");

    spy.mockRestore();
  });

  it("shows a toast without description", () => {
    function TitleOnlyConsumer() {
      const { show } = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            show({ title: "No-desc toast" });
          }}
        >
          Trigger no-desc
        </button>
      );
    }

    render(
      <ToastProvider>
        <TitleOnlyConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger no-desc"));

    expect(screen.getByText("No-desc toast")).toBeInTheDocument();
  });
});
