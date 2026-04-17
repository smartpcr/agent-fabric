import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, renderHook, fireEvent } from "@testing-library/react";
import { DragGhost } from "@/features/palette/DragGhost";
import { DragProvider, useDragContext } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

afterEach(() => {
  cleanup();
});

function setupStore() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
  });
  unmount();
}

/** Helper to control drag state from within the DragProvider */
function DragController() {
  const { startDrag, endDrag } = useDragContext();
  return (
    <>
      <button
        data-testid="start-drag"
        onClick={() => {
          startDrag({ kind: "task" });
        }}
      >
        Start
      </button>
      <button
        data-testid="start-drag-unknown"
        onClick={() => {
          startDrag({ kind: "unknown-kind" });
        }}
      >
        Start Unknown
      </button>
      <button data-testid="end-drag" onClick={endDrag}>
        End
      </button>
    </>
  );
}

function renderGhost() {
  return render(
    <DragProvider>
      <DragController />
      <DragGhost />
    </DragProvider>,
  );
}

describe("DragGhost", () => {
  beforeEach(() => {
    setupStore();
  });

  it("is hidden when not dragging", () => {
    renderGhost();
    expect(screen.queryByTestId("drag-ghost")).not.toBeInTheDocument();
  });

  it("mounts (portals to body) when dragging starts", () => {
    renderGhost();

    act(() => {
      fireEvent.click(screen.getByTestId("start-drag"));
    });

    const ghost = screen.getByTestId("drag-ghost");
    expect(ghost).toBeInTheDocument();
    // Portaled to body
    expect(ghost.parentElement).toBe(document.body);
  });

  it("unmounts when drag ends", () => {
    renderGhost();

    act(() => {
      fireEvent.click(screen.getByTestId("start-drag"));
    });
    expect(screen.getByTestId("drag-ghost")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId("end-drag"));
    });
    expect(screen.queryByTestId("drag-ghost")).not.toBeInTheDocument();
  });

  it("displays the spec label for a known kind", () => {
    renderGhost();

    act(() => {
      fireEvent.click(screen.getByTestId("start-drag"));
    });

    const ghost = screen.getByTestId("drag-ghost");
    expect(ghost.textContent).toContain("Task");
  });

  it("falls back to payload kind when spec not in registry", () => {
    renderGhost();

    act(() => {
      fireEvent.click(screen.getByTestId("start-drag-unknown"));
    });

    const ghost = screen.getByTestId("drag-ghost");
    expect(ghost.textContent).toContain("unknown-kind");
  });

  it("shows an icon from the spec", () => {
    renderGhost();

    act(() => {
      fireEvent.click(screen.getByTestId("start-drag"));
    });

    const ghost = screen.getByTestId("drag-ghost");
    // The icon renders as an SVG
    const svg = ghost.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("position follows pointermove events", () => {
    renderGhost();

    act(() => {
      fireEvent.click(screen.getByTestId("start-drag"));
    });

    const ghost = screen.getByTestId("drag-ghost");

    // Move pointer to (200, 300)
    act(() => {
      fireEvent(
        window,
        new PointerEvent("pointermove", {
          clientX: 200,
          clientY: 300,
          bubbles: true,
        }),
      );
    });

    // Ghost should be at pointer + offset (12px)
    expect(ghost.style.left).toBe("212px");
    expect(ghost.style.top).toBe("312px");
  });

  it("updates position on subsequent pointermove events", () => {
    renderGhost();

    act(() => {
      fireEvent.click(screen.getByTestId("start-drag"));
    });

    const ghost = screen.getByTestId("drag-ghost");

    // First move
    act(() => {
      fireEvent(
        window,
        new PointerEvent("pointermove", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        }),
      );
    });

    expect(ghost.style.left).toBe("112px");
    expect(ghost.style.top).toBe("112px");

    // Second move
    act(() => {
      fireEvent(
        window,
        new PointerEvent("pointermove", {
          clientX: 500,
          clientY: 700,
          bubbles: true,
        }),
      );
    });

    expect(ghost.style.left).toBe("512px");
    expect(ghost.style.top).toBe("712px");
  });

  it("stops following pointermove after drag ends", () => {
    renderGhost();

    act(() => {
      fireEvent.click(screen.getByTestId("start-drag"));
    });

    // Move pointer
    act(() => {
      fireEvent(
        window,
        new PointerEvent("pointermove", {
          clientX: 200,
          clientY: 300,
          bubbles: true,
        }),
      );
    });

    // End drag
    act(() => {
      fireEvent.click(screen.getByTestId("end-drag"));
    });

    // Ghost should be gone
    expect(screen.queryByTestId("drag-ghost")).not.toBeInTheDocument();
  });

  it("has pointer-events: none so it does not interfere with drop targets", () => {
    renderGhost();

    act(() => {
      fireEvent.click(screen.getByTestId("start-drag"));
    });

    const ghost = screen.getByTestId("drag-ghost");
    expect(ghost.style.pointerEvents).toBe("none");
  });
});
