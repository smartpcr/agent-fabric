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

/** Options for constructing an `SseExecutionEventSource`. */
export interface SseExecutionEventSourceOptions {
  /** Base URL for the SSE endpoint (e.g. `/api/runs`). */
  readonly url: string;
  /** Heartbeat timeout in ms. If no data arrives within this window, reconnect. Default: 30000. */
  readonly heartbeatTimeoutMs?: number;
  /** Maximum backoff delay in ms. Default: 30000. */
  readonly maxBackoffMs?: number;
  /** Base backoff delay in ms. Default: 1000. */
  readonly baseBackoffMs?: number;
  /** Custom fetch implementation (for testing). Defaults to globalThis.fetch. */
  readonly fetch?: typeof globalThis.fetch;
  /** Callback invoked when an invalid event is received and dropped. */
  readonly onInvalidEvent?: (raw: string, error: unknown) => void;
}

// ─── SSE line parser ─────────────────────────────────────────────────

/**
 * Create a minimal SSE line parser.
 *
 * Parses `data:` fields from an SSE text stream. Multi-line `data:` fields
 * are joined with newlines per the SSE spec. Dispatches complete events
 * when a blank line is encountered.
 */
export function createSseLineParser(onEvent: (data: string) => void) {
  let dataBuffer = "";
  let lineBuffer = "";

  function processLine(line: string): void {
    const trimmed = line.replace(/\r$/, "");

    // Blank line = end of event
    if (trimmed === "") {
      if (dataBuffer.length > 0) {
        onEvent(dataBuffer);
        dataBuffer = "";
      }
      return;
    }

    // Comment lines
    if (trimmed.startsWith(":")) return;

    // data: field
    if (trimmed.startsWith("data:")) {
      const value = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed.slice(5);
      if (dataBuffer.length > 0) {
        dataBuffer += "\n";
      }
      dataBuffer += value;
    }
    // Other fields (event:, id:, retry:) are ignored for this adapter
  }

  return {
    /** Feed raw text (possibly partial) into the parser. */
    feed(chunk: string): void {
      lineBuffer += chunk;
      const lines = lineBuffer.split("\n");
      // The last element is an incomplete line — keep it in the buffer
      lineBuffer = lines.pop() ?? "";

      for (const line of lines) {
        processLine(line);
      }
    },
  };
}

// ─── Backoff helper ──────────────────────────────────────────────────

/** Compute exponential backoff with jitter. */
export function computeBackoff(attempt: number, baseMs: number, maxMs: number): number {
  const exponential = Math.min(maxMs, baseMs * 2 ** attempt);
  // Add jitter: 0–100% of the computed delay
  return Math.floor(exponential * Math.random());
}

// ─── Adapter ─────────────────────────────────────────────────────────

/**
 * SSE-based execution event source.
 *
 * Uses `fetch` with a `ReadableStream` reader to process SSE data
 * incrementally. Implements exponential backoff with jitter on reconnect
 * and a heartbeat timeout that triggers reconnect when no data arrives.
 */
export class SseExecutionEventSource implements IExecutionEventSource {
  private closed = false;

  private state: ConnectionState = "disconnected";

  private readonly subscriptions = new Map<string, Set<ExecutionEventHandler>>();

  private readonly stateListeners = new Set<ConnectionStateListener>();

  private abortController: AbortController | null = null;

  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private attempt = 0;

  /** Check if the source has been closed. Method form prevents TS narrowing. */
  private isClosed(): boolean {
    return this.closed;
  }

  private readonly url: string;

  private readonly heartbeatTimeoutMs: number;

  private readonly maxBackoffMs: number;

  private readonly baseBackoffMs: number;

  private readonly fetchImpl: typeof globalThis.fetch;

  private readonly onInvalidEvent: ((raw: string, error: unknown) => void) | undefined;

  constructor(options: SseExecutionEventSourceOptions) {
    this.url = options.url;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 30_000;
    this.maxBackoffMs = options.maxBackoffMs ?? 30_000;
    this.baseBackoffMs = options.baseBackoffMs ?? 1_000;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.onInvalidEvent = options.onInvalidEvent;
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
    // We just ensured the Set exists above
    this.subscriptions.get(runId)?.add(handler);

    // Start the connection if this is the first subscriber
    if (this.state === "disconnected") {
      void this.connect();
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
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
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
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private resetHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearTimeout(this.heartbeatTimer);
    }
    this.heartbeatTimer = setTimeout(() => {
      // No data received within the heartbeat window — reconnect
      if (!this.closed) {
        this.scheduleReconnect();
      }
    }, this.heartbeatTimeoutMs);
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    this.cancelTimers();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.setState("reconnecting");

    const delay = computeBackoff(this.attempt, this.baseBackoffMs, this.maxBackoffMs);
    this.attempt += 1;

    this.reconnectTimer = setTimeout(() => {
      if (!this.closed) {
        void this.connect();
      }
    }, delay);
  }

  private async connect(): Promise<void> {
    if (this.isClosed()) return;

    this.cancelTimers();
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    this.setState("reconnecting");

    try {
      const response = await this.fetchImpl(this.url, {
        signal: this.abortController.signal,
        headers: { Accept: "text/event-stream" },
      });

      if (!response.ok || !response.body) {
        this.scheduleReconnect();
        return;
      }

      // Connection established
      this.setState("connected");
      this.attempt = 0;
      this.resetHeartbeat();

      const parser = createSseLineParser((data) => {
        this.resetHeartbeat();
        this.handleSseData(data);
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done || this.isClosed()) break;
          parser.feed(decoder.decode(value, { stream: true }));
        }
      } catch {
        // Stream error — will reconnect below
      }

      // Stream ended — reconnect unless closed
      if (!this.isClosed()) {
        this.scheduleReconnect();
      }
    } catch {
      // Fetch error (network failure, abort, etc.)
      if (!this.isClosed()) {
        this.scheduleReconnect();
      }
    }
  }

  private handleSseData(raw: string): void {
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
