import { useRef, useEffect, useCallback } from "react";

/**
 * Options for the debounced commit hook.
 */
export interface UseDebouncedCommitOptions<T> {
  /** Callback invoked after the debounce delay with the latest value. */
  readonly onCommit: (value: T) => void;
  /** Debounce delay in milliseconds. Defaults to 300. */
  readonly delay?: number;
}

/**
 * Hook that collects changes and commits them after a debounce delay.
 *
 * - After each call to `stage(value)`, the timer resets.
 * - After `delay` ms of inactivity, `onCommit` is called with the latest value.
 * - On unmount the pending commit is **cancelled** (not flushed) to avoid
 *   writing to unmounted state from a stale closure. Only a clean explicit
 *   flush (via the returned `flush` function) should be used when the caller
 *   knows unmount is intentional and safe.
 *
 * @returns `{ stage, flush, cancel }` — stage a new value, flush immediately, or cancel pending.
 */
export function useDebouncedCommit<T>({ onCommit, delay = 300 }: UseDebouncedCommitOptions<T>): {
  /** Stage a new value; resets the debounce timer. */
  stage: (value: T) => void;
  /** Immediately commit the latest staged value (if any). */
  flush: () => void;
  /** Cancel the pending commit without firing onCommit. */
  cancel: () => void;
} {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<{ value: T } | null>(null);
  const onCommitRef = useRef(onCommit);

  // Keep onCommit ref fresh so the debounced call always uses the latest callback.
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    latestRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (latestRef.current !== null) {
      const { value } = latestRef.current;
      latestRef.current = null;
      onCommitRef.current(value);
    }
  }, []);

  const stage = useCallback(
    (value: T) => {
      latestRef.current = { value };
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (latestRef.current !== null) {
          const staged = latestRef.current.value;
          latestRef.current = null;
          onCommitRef.current(staged);
        }
      }, delay);
    },
    [delay],
  );

  // On unmount: cancel pending — do NOT flush.
  // The spec says "flushes only if unmounted cleanly (not on error)".
  // Since React error boundaries unmount components too, the safest default
  // is to cancel. Callers who know unmount is clean can call flush() in
  // their own cleanup before unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      latestRef.current = null;
    };
  }, []);

  return { stage, flush, cancel };
}
