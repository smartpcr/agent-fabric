import { useCallback, useSyncExternalStore } from "react";
import { useExecutionEventSource } from "@/hooks/useExecutionEventSource";
import type { ConnectionState } from "@/ports/IExecutionEventSource";

/** Visual configuration for each connection state. */
const STATE_CONFIG: Record<ConnectionState, { label: string; className: string }> = {
  connected: { label: "Connected", className: "connection-status--connected" },
  reconnecting: { label: "Reconnecting", className: "connection-status--reconnecting" },
  disconnected: { label: "Disconnected", className: "connection-status--disconnected" },
};

/**
 * Badge that reflects the current connection state of the execution
 * event source (`connected`, `reconnecting`, or `disconnected`).
 *
 * Uses `useSyncExternalStore` to guarantee no state transitions are
 * missed between the initial snapshot read and subscription — the
 * React contract ensures the subscribe + getSnapshot pair is race-free.
 */
export function ConnectionStatus() {
  const eventSource = useExecutionEventSource();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubscribe = eventSource.connectionState$.subscribe(() => {
        onStoreChange();
      });
      return unsubscribe;
    },
    [eventSource],
  );

  const getSnapshot = useCallback(() => eventSource.connectionState$.current(), [eventSource]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const config = STATE_CONFIG[state];

  return (
    <span
      data-testid="connection-status"
      className={`connection-status ${config.className}`}
      role="status"
      aria-label={`Connection status: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
