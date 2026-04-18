import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  SseExecutionEventSource,
  createSseLineParser,
  computeBackoff,
} from "@/adapters/SseExecutionEventSource";
import type { ExecutionEvent } from "@/domain/models/executionEvent";
import type { ConnectionState } from "@/ports/IExecutionEventSource";

// ─── SSE stream simulation helpers ───────────────────────────────────

function sseFrame(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

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

/** Create a ReadableStream from an array of string chunks, with optional delays. */
function createSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      } else {
        controller.close();
      }
    },
  });
}

/** Create a ReadableStream that stays open (never closes) until aborted. */
function createHangingStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start() {
      // Intentionally left open — simulates a long-lived SSE connection
    },
    cancel() {
      // Stream cancelled (e.g. by abort)
    },
  });
}

// ─── SseLineParser unit tests ────────────────────────────────────────

describe("createSseLineParser", () => {
  it("parses a single SSE event", () => {
    const events: string[] = [];
    const parser = createSseLineParser((data) => events.push(data));

    parser.feed('data: {"hello":"world"}\n\n');

    expect(events).toEqual(['{"hello":"world"}']);
  });

  it("parses multiple events in one chunk", () => {
    const events: string[] = [];
    const parser = createSseLineParser((data) => events.push(data));

    parser.feed("data: first\n\ndata: second\n\n");

    expect(events).toEqual(["first", "second"]);
  });

  it("handles partial chunks across feeds", () => {
    const events: string[] = [];
    const parser = createSseLineParser((data) => events.push(data));

    parser.feed("data: par");
    parser.feed("tial\n\n");

    expect(events).toEqual(["partial"]);
  });

  it("handles multi-line data fields", () => {
    const events: string[] = [];
    const parser = createSseLineParser((data) => events.push(data));

    parser.feed("data: line1\ndata: line2\n\n");

    expect(events).toEqual(["line1\nline2"]);
  });

  it("ignores comment lines", () => {
    const events: string[] = [];
    const parser = createSseLineParser((data) => events.push(data));

    parser.feed(": this is a comment\ndata: actual\n\n");

    expect(events).toEqual(["actual"]);
  });

  it("handles data: with no space after colon", () => {
    const events: string[] = [];
    const parser = createSseLineParser((data) => events.push(data));

    parser.feed("data:nospace\n\n");

    expect(events).toEqual(["nospace"]);
  });

  it("handles carriage return line endings", () => {
    const events: string[] = [];
    const parser = createSseLineParser((data) => events.push(data));

    parser.feed("data: value\r\n\r\n");

    expect(events).toEqual(["value"]);
  });

  it("ignores non-data fields", () => {
    const events: string[] = [];
    const parser = createSseLineParser((data) => events.push(data));

    parser.feed("event: custom\nid: 123\nretry: 5000\ndata: payload\n\n");

    expect(events).toEqual(["payload"]);
  });

  it("does not emit for blank-only lines with no data", () => {
    const events: string[] = [];
    const parser = createSseLineParser((data) => events.push(data));

    parser.feed("\n\n\n");

    expect(events).toEqual([]);
  });
});

// ─── computeBackoff unit tests ───────────────────────────────────────

describe("computeBackoff", () => {
  it("returns 0 on first attempt when random is 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(computeBackoff(0, 1000, 30000)).toBe(0);
    vi.restoreAllMocks();
  });

  it("returns baseMs on first attempt when random is 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    expect(computeBackoff(0, 1000, 30000)).toBe(1000);
    vi.restoreAllMocks();
  });

  it("doubles per attempt", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    expect(computeBackoff(1, 1000, 30000)).toBe(2000);
    expect(computeBackoff(2, 1000, 30000)).toBe(4000);
    expect(computeBackoff(3, 1000, 30000)).toBe(8000);
    vi.restoreAllMocks();
  });

  it("caps at maxMs", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    expect(computeBackoff(10, 1000, 5000)).toBe(5000);
    vi.restoreAllMocks();
  });

  it("applies jitter (result < exponential)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(computeBackoff(0, 1000, 30000)).toBe(500);
    vi.restoreAllMocks();
  });
});

