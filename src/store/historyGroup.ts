import type { StoreApi } from "zustand";

/**
 * Default idle timeout (ms) before a pending group is flushed to history.
 * While position updates arrive within this window, they are coalesced
 * into a single undo step.
 */
export const HISTORY_GROUP_DELAY = 200;

type HandleSetFn<TState> = StoreApi<TState>["setState"];

interface NodeLike {
  readonly id: string;
  readonly kind: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly data: unknown;
}

interface GraphLike {
  readonly nodes: readonly NodeLike[];
  readonly edges: readonly unknown[];
}

/**
 * Returns true if the only difference between past and current state
 * is node positions (i.e., a drag). Same node count, same IDs/kinds/data,
 * same edges reference or deep equality.
 */
function isPositionOnlyChange(past: unknown, current: unknown): boolean {
  const p = past as Partial<GraphLike>;
  const c = current as Partial<GraphLike>;

  if (!p.nodes || !c.nodes) return false;
  if (p.nodes.length !== c.nodes.length) return false;

  // Edges must be unchanged
  if (p.edges !== c.edges) return false;

  // Every node must have the same id, kind, and data — only position may differ
  for (let i = 0; i < p.nodes.length; i++) {
    const pn = p.nodes[i];
    const cn = c.nodes[i];
    if (pn.id !== cn.id) return false;
    if (pn.kind !== cn.kind) return false;
    if (pn.data !== cn.data) return false;
  }

  return true;
}

/**
 * Creates a `handleSet` function for zundo's `temporal` middleware that
 * coalesces rapid consecutive **position-only** state updates into a
 * single history entry.
 *
 * When a position-only change arrives, the *first* past-state snapshot
 * is captured. Subsequent position-only changes within `delayMs` reset
 * the timer but do NOT push additional history entries. When the timer
 * fires, the captured past-state is pushed once — so an entire drag
 * (many position updates) becomes a single undo step.
 *
 * Non-position mutations (add/remove node, connect edges, data edits)
 * flush any pending position group immediately and then record their
 * own history entry right away.
 *
 * @param delayMs  Idle window in milliseconds (default: 200).
 */
export function createHistoryGroupHandler<TState>(delayMs: number = HISTORY_GROUP_DELAY) {
  let pendingPastState: unknown = null;
  let pendingReplace: unknown = null;
  let hasPending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flushPending(originalHandleSet: HandleSetFn<TState>): void {
    if (hasPending) {
      originalHandleSet(
        pendingPastState as Parameters<HandleSetFn<TState>>[0],
        pendingReplace as Parameters<HandleSetFn<TState>>[1],
      );
      pendingPastState = null;
      pendingReplace = null;
      hasPending = false;
    }
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return (originalHandleSet: HandleSetFn<TState>) =>
    (
      pastState: Parameters<HandleSetFn<TState>>[0],
      replace: Parameters<HandleSetFn<TState>>[1],
      currentState: unknown,
      _deltaState?: unknown,
    ) => {
      const positionOnly = isPositionOnlyChange(pastState, currentState);

      if (positionOnly) {
        // Debounce: capture the first past state, reset timer on each update
        if (!hasPending) {
          pendingPastState = pastState;
          pendingReplace = replace;
          hasPending = true;
        }

        if (timer !== null) {
          clearTimeout(timer);
        }

        timer = setTimeout(() => {
          flushPending(originalHandleSet);
        }, delayMs);
      } else {
        // Non-position mutation: flush any pending drag group first
        flushPending(originalHandleSet);

        // Then record this mutation immediately
        originalHandleSet(pastState, replace);
      }
    };
}
