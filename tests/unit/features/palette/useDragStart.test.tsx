import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { DragProvider, useDragContext } from "@/features/palette/DragContext";
import { useDragStart } from "@/features/palette/useDragStart";

afterEach(() => {
  cleanup();
});

/* ---------- helpers ---------- */

function DragStatus() {
  const { state } = useDragContext();
  return (
    <div data-testid="status">
      <span data-testid="isDragging">{String(state.isDragging)}</span>
      <span data-testid="payload">{state.payload ? state.payload.kind : "null"}</span>
    </div>
  );
}

function DragItem({ kind, disabled }: { readonly kind: string; readonly disabled?: boolean }) {
  const { onPointerDown } = useDragStart({ kind, disabled });
  return (
    <div data-testid="item" onPointerDown={onPointerDown}>
      drag me
    </div>
  );
}

function Harness({
  kind = "test-node",
  disabled,
  children,
}: {
  readonly kind?: string;
  readonly disabled?: boolean;
  readonly children?: ReactNode;
}) {
  return (
    <DragProvider>
      <DragItem kind={kind} disabled={disabled} />
      <DragStatus />
      {children}
    </DragProvider>
  );
}

function pointerDown(
  el: HTMLElement,
  opts: { clientX: number; clientY: number; pointerId?: number },
) {
  fireEvent.pointerDown(el, {
    pointerId: opts.pointerId ?? 1,
    clientX: opts.clientX,
    clientY: opts.clientY,
  });
}

function pointerMove(
  el: HTMLElement,
  opts: { clientX: number; clientY: number; pointerId?: number },
) {
  fireEvent.pointerMove(el, {
    pointerId: opts.pointerId ?? 1,
    clientX: opts.clientX,
    clientY: opts.clientY,
  });
}

function pointerUp(el: HTMLElement, opts?: { pointerId?: number }) {
  fireEvent.pointerUp(el, { pointerId: opts?.pointerId ?? 1 });
}

/* ---------- DragContext tests ---------- */

describe("DragContext", () => {
  it("provides idle state by default", () => {
    render(<Harness />);
    expect(screen.getByTestId("isDragging").textContent).toBe("false");
    expect(screen.getByTestId("payload").textContent).toBe("null");
  });

  it("throws when useDragContext is used outside DragProvider", () => {
    function Bad() {
      useDragContext();
      return null;
    }
    expect(() => render(<Bad />)).toThrow("useDragContext must be used within a DragProvider");
  });
});

/* ---------- useDragStart tests ---------- */

