import { useCallback, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useExecutionEventSource } from "@/hooks/useExecutionEventSource";
import type { ConnectionState } from "@/ports/IExecutionEventSource";

/** CSS class for each connection state. */
const STATE_CLASS: Record<ConnectionState, string> = {
  connected: "connection-status--connected",
  reconnecting: "connection-status--reconnecting",
  disconnected: "connection-status--disconnected",
};

/** i18n key suffix for each connection state label. */
const STATE_KEY: Record<ConnectionState, string> = {
  connected: "execution.connected",
  reconnecting: "execution.reconnecting",
  disconnected: "execution.disconnected",
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
  const { t } = useTranslation();

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
  const label = t(STATE_KEY[state]);

  return (
    <span
      data-testid="connection-status"
      className={`connection-status ${STATE_CLASS[state]}`}
      role="status"
      aria-label={t("execution.connectionStatus", { state: label })}
    >
      {label}
    </span>
  );
}
