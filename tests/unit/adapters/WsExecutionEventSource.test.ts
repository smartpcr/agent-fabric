import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { WsExecutionEventSource } from "@/adapters/WsExecutionEventSource";
import { runExecutionEventSourceContractTests } from "../ports/IExecutionEventSource.contract.test";
import type { ExecutionEvent } from "@/domain/models/executionEvent";
import type { ConnectionState } from "@/ports/IExecutionEventSource";

// ─── Mock WebSocket ──────────────────────────────────────────────────

type WsListener = (event: unknown) => void;

/**
 * Mock WebSocket that satisfies `reconnecting-websocket`.
 *
 * The library uses `addEventListener`/`removeEventListener` on the
 * underlying socket, checks `CLOSING === 2`, and reads `readyState`.
 */
// eslint-disable-next-line no-use-before-define -- forward ref for type only
const mockWsInstances: MockWebSocket[] = [];

class MockWebSocket {
  static readonly CONNECTING = 0;

  static readonly OPEN = 1;

  static readonly CLOSING = 2;

  static readonly CLOSED = 3;

  static get instances(): MockWebSocket[] {
    return mockWsInstances;
  }

  static set instances(_: MockWebSocket[]) {
    mockWsInstances.length = 0;
  }

  readonly url: string;

  readyState = 0; // MockWebSocket.CONNECTING

  binaryType = "blob";

  sent: string[] = [];

