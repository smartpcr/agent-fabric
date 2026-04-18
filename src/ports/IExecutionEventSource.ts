import type { ExecutionEvent } from "@/domain/models/executionEvent";

/** Connection state of an execution event source. */
export type ConnectionState = "connected" | "reconnecting" | "disconnected";

/** Callback invoked when a new execution event arrives. */
export type ExecutionEventHandler = (event: ExecutionEvent) => void;

/** Unsubscribe function returned by `subscribe`. */
export type Unsubscribe = () => void;

/** Callback invoked when connection state changes. */
export type ConnectionStateListener = (state: ConnectionState) => void;

/**
 * Observable-like object for monitoring connection state.
 *
 * Adapters surface `connected`, `reconnecting`, or `disconnected`.
 * Callers subscribe to be notified of changes and can read the
 * current value synchronously via `current()`.
 */
export interface ConnectionStateObservable {
  /** Subscribe to connection-state changes. Returns an unsubscribe function. */
  subscribe(listener: ConnectionStateListener): Unsubscribe;
  /** Read the current connection state synchronously. */
  current(): ConnectionState;
}

/**
 * Port interface for subscribing to execution lifecycle events.
 *
 * All adapters (Fake, SSE, WebSocket) implement this contract so the
 * rest of the app is transport-agnostic.
 */
export interface IExecutionEventSource {
  /**
   * Subscribe to execution events for a given run.
   *
   * @param runId - The run to subscribe to.
   * @param handler - Called for every event whose `runId` matches.
   * @returns An unsubscribe function. Calling it removes this handler.
   */
  subscribe(runId: string, handler: ExecutionEventHandler): Unsubscribe;

  /** Observable that surfaces the connection state of the underlying transport. */
  readonly connectionState$: ConnectionStateObservable;

  /**
   * Permanently close the event source and release all resources.
   * After calling `close()`, no further events are delivered.
   */
  close(): void;
}
