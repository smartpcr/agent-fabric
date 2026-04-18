import { useEffect, useRef } from "react";
import { useExecutionEventSource } from "@/hooks/useExecutionEventSource";
import type { ExecutionEvent } from "@/domain/models/executionEvent";

/**
 * Lifecycle hook that subscribes to execution events for a given `runId`
 * on mount and unsubscribes on unmount.
 *
 * A ref flag (`mountedRef`) prevents the `onEvent` callback from being
 * invoked after unmount, protecting callers from writing to unmounted
 * component state when an in-flight network response arrives late.
 *
 * @param runId   - The run to subscribe to. Pass `undefined` to skip
 *                  subscribing (e.g., when no run is active).
 * @param onEvent - Callback invoked for every event while the component
 *                  is still mounted. Stable identity recommended (wrap
 *                  with `useCallback`).
 */
export function useExecutionSubscription(
  runId: string | undefined,
  onEvent: (event: ExecutionEvent) => void,
): void {
  const eventSource = useExecutionEventSource();
  const mountedRef = useRef(true);

  // Keep onEvent in a ref so effect doesn't re-subscribe when callback identity changes.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    mountedRef.current = true;

    if (runId === undefined) {
      return;
    }

    const unsubscribe = eventSource.subscribe(runId, (event: ExecutionEvent) => {
      if (mountedRef.current) {
        onEventRef.current(event);
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [runId, eventSource]);
}
