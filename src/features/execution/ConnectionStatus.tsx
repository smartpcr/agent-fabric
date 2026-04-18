import { useState, useEffect } from "react";
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
 * Subscribes to `connectionState$` on mount, reads the initial value
 * synchronously via `current()`, and updates on every state change.
 * Unsubscribes on unmount.
 */
export function ConnectionStatus() {
  const eventSource = useExecutionEventSource();
  const [state, setState] = useState<ConnectionState>(() => eventSource.connectionState$.current());

  useEffect(() => {
    const unsubscribe = eventSource.connectionState$.subscribe((next) => {
      setState(next);
    });

    return unsubscribe;
  }, [eventSource]);

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
