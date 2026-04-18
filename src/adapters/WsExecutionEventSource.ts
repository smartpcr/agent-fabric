import ReconnectingWebSocket from "reconnecting-websocket";
import type {
  IExecutionEventSource,
  ConnectionState,
  ExecutionEventHandler,
  ConnectionStateListener,
  Unsubscribe,
  ConnectionStateObservable,
} from "@/ports/IExecutionEventSource";
import { executionEventSchema, type ExecutionEvent } from "@/domain/models/executionEvent";

// ─── Configuration ───────────────────────────────────────────────────

/** Options for constructing a `WsExecutionEventSource`. */
export interface WsExecutionEventSourceOptions {
  /** WebSocket URL (e.g. `ws://localhost:8080/events`). */
  readonly url: string;
  /** Heartbeat timeout in ms. If no pong arrives within this window, reconnect. Default: 30000. */
  readonly heartbeatTimeoutMs?: number;
  /** Interval in ms between ping messages. Default: 15000. */
  readonly pingIntervalMs?: number;
  /** Custom WebSocket constructor for testing. Defaults to globalThis.WebSocket. */
  readonly WebSocket?: unknown;
  /** Callback invoked when an invalid event is received and dropped. */
  readonly onInvalidEvent?: (raw: string, error: unknown) => void;
  /** Max reconnection delay in ms. Passed to reconnecting-websocket. Default: 30000. */
  readonly maxReconnectionDelay?: number;
  /** Min reconnection delay in ms. Passed to reconnecting-websocket. Default: 1000. */
  readonly minReconnectionDelay?: number;
  /** Whether to start in a closed (disconnected) state. Default: false. */
  readonly startClosed?: boolean;
}

// ─── Adapter ─────────────────────────────────────────────────────────

/**
 * WebSocket-based execution event source.
 *
 * Uses `reconnecting-websocket` for automatic reconnection with backoff.
 * Implements ping/pong heartbeat: sends periodic "ping" messages and
 * expects "pong" replies. If no pong (or any message) arrives within
 * the heartbeat timeout, forces a reconnect.
 * Incoming events are Zod-validated before dispatch.
 */
export class WsExecutionEventSource implements IExecutionEventSource {
  private closed = false;

  private state: ConnectionState = "disconnected";

  private readonly subscriptions = new Map<string, Set<ExecutionEventHandler>>();

  private readonly stateListeners = new Set<ConnectionStateListener>();

  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

  private pingTimer: ReturnType<typeof setTimeout> | null = null;

  private ws: ReconnectingWebSocket | null = null;

  private readonly url: string;

  private readonly heartbeatTimeoutMs: number;

  private readonly pingIntervalMs: number;

  private readonly onInvalidEvent: ((raw: string, error: unknown) => void) | undefined;

  private readonly wsOptions: {
    WebSocket?: unknown;
    maxReconnectionDelay: number;
    minReconnectionDelay: number;
    startClosed: boolean;
  };

  constructor(options: WsExecutionEventSourceOptions) {
    this.url = options.url;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 30_000;
    this.pingIntervalMs = options.pingIntervalMs ?? 15_000;
    this.onInvalidEvent = options.onInvalidEvent;
    this.wsOptions = {
      WebSocket: options.WebSocket,
      maxReconnectionDelay: options.maxReconnectionDelay ?? 30_000,
      minReconnectionDelay: options.minReconnectionDelay ?? 1_000,
      startClosed: options.startClosed ?? true,
    };
  }

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
    this.subscriptions.get(runId)?.add(handler);

    // Start the connection if not yet connected
    if (this.state === "disconnected" && !this.ws) {
      this.connect();
    }

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
    this.cancelTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState("disconnected");
    this.stateListeners.clear();
  }

  // ─── Internal ────────────────────────────────────────────────────

  private setState(newState: ConnectionState): void {
    if (this.state === newState) return;
    this.state = newState;
    for (const listener of this.stateListeners) listener(newState);
  }

  private cancelTimers(): void {
    if (this.heartbeatTimer !== null) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pingTimer !== null) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private resetHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearTimeout(this.heartbeatTimer);
    }
    this.heartbeatTimer = setTimeout(() => {
      if (!this.closed && this.ws) {
        this.ws.reconnect();
      }
    }, this.heartbeatTimeoutMs);
  }

  private startPing(): void {
    this.cancelTimers();
    this.resetHeartbeat();
    this.schedulePing();
  }

  private schedulePing(): void {
    if (this.pingTimer !== null) {
      clearTimeout(this.pingTimer);
    }
    this.pingTimer = setTimeout(() => {
      if (!this.closed && this.ws && this.ws.readyState === ReconnectingWebSocket.OPEN) {
        this.ws.send("ping");
        this.schedulePing();
      }
    }, this.pingIntervalMs);
  }

  private connect(): void {
    if (this.closed) return;

    this.setState("reconnecting");

    const ws = new ReconnectingWebSocket(this.url, [], {
      WebSocket: this.wsOptions.WebSocket,
      maxReconnectionDelay: this.wsOptions.maxReconnectionDelay,
      minReconnectionDelay: this.wsOptions.minReconnectionDelay,
      startClosed: false,
    });

    ws.onopen = () => {
      if (this.closed) return;
      this.setState("connected");
      this.startPing();
    };

    ws.onclose = () => {
      if (this.closed) return;
      this.cancelTimers();
      this.setState("reconnecting");
    };

    ws.onerror = () => {
      if (this.closed) return;
      this.setState("reconnecting");
    };

    ws.onmessage = (event: MessageEvent) => {
      if (this.closed) return;
      this.resetHeartbeat();

      const raw = typeof event.data === "string" ? event.data : String(event.data);

      // Pong response — just reset heartbeat, don't process
      if (raw === "pong") return;

      this.handleWsData(raw);
    };

    this.ws = ws;
  }

  private handleWsData(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.onInvalidEvent?.(raw, err);
      return;
    }

    const result = executionEventSchema.safeParse(parsed);
    if (!result.success) {
      this.onInvalidEvent?.(raw, result.error);
      return;
    }

    const event: ExecutionEvent = result.data;
    const handlers = this.subscriptions.get(event.runId);
    if (handlers) {
      for (const handler of handlers) handler(event);
    }
  }
}