describe("useDragStart", () => {
  it("calls setPointerCapture on pointerdown", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    const captureSpy = vi.fn();
    item.setPointerCapture = captureSpy;

    pointerDown(item, { clientX: 100, clientY: 100, pointerId: 5 });

    expect(captureSpy).toHaveBeenCalledWith(5);
  });

  it("does not enter dragging state before threshold is crossed", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    item.releasePointerCapture = vi.fn();

    pointerDown(item, { clientX: 100, clientY: 100 });
    pointerMove(item, { clientX: 102, clientY: 100 }); // 2px < 3px threshold

    expect(screen.getByTestId("isDragging").textContent).toBe("false");
    expect(screen.getByTestId("payload").textContent).toBe("null");
  });

  it("enters dragging state when movement exceeds 3px threshold", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    item.releasePointerCapture = vi.fn();

    pointerDown(item, { clientX: 100, clientY: 100 });
    pointerMove(item, { clientX: 104, clientY: 100 }); // 4px > 3px

    expect(screen.getByTestId("isDragging").textContent).toBe("true");
    expect(screen.getByTestId("payload").textContent).toBe("test-node");
  });

  it("sets correct kind in drag payload", () => {
    render(<Harness kind="custom-kind" />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    item.releasePointerCapture = vi.fn();

    pointerDown(item, { clientX: 0, clientY: 0 });
    pointerMove(item, { clientX: 0, clientY: 5 }); // 5px vertical

    expect(screen.getByTestId("payload").textContent).toBe("custom-kind");
  });

  it("respects diagonal distance calculation for threshold", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    item.releasePointerCapture = vi.fn();

    pointerDown(item, { clientX: 0, clientY: 0 });
    // 2px x + 2px y = ~2.83px diagonal, below 3px threshold
    pointerMove(item, { clientX: 2, clientY: 2 });

    expect(screen.getByTestId("isDragging").textContent).toBe("false");

    // 3px x + 1px y = ~3.16px diagonal, above threshold
    pointerMove(item, { clientX: 3, clientY: 1 });

    expect(screen.getByTestId("isDragging").textContent).toBe("true");
  });

  it("ends drag on pointerup after threshold crossed", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    item.releasePointerCapture = vi.fn();

    pointerDown(item, { clientX: 100, clientY: 100 });
    pointerMove(item, { clientX: 110, clientY: 100 }); // enter dragging

    expect(screen.getByTestId("isDragging").textContent).toBe("true");

    pointerUp(item);

    expect(screen.getByTestId("isDragging").textContent).toBe("false");
    expect(screen.getByTestId("payload").textContent).toBe("null");
  });

  it("releases pointer capture on pointerup", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    const releaseSpy = vi.fn();
    item.releasePointerCapture = releaseSpy;

    pointerDown(item, { clientX: 100, clientY: 100, pointerId: 7 });
    pointerMove(item, { clientX: 110, clientY: 100 });
    pointerUp(item, { pointerId: 7 });

    expect(releaseSpy).toHaveBeenCalledWith(7);
  });

  it("cancels drag on Escape key", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    item.releasePointerCapture = vi.fn();

    pointerDown(item, { clientX: 100, clientY: 100 });
    pointerMove(item, { clientX: 110, clientY: 100 }); // enter dragging

    expect(screen.getByTestId("isDragging").textContent).toBe("true");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(screen.getByTestId("isDragging").textContent).toBe("false");
    expect(screen.getByTestId("payload").textContent).toBe("null");
  });

  it("releases pointer capture on Escape", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    const releaseSpy = vi.fn();
    item.releasePointerCapture = releaseSpy;

    pointerDown(item, { clientX: 100, clientY: 100, pointerId: 3 });
    pointerMove(item, { clientX: 110, clientY: 100 });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(releaseSpy).toHaveBeenCalledWith(3);
  });

  it("does nothing on pointerup if threshold was not crossed", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    item.releasePointerCapture = vi.fn();

    pointerDown(item, { clientX: 100, clientY: 100 });
    pointerMove(item, { clientX: 101, clientY: 100 }); // below threshold
    pointerUp(item);

    // never entered dragging, so stays idle
    expect(screen.getByTestId("isDragging").textContent).toBe("false");
  });

  it("does not start drag when disabled", () => {
    render(<Harness disabled />);
    const item = screen.getByTestId("item");
    const captureSpy = vi.fn();
    item.setPointerCapture = captureSpy;

    pointerDown(item, { clientX: 100, clientY: 100 });

    expect(captureSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("isDragging").textContent).toBe("false");
  });

  it("cleans up event listeners after pointerup", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    item.releasePointerCapture = vi.fn();
    const removeSpy = vi.spyOn(item, "removeEventListener");

    pointerDown(item, { clientX: 0, clientY: 0 });
    pointerMove(item, { clientX: 10, clientY: 0 });
    pointerUp(item);

    expect(removeSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));
  });

  it("cleans up event listeners after Escape", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    item.releasePointerCapture = vi.fn();
    const removeElSpy = vi.spyOn(item, "removeEventListener");
    const removeDocSpy = vi.spyOn(document, "removeEventListener");

    pointerDown(item, { clientX: 0, clientY: 0 });
    pointerMove(item, { clientX: 10, clientY: 0 });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(removeElSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeElSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));
    expect(removeDocSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("ignores non-Escape keys during drag", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    item.releasePointerCapture = vi.fn();

    pointerDown(item, { clientX: 0, clientY: 0 });
    pointerMove(item, { clientX: 10, clientY: 0 });

    expect(screen.getByTestId("isDragging").textContent).toBe("true");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });

    // drag should still be active
    expect(screen.getByTestId("isDragging").textContent).toBe("true");
  });

  it("handles full drag lifecycle: down → move below → move above → up", () => {
    render(<Harness />);
    const item = screen.getByTestId("item");
    item.setPointerCapture = vi.fn();
    item.releasePointerCapture = vi.fn();

    // Phase 1: pointer down
    pointerDown(item, { clientX: 50, clientY: 50 });
    expect(screen.getByTestId("isDragging").textContent).toBe("false");

    // Phase 2: move below threshold
    pointerMove(item, { clientX: 52, clientY: 50 });
    expect(screen.getByTestId("isDragging").textContent).toBe("false");

    // Phase 3: move above threshold
    pointerMove(item, { clientX: 55, clientY: 50 });
    expect(screen.getByTestId("isDragging").textContent).toBe("true");
    expect(screen.getByTestId("payload").textContent).toBe("test-node");

    // Phase 4: pointer up
    pointerUp(item);
    expect(screen.getByTestId("isDragging").textContent).toBe("false");
    expect(screen.getByTestId("payload").textContent).toBe("null");
  });
});
