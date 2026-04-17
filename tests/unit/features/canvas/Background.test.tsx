import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, renderHook, act, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { Background } from "@/features/canvas/Background";
import { Toolbar } from "@/features/editor/Toolbar";
import { useWorkflowStore } from "@/store/hooks";

// Capture Background props
let capturedBgProps: Record<string, unknown> = {};

vi.mock("@xyflow/react", () => ({
  Background: (props: Record<string, unknown>) => {
    capturedBgProps = props;
    return (
      <div
        data-testid="mock-background"
        data-variant={props.variant as string}
        data-gap={props.gap as number}
      />
    );
  },
  BackgroundVariant: { Dots: "dots", Lines: "lines", Cross: "cross" },
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    setViewport: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  capturedBgProps = {};
});

function setupStore(snapEnabled = false) {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    if (result.current.snapEnabled !== snapEnabled) {
      result.current.toggleSnap();
    }
  });
  unmount();
}

function getSnapEnabled(): boolean {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const val = result.current.snapEnabled;
  unmount();
  return val;
}

describe("Background grid pattern", () => {
  it("renders dots variant when snap is disabled", () => {
    setupStore(false);
    render(<Background />);

    expect(capturedBgProps.variant).toBe("dots");
  });

  it("renders lines variant when snap is enabled", () => {
    setupStore(true);
    render(<Background />);

    expect(capturedBgProps.variant).toBe("lines");
  });

  it("uses snapGridSize as gap", () => {
    setupStore(false);
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      result.current.setSnapGridSize(24);
    });
    unmount();

    render(<Background />);
    expect(capturedBgProps.gap).toBe(24);
  });

  it("switches from dots to lines when snap toggles on", () => {
    setupStore(false);

    const { rerender } = render(<Background />);
    expect(capturedBgProps.variant).toBe("dots");

    // Toggle snap on
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      result.current.toggleSnap();
    });
    unmount();

    rerender(<Background />);
    expect(capturedBgProps.variant).toBe("lines");
  });

  it("switches from lines to dots when snap toggles off", () => {
    setupStore(true);

    const { rerender } = render(<Background />);
    expect(capturedBgProps.variant).toBe("lines");

    // Toggle snap off
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      result.current.toggleSnap();
    });
    unmount();

    rerender(<Background />);
    expect(capturedBgProps.variant).toBe("dots");
  });
});

describe("Toolbar snap toggle", () => {
  it("renders the toolbar with snap toggle button", () => {
    setupStore(false);
    render(<Toolbar />);

    expect(screen.getByTestId("snap-grid-toggle")).toBeDefined();
    expect(screen.getByRole("toolbar")).toBeDefined();
  });

  it("clicking toggle flips snapEnabled state", () => {
    setupStore(false);
    expect(getSnapEnabled()).toBe(false);

    render(<Toolbar />);
    fireEvent.click(screen.getByTestId("snap-grid-toggle"));

    expect(getSnapEnabled()).toBe(true);
  });

  it("clicking toggle twice returns to original state", () => {
    setupStore(false);

    render(<Toolbar />);
    const btn = screen.getByTestId("snap-grid-toggle");

    fireEvent.click(btn);
    expect(getSnapEnabled()).toBe(true);

    fireEvent.click(btn);
    expect(getSnapEnabled()).toBe(false);
  });

  it("button shows correct aria-label when disabled", () => {
    setupStore(false);
    render(<Toolbar />);

    const btn = screen.getByTestId("snap-grid-toggle");
    expect(btn.getAttribute("aria-label")).toBe("Enable snap to grid");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("button shows correct aria-label when enabled", () => {
    setupStore(true);
    render(<Toolbar />);

    const btn = screen.getByTestId("snap-grid-toggle");
    expect(btn.getAttribute("aria-label")).toBe("Disable snap to grid");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("toolbar has role=toolbar with aria-label", () => {
    setupStore(false);
    render(<Toolbar />);

    const toolbar = screen.getByRole("toolbar");
    expect(toolbar.getAttribute("aria-label")).toBe("Editor toolbar");
  });
});
