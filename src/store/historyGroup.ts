import type { StoreApi } from "zustand";

/**
 * Default idle timeout (ms) before a pending group is flushed to history.
 * While position updates arrive within this window, they are coalesced
 * into a single undo step.
 */
export const HISTORY_GROUP_DELAY = 200;

type HandleSetFn<TState> = StoreApi<TState>["setState"];

/**
 * Creates a `handleSet` function for zundo's `temporal` middleware that
 * coalesces rapid consecutive state updates into a single history entry.
 *
 * When a state change arrives, the *first* past-state snapshot is captured.
 * Subsequent changes within `delayMs` reset the timer but do NOT push
 * additional history entries. When the timer finally fires, the captured
 * past-state is pushed once — so an entire drag (many position updates)
 * becomes a single undo step.
 *
 * @param delayMs  Idle window in milliseconds (default: 200).
 */
export function createHistoryGroupHandler<TState>(delayMs: number = HISTORY_GROUP_DELAY) {
  let pendingPastState: unknown = null;
  let pendingReplace: unknown = null;
  let hasPending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (originalHandleSet: HandleSetFn<TState>) =>
    (
      pastState: Parameters<HandleSetFn<TState>>[0],
      replace: Parameters<HandleSetFn<TState>>[1],
      _currentState: unknown,
      _deltaState?: unknown,
    ) => {
      // Capture the FIRST past state in the group
      if (!hasPending) {
        pendingPastState = pastState;
        pendingReplace = replace;
        hasPending = true;
      }

      // Reset the timer on every update
      if (timer !== null) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        // Flush: push the captured past state as one history entry
        originalHandleSet(
          pendingPastState as Parameters<HandleSetFn<TState>>[0],
          pendingReplace as Parameters<HandleSetFn<TState>>[1],
        );

        // Reset
        pendingPastState = null;
        pendingReplace = null;
        hasPending = false;
        timer = null;
      }, delayMs);
    };
}
