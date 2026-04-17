import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "@/providers/ErrorBoundary";

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>Child content</div>;
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders fallback UI when child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recover/i })).toBeInTheDocument();

    spy.mockRestore();
  });

  it("clicking recover re-mounts children", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Use a ref-like pattern to control throwing behavior
    let shouldThrow = true;
    function ConditionalChild() {
      if (shouldThrow) {
        throw new Error("Test error");
      }
      return <div>Recovered content</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalChild />
      </ErrorBoundary>,
    );

    // Fallback should be shown
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Stop throwing before clicking recover
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: /recover/i }));

    // Children should be re-mounted
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    spy.mockRestore();
  });
});
