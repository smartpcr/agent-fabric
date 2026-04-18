import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRafBatcher, type RafBatcher } from "@/utils/rafBatcher";

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Sinon fake timers (used by vitest) model requestAnimationFrame at ~60 fps.
 * Advancing by 16ms fires one animation frame callback.
 */
function flushRaf(): void {
  vi.advanceTimersByTime(16);
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("createRafBatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Core coalescing behavior ──────────────────────────────────

  it("calls apply once per animation frame with all queued items", () => {
    const apply = vi.fn<(batch: number[]) => void>();
    const batcher = createRafBatcher(apply);

    batcher.enqueue(1);
    batcher.enqueue(2);
    batcher.enqueue(3);

    expect(apply).not.toHaveBeenCalled();
    flushRaf();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("100 queued items in one frame → 1 apply call", () => {
    const apply = vi.fn<(batch: number[]) => void>();
    const batcher = createRafBatcher(apply);

    for (let i = 0; i < 100; i++) {
      batcher.enqueue(i);
    }

    expect(apply).not.toHaveBeenCalled();
    flushRaf();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0][0]).toHaveLength(100);
    expect(apply.mock.calls[0][0][0]).toBe(0);
    expect(apply.mock.calls[0][0][99]).toBe(99);
  });

  it("batches across separate animation frames independently", () => {
    const apply = vi.fn<(batch: string[]) => void>();
    const batcher = createRafBatcher(apply);

    batcher.enqueue("a");
    batcher.enqueue("b");
    flushRaf();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(["a", "b"]);

    batcher.enqueue("c");
    flushRaf();

    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenLastCalledWith(["c"]);
  });

  it("does not call apply when no items are queued", () => {
    const apply = vi.fn<(batch: number[]) => void>();
    createRafBatcher(apply);

    flushRaf();
    expect(apply).not.toHaveBeenCalled();
  });

  // ── flush() ───────────────────────────────────────────────────

  it("flush() immediately delivers pending items", () => {
    const apply = vi.fn<(batch: number[]) => void>();
    const batcher = createRafBatcher(apply);

    batcher.enqueue(10);
    batcher.enqueue(20);
    batcher.flush();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith([10, 20]);
  });

  it("flush() cancels pending RAF so apply is not called twice", () => {
    const apply = vi.fn<(batch: number[]) => void>();
    const batcher = createRafBatcher(apply);

    batcher.enqueue(1);
    batcher.flush();
    flushRaf();

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("flush() is a no-op when queue is empty", () => {
    const apply = vi.fn<(batch: number[]) => void>();
    const batcher = createRafBatcher(apply);

    batcher.flush();
    expect(apply).not.toHaveBeenCalled();
  });

  it("flush() followed by new enqueue creates a fresh batch", () => {
    const apply = vi.fn<(batch: number[]) => void>();
    const batcher = createRafBatcher(apply);

    batcher.enqueue(1);
    batcher.flush();

    batcher.enqueue(2);
    flushRaf();

    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenNthCalledWith(1, [1]);
    expect(apply).toHaveBeenNthCalledWith(2, [2]);
  });

  // ── dispose() / cancel on teardown ────────────────────────────

  it("dispose() cancels pending RAF and discards queued items", () => {
    const apply = vi.fn<(batch: number[]) => void>();
    const batcher = createRafBatcher(apply);

    batcher.enqueue(1);
    batcher.enqueue(2);
    batcher.dispose();
    flushRaf();

    expect(apply).not.toHaveBeenCalled();
  });

  it("dispose() is safe to call multiple times", () => {
    const apply = vi.fn<(batch: number[]) => void>();
    const batcher = createRafBatcher(apply);

    batcher.enqueue(1);
    batcher.dispose();
    batcher.dispose(); // second call should not throw

    flushRaf();
    expect(apply).not.toHaveBeenCalled();
  });

  it("enqueue after dispose schedules a new batch normally", () => {
    const apply = vi.fn<(batch: number[]) => void>();
    const batcher = createRafBatcher(apply);

    batcher.enqueue(1);
    batcher.dispose();

    batcher.enqueue(2);
    flushRaf();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith([2]);
  });

  // ── requestAnimationFrame integration ─────────────────────────

  it("only schedules one rAF even when enqueue is called many times", () => {
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame");
    const apply = vi.fn<(batch: number[]) => void>();
    const batcher = createRafBatcher(apply);

    batcher.enqueue(1);
    batcher.enqueue(2);
    batcher.enqueue(3);

    // Only one rAF scheduled, not three
    expect(rafSpy).toHaveBeenCalledTimes(1);

    flushRaf();
    rafSpy.mockRestore();
  });

  it("cancelAnimationFrame is called on dispose", () => {
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame");
    const apply = vi.fn<(batch: number[]) => void>();
    const batcher = createRafBatcher(apply);

    batcher.enqueue(1);
    batcher.dispose();

    expect(cafSpy).toHaveBeenCalledTimes(1);
    cafSpy.mockRestore();
  });

  it("cancelAnimationFrame is called on flush when items are pending", () => {
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame");
    const apply = vi.fn<(batch: number[]) => void>();
    const batcher = createRafBatcher(apply);

    batcher.enqueue(1);
    batcher.flush();

    expect(cafSpy).toHaveBeenCalledTimes(1);
    cafSpy.mockRestore();
  });

  // ── Type safety ───────────────────────────────────────────────

  it("works with complex object types", () => {
    interface Event {
      id: string;
      payload: Record<string, unknown>;
    }
    const apply = vi.fn<(batch: Event[]) => void>();
    const batcher: RafBatcher<Event> = createRafBatcher(apply);

    batcher.enqueue({ id: "e1", payload: { foo: 1 } });
    batcher.enqueue({ id: "e2", payload: { bar: "x" } });
    flushRaf();

    expect(apply).toHaveBeenCalledWith([
      { id: "e1", payload: { foo: 1 } },
      { id: "e2", payload: { bar: "x" } },
    ]);
  });

  // ── Cleanup on flush (queue reset) ────────────────────────────

  it("queue is fully cleared after flush — no stale items", () => {
    const batches: number[][] = [];
    const apply = (batch: number[]) => batches.push([...batch]);
    const batcher = createRafBatcher(apply);

    batcher.enqueue(1);
    batcher.enqueue(2);
    flushRaf();

    batcher.enqueue(3);
    flushRaf();

    expect(batches).toEqual([[1, 2], [3]]);
  });
});
