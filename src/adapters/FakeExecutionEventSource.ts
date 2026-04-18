import type {
  IExecutionEventSource,
  ConnectionState,
  ExecutionEventHandler,
  ConnectionStateListener,
  Unsubscribe,
  ConnectionStateObservable,
} from "@/ports/IExecutionEventSource";
import type { ExecutionEvent } from "@/domain/models/executionEvent";

/**
 * In-memory execution event source for tests and development.
 *
 * Provides `emit(event)` and `setConnectionState(state)` helpers
 * to drive subscribers from test code.
 */
export class FakeExecutionEventSource implements IExecutionEventSource {
  private closed = false;

  private state: ConnectionState = "connected";

  private readonly subscriptions = new Map<string, Set<ExecutionEventHandler>>();

  private readonly stateListeners = new Set<ConnectionStateListener>();

  readonly connectionState$: ConnectionStateObservable = {
    subscribe: (listener: ConnectionStateListener): Unsubscribe => {
      this.stateListeners.add(listener);
      return () => {
        this.stateListeners["delete"](listener);
      };
    },
    current: (): ConnectionState => this.state,
  };

  subscribe(runId: string, handler: ExecutionEventHandler): Unsubscribe {
    if (this.closed) {
      return () => {
        /* closed — no-op */
      };
    }
    if (!this.subscriptions.has(runId)) {
      this.subscriptions.set(runId, new Set());
    }
    const handlers = this.subscriptions.get(runId);
    if (handlers) handlers.add(handler);

    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      this.subscriptions.get(runId)?.["delete"](handler);
    };
  }

  close(): void {
    this.closed = true;
    this.subscriptions.clear();
    this.state = "disconnected";
    for (const listener of this.stateListeners) listener("disconnected");
    this.stateListeners.clear();
  }

  // ─── Test helpers ────────────────────────────────────────────────

  /** Push an event to all matching subscribers. */
  emit(event: ExecutionEvent): void {
    if (this.closed) return;
    const handlers = this.subscriptions.get(event.runId);
    if (handlers) {
      for (const handler of handlers) handler(event);
    }
  }

  /** Manually set the connection state and notify listeners. */
  setConnectionState(newState: ConnectionState): void {
    this.state = newState;
    for (const listener of this.stateListeners) listener(newState);
  }
}