// Because the SSE adapter is inherently async (fetch + ReadableStream),
// the contract tests that expect synchronous emit delivery won't work
// directly. We verify the same behaviors with async-aware tests below.

// ─── SseExecutionEventSource integration tests ───────────────────────

describe("SseExecutionEventSource", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("connection lifecycle", () => {
    it("starts in disconnected state", () => {
      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: vi.fn() as unknown as typeof globalThis.fetch,
      });
      expect(source.connectionState$.current()).toBe("disconnected");
      source.close();
    });

    it("transitions to connected on successful fetch", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(createHangingStream(), { status: 200 }));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
      });

      const states: ConnectionState[] = [];
      source.connectionState$.subscribe((s) => states.push(s));

      source.subscribe("run-1", vi.fn());

      // Let the async connect resolve
      await vi.advanceTimersByTimeAsync(0);

      expect(source.connectionState$.current()).toBe("connected");
      expect(states).toContain("connected");
      source.close();
    });

    it("transitions to reconnecting on fetch failure", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        baseBackoffMs: 100,
        maxBackoffMs: 100,
      });

      const states: ConnectionState[] = [];
      source.connectionState$.subscribe((s) => states.push(s));

      source.subscribe("run-1", vi.fn());

      // Let the async connect reject
      await vi.advanceTimersByTimeAsync(0);

      expect(states).toContain("reconnecting");
      source.close();
    });

    it("transitions to reconnecting on non-ok response", async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        baseBackoffMs: 100,
      });

      source.subscribe("run-1", vi.fn());
      await vi.advanceTimersByTimeAsync(0);

      expect(source.connectionState$.current()).toBe("reconnecting");
      source.close();
    });
  });

  describe("event delivery via SSE stream", () => {
    it("delivers valid events to matching subscribers", async () => {
      const event = makeEvent("node.started", "run-1");
      const chunks = [sseFrame(event)];

      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(createSseStream(chunks), { status: 200 }));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
      });

      const handler = vi.fn();
      source.subscribe("run-1", handler);

      await vi.advanceTimersByTimeAsync(10);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "node.started", runId: "run-1" }),
      );
      source.close();
    });

    it("does not deliver events for non-matching runId", async () => {
      const event = makeEvent("node.started", "run-2");
      const chunks = [sseFrame(event)];

      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(createSseStream(chunks), { status: 200 }));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
      });

      const handler = vi.fn();
      source.subscribe("run-1", handler);

      await vi.advanceTimersByTimeAsync(10);

      expect(handler).not.toHaveBeenCalled();
      source.close();
    });

    it("delivers to multiple subscribers for the same runId", async () => {
      const event = makeEvent("node.started", "run-1");
      const chunks = [sseFrame(event)];

      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(createSseStream(chunks), { status: 200 }));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
      });

      const h1 = vi.fn();
      const h2 = vi.fn();
      source.subscribe("run-1", h1);
      source.subscribe("run-1", h2);

      await vi.advanceTimersByTimeAsync(10);

      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
      source.close();
    });
  });

  describe("Zod validation", () => {
    it("drops invalid JSON with warning callback", async () => {
      const chunks = ["data: not-json\n\n"];
      const onInvalidEvent = vi.fn();

      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(createSseStream(chunks), { status: 200 }));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
        onInvalidEvent,
      });

      const handler = vi.fn();
      source.subscribe("run-1", handler);

      await vi.advanceTimersByTimeAsync(10);

      expect(handler).not.toHaveBeenCalled();
      expect(onInvalidEvent).toHaveBeenCalledTimes(1);
      expect(onInvalidEvent).toHaveBeenCalledWith("not-json", expect.anything());
      source.close();
    });

    it("drops events that fail Zod validation", async () => {
      // Valid JSON but not a valid ExecutionEvent
      const invalidEvent = { type: "bogus.event", runId: "run-1", at: Date.now() };
      const chunks = [sseFrame(invalidEvent)];
      const onInvalidEvent = vi.fn();

      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(createSseStream(chunks), { status: 200 }));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
        onInvalidEvent,
      });

      const handler = vi.fn();
      source.subscribe("run-1", handler);

      await vi.advanceTimersByTimeAsync(10);

      expect(handler).not.toHaveBeenCalled();
      expect(onInvalidEvent).toHaveBeenCalledTimes(1);
      source.close();
    });

    it("accepts valid events and delivers them", async () => {
      const event = makeEvent("run.started", "run-1");
      const chunks = [sseFrame(event)];

      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(createSseStream(chunks), { status: 200 }));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
      });

      const handler = vi.fn();
      source.subscribe("run-1", handler);

      await vi.advanceTimersByTimeAsync(10);

      expect(handler).toHaveBeenCalledTimes(1);
      source.close();
    });
  });

  describe("reconnect with exponential backoff", () => {
    it("reconnects after stream ends", async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
          // First connection: stream closes immediately
          return Promise.resolve(new Response(createSseStream([]), { status: 200 }));
        }
        // Subsequent: hang forever
        return Promise.resolve(new Response(createHangingStream(), { status: 200 }));
      });

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        baseBackoffMs: 100,
        maxBackoffMs: 1000,
        heartbeatTimeoutMs: 60_000,
      });

      source.subscribe("run-1", vi.fn());

      // First connect + stream end
      await vi.advanceTimersByTimeAsync(10);

      // Backoff timer fires
      await vi.advanceTimersByTimeAsync(1100);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      source.close();
    });

    it("increases backoff on consecutive failures", async () => {
      vi.spyOn(Math, "random").mockReturnValue(1);

      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        baseBackoffMs: 100,
        maxBackoffMs: 10000,
        heartbeatTimeoutMs: 60_000,
      });

      source.subscribe("run-1", vi.fn());

      // First attempt
      await vi.advanceTimersByTimeAsync(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // First backoff: 100ms (100 * 2^0 * 1.0)
      await vi.advanceTimersByTimeAsync(100);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Second backoff: 200ms (100 * 2^1 * 1.0)
      await vi.advanceTimersByTimeAsync(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Third backoff: 400ms (100 * 2^2 * 1.0)
      await vi.advanceTimersByTimeAsync(400);
      expect(mockFetch).toHaveBeenCalledTimes(4);

      source.close();
      vi.restoreAllMocks();
    });

    it("resets attempt counter on successful connection", async () => {
      vi.spyOn(Math, "random").mockReturnValue(1);
      let callCount = 0;

      const mockFetch = vi.fn().mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.reject(new Error("fail"));
        }
        // Second call succeeds with empty stream (which closes)
        return Promise.resolve(new Response(createSseStream([]), { status: 200 }));
      });

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        baseBackoffMs: 100,
        maxBackoffMs: 10000,
        heartbeatTimeoutMs: 60_000,
      });

      source.subscribe("run-1", vi.fn());

      // First attempt fails
      await vi.advanceTimersByTimeAsync(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Backoff: 100ms (attempt=0 after fail, so 100 * 2^0 = 100)
      await vi.advanceTimersByTimeAsync(100);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Stream ended => reconnect. Attempt should be reset to 0.
      // So next backoff is 100ms (not 200ms)
      await vi.advanceTimersByTimeAsync(100);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      source.close();
      vi.restoreAllMocks();
    });
  });

  describe("heartbeat timeout", () => {
    it("triggers reconnect when no data arrives within timeout", async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount += 1;
        return Promise.resolve(new Response(createHangingStream(), { status: 200 }));
      });

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 5000,
        baseBackoffMs: 0,
        maxBackoffMs: 0,
      });

      source.subscribe("run-1", vi.fn());

      // Connect
      await vi.advanceTimersByTimeAsync(0);
      expect(source.connectionState$.current()).toBe("connected");
      expect(callCount).toBe(1);

      // Heartbeat timeout fires + reconnect timer (0ms) + async connect
      await vi.advanceTimersByTimeAsync(5100);

      // Should have made at least one reconnect attempt
      expect(callCount).toBeGreaterThanOrEqual(2);

      source.close();
    });
  });

  describe("close()", () => {
    it("stops delivering events after close", async () => {
      const event = makeEvent("node.started", "run-1");

      const ref: { ctrl: ReadableStreamDefaultController<Uint8Array> | null } = { ctrl: null };
      const mockFetch = vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            const stream = new ReadableStream<Uint8Array>({
              start(controller) {
                ref.ctrl = controller;
              },
            });
            resolve(new Response(stream, { status: 200 }));
          }),
      );

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
      });

      const handler = vi.fn();
      source.subscribe("run-1", handler);

      await vi.advanceTimersByTimeAsync(0);

      source.close();

      // Try to emit after close
      if (ref.ctrl) {
        const encoder = new TextEncoder();
        try {
          ref.ctrl.enqueue(encoder.encode(sseFrame(event)));
        } catch {
          // Stream may be cancelled — that's expected
        }
      }

      await vi.advanceTimersByTimeAsync(10);
      expect(handler).not.toHaveBeenCalled();
    });

    it("is safe to call close() multiple times", () => {
      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: vi.fn() as unknown as typeof globalThis.fetch,
      });
      source.close();
      expect(() => {
        source.close();
      }).not.toThrow();
    });

    it("subscribe after close does not throw", () => {
      const mockFetch = vi.fn();
      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
      });
      source.close();

      const handler = vi.fn();
      expect(() => source.subscribe("run-1", handler)).not.toThrow();

      // Should not have triggered any fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sets connection state to disconnected on close", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(createHangingStream(), { status: 200 }));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
      });

      source.subscribe("run-1", vi.fn());
      await vi.advanceTimersByTimeAsync(0);

      expect(source.connectionState$.current()).toBe("connected");

      source.close();

      expect(source.connectionState$.current()).toBe("disconnected");
    });
  });

  describe("fetch configuration", () => {
    it("sends Accept: text/event-stream header", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(createHangingStream(), { status: 200 }));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
      });

      source.subscribe("run-1", vi.fn());
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/events",
        expect.objectContaining({
          headers: { Accept: "text/event-stream" },
        }),
      );
      source.close();
    });

    it("uses the configured URL", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(createHangingStream(), { status: 200 }));

      const source = new SseExecutionEventSource({
        url: "https://example.com/sse",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
      });

      source.subscribe("run-1", vi.fn());
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/sse", expect.anything());
      source.close();
    });
  });

  describe("unsubscribe", () => {
    it("unsubscribe stops event delivery", async () => {
      const event1 = makeEvent("node.started", "run-1");
      const event2 = makeEvent("node.succeeded", "run-1");

      const ref: { ctrl: ReadableStreamDefaultController<Uint8Array> | null } = { ctrl: null };
      const encoder = new TextEncoder();

      const mockFetch = vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            const stream = new ReadableStream<Uint8Array>({
              start(controller) {
                ref.ctrl = controller;
              },
            });
            resolve(new Response(stream, { status: 200 }));
          }),
      );

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
      });

      const handler = vi.fn();
      const unsub = source.subscribe("run-1", handler);

      await vi.advanceTimersByTimeAsync(0);

      // Deliver first event
      if (ref.ctrl) {
        ref.ctrl.enqueue(encoder.encode(sseFrame(event1)));
      }
      await vi.advanceTimersByTimeAsync(10);
      expect(handler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsub();

      // Deliver second event
      if (ref.ctrl) {
        ref.ctrl.enqueue(encoder.encode(sseFrame(event2)));
      }
      await vi.advanceTimersByTimeAsync(10);

      // Should not have received the second event
      expect(handler).toHaveBeenCalledTimes(1);
      source.close();
    });

    it("double unsubscribe is safe", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(createHangingStream(), { status: 200 }));

      const source = new SseExecutionEventSource({
        url: "/api/events",
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
      });

      const unsub = source.subscribe("run-1", vi.fn());
      await vi.advanceTimersByTimeAsync(0);

      unsub();
      expect(() => {
        unsub();
      }).not.toThrow();
      source.close();
    });
  });
});
