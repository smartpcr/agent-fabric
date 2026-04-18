/**
 * Creates a RAF-coalescing batcher that queues items and flushes them
 * in a single batch on the next `requestAnimationFrame` callback.
 *
 * @typeParam T - The type of items to batch.
 * @param apply - Callback invoked with all queued items once per animation frame.
 * @returns An object with `enqueue` to add items, `flush` to force-flush, and `dispose` to cancel.
 */
export interface RafBatcher<T> {
  /** Add an item to the pending batch. Schedules a RAF flush if one isn't pending. */
  enqueue(item: T): void;
  /** Force an immediate flush of all queued items (cancels any pending RAF). */
  flush(): void;
  /** Cancel any pending RAF and discard queued items. */
  dispose(): void;
}

export function createRafBatcher<T>(apply: (batch: T[]) => void): RafBatcher<T> {
  let queue: T[] = [];
  let rafId: number | null = null;

  function flushQueue(): void {
    rafId = null;
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    apply(batch);
  }

  function scheduleFlush(): void {
    if (rafId === null) {
      rafId = requestAnimationFrame(flushQueue);
    }
  }

  return {
    enqueue(item: T): void {
      queue.push(item);
      scheduleFlush();
    },

    flush(): void {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      flushQueue();
    },

    dispose(): void {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      queue = [];
    },
  };
}