  private readonly listeners = new Map<string, Set<WsListener>>();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.dispatch("close", { code: 1000, reason: "", wasClean: true });
  }

  addEventListener(type: string, listener: WsListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: WsListener): void {
    this.listeners.get(type)?.["delete"](listener);
  }

  dispatchEvent(): boolean {
    return true;
  }

  private dispatch(type: string, event: unknown): void {
    const set = this.listeners.get(type);
    if (set) {
      for (const fn of set) fn(event);
    }
  }

  // ── Test helpers ──────────────────────────────────────────────────

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.dispatch("open", {});
  }

  simulateMessage(data: string): void {
    this.dispatch("message", { data });
  }

  simulateClose(code = 1006): void {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatch("close", { code, reason: "", wasClean: false });
  }

  simulateError(): void {
    this.dispatch("error", { message: "mock error" });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

const WS_URL = "ws://ws-test.local/events";

function makeEvent(
  type: ExecutionEvent["type"],
  runId: string,
  extra: Record<string, unknown> = {},
): ExecutionEvent {
  const base = { runId, at: Date.now() };
  switch (type) {
    case "node.started":
    case "node.succeeded":
    case "node.failed":
    case "node.skipped":
      return {
        ...base,
        type,
        nodeId: (extra.nodeId as string | undefined) ?? "node-1",
        ...extra,
      } as ExecutionEvent;
    case "edge.activated":
    case "edge.taken":
      return {
        ...base,
        type,
        edgeId: (extra.edgeId as string | undefined) ?? "edge-1",
        ...extra,
      } as ExecutionEvent;
    default:
      return { ...base, type, ...extra } as ExecutionEvent;
  }
}

/** Get the most recently created MockWebSocket instance. */
function latestMock(): MockWebSocket {
  const inst = MockWebSocket.instances.at(-1);
  if (!inst) throw new Error("No MockWebSocket instances");
  return inst;
}

/** Small delay to let async processing complete. */
async function flush(ms = 20): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ─── Contract tests — WS adapter ─────────────────────────────────────

runExecutionEventSourceContractTests("WsExecutionEventSource", () => {
  MockWebSocket.instances = [];

  const source = new WsExecutionEventSource({
    url: WS_URL,
    heartbeatTimeoutMs: 60_000,
    pingIntervalMs: 60_000,
    WebSocket: MockWebSocket,
    minReconnectionDelay: 1,
    maxReconnectionDelay: 1,
  });

  return {
    source,
    async emit(event: ExecutionEvent) {
      // After close, the source won't accept connections — just no-op
      let hasInstances = MockWebSocket.instances.length > 0;
      if (!hasInstances) {
        // Wait for RWS to create the underlying WebSocket
        const start = Date.now();
        while (!hasInstances && Date.now() - start < 3000) {
          await flush(10);
          hasInstances = MockWebSocket.instances.length > 0;
        }
        if (!hasInstances) {
          // Source was closed before any WS was created — emit is a no-op
          return;
        }
      }

      // Ensure the WS connection is established
      if (source.connectionState$.current() !== "connected") {
        // Open the mock if it's still connecting
        const m = latestMock();
        if (m.readyState === MockWebSocket.CONNECTING) {
          m.simulateOpen();
        }
        const start = Date.now();
        while (source.connectionState$.current() !== "connected" && Date.now() - start < 2000) {
          await flush(5);
          const inst = MockWebSocket.instances.at(-1);
          if (inst && inst.readyState === MockWebSocket.CONNECTING) {
            inst.simulateOpen();
          }
        }
      }
      const mock = latestMock();
      mock.simulateMessage(JSON.stringify(event));
      await flush(5);
    },
  };
});

// ─── WsExecutionEventSource integration tests ────────────────────────

/**
 * Helper: subscribe, advance timers to let reconnecting-websocket create the
 * underlying WS, then simulate open. Uses the minimum reconnection delay.
 */
async function connectSource(
  source: WsExecutionEventSource,
  runId = "run-1",
  handler = vi.fn(),
): Promise<ReturnType<typeof vi.fn>> {
  source.subscribe(runId, handler);
  // Advance past reconnecting-websocket's internal _wait() delay
  await vi.advanceTimersByTimeAsync(100);
  latestMock().simulateOpen();
  await vi.advanceTimersByTimeAsync(0);
  return handler;
}

describe("WsExecutionEventSource", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("connection lifecycle", () => {
    it("starts in disconnected state", () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
      });
      expect(source.connectionState$.current()).toBe("disconnected");
      source.close();
    });

    it("transitions to reconnecting then connected on subscribe + open", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      const states: ConnectionState[] = [];
      source.connectionState$.subscribe((s) => states.push(s));

      source.subscribe("run-1", vi.fn());
      await vi.advanceTimersByTimeAsync(0);

      expect(states).toContain("reconnecting");

      // Advance past _wait() delay so the WS is created
      await vi.advanceTimersByTimeAsync(50);
      latestMock().simulateOpen();
      await vi.advanceTimersByTimeAsync(0);

      expect(source.connectionState$.current()).toBe("connected");
      expect(states).toContain("connected");
      source.close();
    });

    it("transitions to reconnecting on close from server", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      await connectSource(source);

      expect(source.connectionState$.current()).toBe("connected");

      latestMock().simulateClose();
      await vi.advanceTimersByTimeAsync(0);

      expect(source.connectionState$.current()).toBe("reconnecting");
      source.close();
    });

    it("transitions to reconnecting on error", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      await connectSource(source);

      latestMock().simulateError();
      await vi.advanceTimersByTimeAsync(0);

      expect(source.connectionState$.current()).toBe("reconnecting");
      source.close();
    });
  });

  describe("event delivery via WebSocket", () => {
    it("delivers valid events to matching subscribers", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      const handler = await connectSource(source);

      const event = makeEvent("node.started", "run-1");
      latestMock().simulateMessage(JSON.stringify(event));
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "node.started", runId: "run-1" }),
      );
      source.close();
    });

    it("does not deliver events for non-matching runId", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      const handler = await connectSource(source);

      const event = makeEvent("node.started", "run-2");
      latestMock().simulateMessage(JSON.stringify(event));
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).not.toHaveBeenCalled();
      source.close();
    });

    it("delivers to multiple subscribers for the same runId", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      const h1 = vi.fn();
      const h2 = vi.fn();
      source.subscribe("run-1", h1);
      source.subscribe("run-1", h2);
      await vi.advanceTimersByTimeAsync(100);
      latestMock().simulateOpen();
      await vi.advanceTimersByTimeAsync(0);

      const event = makeEvent("node.started", "run-1");
      latestMock().simulateMessage(JSON.stringify(event));
      await vi.advanceTimersByTimeAsync(0);

      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
      source.close();
    });
  });

  describe("Zod validation", () => {
    it("drops invalid JSON with warning callback", async () => {
      const onInvalidEvent = vi.fn();
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
        onInvalidEvent,
      });

      const handler = await connectSource(source);

      latestMock().simulateMessage("not-json");
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).not.toHaveBeenCalled();
      expect(onInvalidEvent).toHaveBeenCalledTimes(1);
      expect(onInvalidEvent).toHaveBeenCalledWith("not-json", expect.anything());
      source.close();
    });

    it("drops events that fail Zod validation", async () => {
      const onInvalidEvent = vi.fn();
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
        onInvalidEvent,
      });

      const handler = await connectSource(source);

      const invalidEvent = { type: "bogus.event", runId: "run-1", at: Date.now() };
      latestMock().simulateMessage(JSON.stringify(invalidEvent));
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).not.toHaveBeenCalled();
      expect(onInvalidEvent).toHaveBeenCalledTimes(1);
      source.close();
    });

    it("accepts valid events and delivers them", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      const handler = await connectSource(source);

      const event = makeEvent("run.started", "run-1");
      latestMock().simulateMessage(JSON.stringify(event));
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).toHaveBeenCalledTimes(1);
      source.close();
    });
  });

  describe("ping/pong heartbeat", () => {
    it("sends periodic ping messages", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        pingIntervalMs: 100,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      await connectSource(source);
      const mock = latestMock();

      // Advance past the first ping interval
      await vi.advanceTimersByTimeAsync(110);
      expect(mock.sent).toContain("ping");

      // Should send another ping after interval
      mock.sent = [];
      await vi.advanceTimersByTimeAsync(110);
      expect(mock.sent).toContain("ping");

      source.close();
    });

    it("ignores pong messages (does not dispatch them as events)", async () => {
      const onInvalidEvent = vi.fn();
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
        onInvalidEvent,
      });

      const handler = await connectSource(source);

      latestMock().simulateMessage("pong");
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).not.toHaveBeenCalled();
      expect(onInvalidEvent).not.toHaveBeenCalled();
      source.close();
    });

    it("pong resets the heartbeat timer", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 200,
        pingIntervalMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      await connectSource(source);

      // Advance 150ms (within heartbeat window)
      await vi.advanceTimersByTimeAsync(150);
      expect(source.connectionState$.current()).toBe("connected");

      // Receive pong — resets heartbeat
      latestMock().simulateMessage("pong");
      await vi.advanceTimersByTimeAsync(0);

      // Advance another 150ms — still within new heartbeat window
      await vi.advanceTimersByTimeAsync(150);
      expect(source.connectionState$.current()).toBe("connected");

      source.close();
    });
  });

  describe("heartbeat timeout", () => {
    it("triggers reconnect when no data arrives within timeout", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 200,
        pingIntervalMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      await connectSource(source);

      expect(source.connectionState$.current()).toBe("connected");
      const instancesBefore = MockWebSocket.instances.length;

      // Heartbeat timeout fires — triggers reconnect via reconnecting-websocket
      await vi.advanceTimersByTimeAsync(250);

      expect(MockWebSocket.instances.length).toBeGreaterThan(instancesBefore);

      source.close();
    });
  });

  describe("reconnect", () => {
    it("creates a new WebSocket after server close", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      await connectSource(source);
      const firstInstanceCount = MockWebSocket.instances.length;

      // Server closes connection
      latestMock().simulateClose();
      await vi.advanceTimersByTimeAsync(0);

      // Wait for reconnecting-websocket to attempt reconnect
      await vi.advanceTimersByTimeAsync(200);

      expect(MockWebSocket.instances.length).toBeGreaterThan(firstInstanceCount);
      source.close();
    });

    it("delivers events again after reconnection", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      const handler = await connectSource(source);

      // Deliver an event
      const event1 = makeEvent("node.started", "run-1");
      latestMock().simulateMessage(JSON.stringify(event1));
      await vi.advanceTimersByTimeAsync(0);
      expect(handler).toHaveBeenCalledTimes(1);

      // Server closes connection
      latestMock().simulateClose();
      await vi.advanceTimersByTimeAsync(200);

      // Open the new WS instance
      latestMock().simulateOpen();
      await vi.advanceTimersByTimeAsync(0);

      // Deliver another event on the new connection
      const event2 = makeEvent("node.succeeded", "run-1");
      latestMock().simulateMessage(JSON.stringify(event2));
      await vi.advanceTimersByTimeAsync(0);
      expect(handler).toHaveBeenCalledTimes(2);

      source.close();
    });
  });

  describe("close()", () => {
    it("stops delivering events after close", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      const handler = await connectSource(source);
      const mock = latestMock();

      source.close();

      mock.simulateMessage(JSON.stringify(makeEvent("node.started", "run-1")));
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).not.toHaveBeenCalled();
    });

    it("is safe to call close() multiple times", () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
      });
      source.close();
      expect(() => {
        source.close();
      }).not.toThrow();
    });

    it("subscribe after close does not throw", () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
      });
      source.close();

      const handler = vi.fn();
      expect(() => source.subscribe("run-1", handler)).not.toThrow();
    });

    it("sets connection state to disconnected on close", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      await connectSource(source);

      expect(source.connectionState$.current()).toBe("connected");
      source.close();
      expect(source.connectionState$.current()).toBe("disconnected");
    });
  });

  describe("unsubscribe", () => {
    it("unsubscribe stops event delivery", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      const handler = vi.fn();
      const unsub = source.subscribe("run-1", handler);
      await vi.advanceTimersByTimeAsync(100);
      latestMock().simulateOpen();
      await vi.advanceTimersByTimeAsync(0);

      latestMock().simulateMessage(JSON.stringify(makeEvent("node.started", "run-1")));
      await vi.advanceTimersByTimeAsync(0);
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();

      latestMock().simulateMessage(JSON.stringify(makeEvent("node.succeeded", "run-1")));
      await vi.advanceTimersByTimeAsync(0);
      expect(handler).toHaveBeenCalledTimes(1);

      source.close();
    });

    it("double unsubscribe is safe", async () => {
      const source = new WsExecutionEventSource({
        url: WS_URL,
        WebSocket: MockWebSocket,
        heartbeatTimeoutMs: 60_000,
        minReconnectionDelay: 10,
        maxReconnectionDelay: 10,
      });

      const unsub = source.subscribe("run-1", vi.fn());
      await vi.advanceTimersByTimeAsync(100);
      latestMock().simulateOpen();
      await vi.advanceTimersByTimeAsync(0);

      unsub();
      expect(() => {
        unsub();
      }).not.toThrow();
      source.close();
    });
  });
});
