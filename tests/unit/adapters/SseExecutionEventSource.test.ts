import { describe, it, expect, vi, afterEach, afterAll, beforeAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { SseExecutionEventSource, computeBackoff } from "@/adapters/SseExecutionEventSource";
import { runExecutionEventSourceContractTests } from "../ports/IExecutionEventSource.contract.test";
import type { ExecutionEvent } from "@/domain/models/executionEvent";
import type { ConnectionState } from "@/ports/IExecutionEventSource";

// ─── MSW server ──────────────────────────────────────────────────────

const SSE_URL = "http://sse-test.local/api/events";
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
});
afterAll(() => {
  server.close();
});

// ─── Helpers ─────────────────────────────────────────────────────────

const encoder = new TextEncoder();

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

/**
 * Set up an MSW handler that returns a controllable SSE stream.
 * Returns a controller to push SSE frames into the stream.
 */
function useSseHandler(): { push: (text: string) => void; closeStream: () => void } {
  let ctrl: ReadableStreamDefaultController<Uint8Array> | null = null;

  server.use(
    http.get(SSE_URL, () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          ctrl = controller;
        },
        cancel() {
          ctrl = null;
        },
      });
      return new HttpResponse(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }),
  );

  return {
    push(text: string) {
      ctrl?.enqueue(encoder.encode(text));
    },
    closeStream() {
      try {
        ctrl?.close();
      } catch {
        /* already closed */
      }
      ctrl = null;
    },
  };
}

/** Small delay to let async stream processing complete. */
async function flush(ms = 20): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

// ─── Contract tests — SSE adapter ────────────────────────────────────

runExecutionEventSourceContractTests("SseExecutionEventSource", () => {
  const sse = useSseHandler();
  const source = new SseExecutionEventSource({
    url: SSE_URL,
    heartbeatTimeoutMs: 60_000,
  });

  // Track whether the first subscribe has connected
  let connected = false;
  const origSubscribe = source.subscribe.bind(source);
  source.subscribe = (runId: string, handler: (e: ExecutionEvent) => void) => {
    const unsub = origSubscribe(runId, handler);
    if (!connected) {
      connected = true;
    }
    return unsub;
  };

  return {
    source,
    async emit(event: ExecutionEvent) {
      // Ensure the SSE connection is established before pushing data
      if (source.connectionState$.current() !== "connected") {
        const start = Date.now();
        while (source.connectionState$.current() !== "connected" && Date.now() - start < 2000) {
          await flush(5);
        }
      }
      sse.push(sseFrame(event));
      // Allow async stream processing to complete
      await flush(20);
    },
  };
});

// ─── SseExecutionEventSource integration tests (MSW-mocked) ─────────

describe("SseExecutionEventSource", () => {
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe("connection lifecycle", () => {
    it("starts in disconnected state", () => {
      const source = new SseExecutionEventSource({
        url: SSE_URL,
        fetch: vi.fn() as unknown as typeof globalThis.fetch,
      });
      expect(source.connectionState$.current()).toBe("disconnected");
      source.close();
    });

    it("transitions to connected on successful SSE stream", async () => {
      useSseHandler();

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        heartbeatTimeoutMs: 60_000,
      });

      const states: ConnectionState[] = [];
      source.connectionState$.subscribe((s) => states.push(s));

      source.subscribe("run-1", vi.fn());
      await flush(50);

      expect(source.connectionState$.current()).toBe("connected");
      expect(states).toContain("connected");
      source.close();
    });

    it("transitions to reconnecting on fetch failure", async () => {
      server.use(
        http.get(SSE_URL, () => {
          return HttpResponse.error();
        }),
      );

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        baseBackoffMs: 100,
        maxBackoffMs: 100,
      });

      const states: ConnectionState[] = [];
      source.connectionState$.subscribe((s) => states.push(s));

      source.subscribe("run-1", vi.fn());
      await flush(50);

      expect(states).toContain("reconnecting");
      source.close();
    });

    it("transitions to reconnecting on non-ok response", async () => {
      server.use(
        http.get(SSE_URL, () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        baseBackoffMs: 100,
      });

      source.subscribe("run-1", vi.fn());
      await flush(50);

      expect(source.connectionState$.current()).toBe("reconnecting");
      source.close();
    });
  });

  describe("event delivery via MSW-mocked SSE stream", () => {
    it("delivers valid events to matching subscribers", async () => {
      const sse = useSseHandler();
      const event = makeEvent("node.started", "run-1");

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        heartbeatTimeoutMs: 60_000,
      });

      const handler = vi.fn();
      source.subscribe("run-1", handler);
      await flush(50);

      sse.push(sseFrame(event));
      await flush(50);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "node.started", runId: "run-1" }),
      );
      source.close();
    });

    it("does not deliver events for non-matching runId", async () => {
      const sse = useSseHandler();
      const event = makeEvent("node.started", "run-2");

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        heartbeatTimeoutMs: 60_000,
      });

      const handler = vi.fn();
      source.subscribe("run-1", handler);
      await flush(50);

      sse.push(sseFrame(event));
      await flush(50);

      expect(handler).not.toHaveBeenCalled();
      source.close();
    });

    it("delivers to multiple subscribers for the same runId", async () => {
      const sse = useSseHandler();
      const event = makeEvent("node.started", "run-1");

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        heartbeatTimeoutMs: 60_000,
      });

      const h1 = vi.fn();
      const h2 = vi.fn();
      source.subscribe("run-1", h1);
      source.subscribe("run-1", h2);
      await flush(50);

      sse.push(sseFrame(event));
      await flush(50);

      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
      source.close();
    });
  });

  describe("Zod validation", () => {
    it("drops invalid JSON with warning callback", async () => {
      const sse = useSseHandler();
      const onInvalidEvent = vi.fn();

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        heartbeatTimeoutMs: 60_000,
        onInvalidEvent,
      });

      const handler = vi.fn();
      source.subscribe("run-1", handler);
      await flush(50);

      sse.push("data: not-json\n\n");
      await flush(50);

      expect(handler).not.toHaveBeenCalled();
      expect(onInvalidEvent).toHaveBeenCalledTimes(1);
      expect(onInvalidEvent).toHaveBeenCalledWith("not-json", expect.anything());
      source.close();
    });

    it("drops events that fail Zod validation", async () => {
      const sse = useSseHandler();
      const invalidEvent = { type: "bogus.event", runId: "run-1", at: Date.now() };
      const onInvalidEvent = vi.fn();

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        heartbeatTimeoutMs: 60_000,
        onInvalidEvent,
      });

      const handler = vi.fn();
      source.subscribe("run-1", handler);
      await flush(50);

      sse.push(sseFrame(invalidEvent));
      await flush(50);

      expect(handler).not.toHaveBeenCalled();
      expect(onInvalidEvent).toHaveBeenCalledTimes(1);
      source.close();
    });

    it("accepts valid events and delivers them", async () => {
      const sse = useSseHandler();
      const event = makeEvent("run.started", "run-1");

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        heartbeatTimeoutMs: 60_000,
      });

      const handler = vi.fn();
      source.subscribe("run-1", handler);
      await flush(50);

      sse.push(sseFrame(event));
      await flush(50);

      expect(handler).toHaveBeenCalledTimes(1);
      source.close();
    });
  });

  describe("reconnect with exponential backoff", () => {
    it("reconnects after stream ends", async () => {
      let fetchCount = 0;

      server.use(
        http.get(SSE_URL, () => {
          fetchCount += 1;
          if (fetchCount === 1) {
            // First: immediate close (empty body)
            return new HttpResponse("", {
              status: 200,
              headers: { "Content-Type": "text/event-stream" },
            });
          }
          // Subsequent: hanging stream
          const stream = new ReadableStream({
            start() {
              /* hang open */
            },
          });
          return new HttpResponse(stream, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          });
        }),
      );

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        baseBackoffMs: 50,
        maxBackoffMs: 100,
        heartbeatTimeoutMs: 60_000,
      });

      source.subscribe("run-1", vi.fn());

      // Wait for initial connect + stream close + backoff + reconnect
      await flush(500);

      expect(fetchCount).toBeGreaterThanOrEqual(2);
      source.close();
    });

    it("increases backoff on consecutive failures", async () => {
      vi.spyOn(Math, "random").mockReturnValue(1);

      server.use(
        http.get(SSE_URL, () => {
          return HttpResponse.error();
        }),
      );

      const fetchTimes: number[] = [];
      const origFetch = globalThis.fetch.bind(globalThis);
      const wrappedFetch: typeof globalThis.fetch = async (...args) => {
        fetchTimes.push(Date.now());
        return origFetch(...args);
      };

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        fetch: wrappedFetch,
        baseBackoffMs: 50,
        maxBackoffMs: 5000,
        heartbeatTimeoutMs: 60_000,
      });

      source.subscribe("run-1", vi.fn());

      // Wait enough for a few retries (50 + 100 + 200 = ~350ms min)
      await flush(800);

      expect(fetchTimes.length).toBeGreaterThanOrEqual(3);

      // Verify backoff increases: gaps between calls should grow
      if (fetchTimes.length >= 3) {
        const gap1 = fetchTimes[1] - fetchTimes[0];
        const gap2 = fetchTimes[2] - fetchTimes[1];
        expect(gap2).toBeGreaterThanOrEqual(gap1);
      }

      source.close();
      vi.restoreAllMocks();
    });
  });

  describe("heartbeat timeout", () => {
    it("triggers reconnect when no data arrives within timeout", async () => {
      vi.useFakeTimers();
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount += 1;
        const stream = new ReadableStream({
          start() {
            /* hang open */
          },
        });
        return Promise.resolve(
          new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        );
      });

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 5000,
        baseBackoffMs: 0,
        maxBackoffMs: 0,
      });

      source.subscribe("run-1", vi.fn());
      await vi.advanceTimersByTimeAsync(0);
      expect(source.connectionState$.current()).toBe("connected");
      expect(callCount).toBe(1);

      // Heartbeat timeout fires + reconnect
      await vi.advanceTimersByTimeAsync(5100);
      expect(callCount).toBeGreaterThanOrEqual(2);

      source.close();
      vi.useRealTimers();
    });
  });

  describe("close()", () => {
    it("stops delivering events after close", async () => {
      const sse = useSseHandler();
      const event = makeEvent("node.started", "run-1");

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        heartbeatTimeoutMs: 60_000,
      });

      const handler = vi.fn();
      source.subscribe("run-1", handler);
      await flush(50);

      source.close();

      sse.push(sseFrame(event));
      await flush(50);

      expect(handler).not.toHaveBeenCalled();
    });

    it("is safe to call close() multiple times", () => {
      const source = new SseExecutionEventSource({
        url: SSE_URL,
        fetch: vi.fn() as unknown as typeof globalThis.fetch,
      });
      source.close();
      expect(() => {
        source.close();
      }).not.toThrow();
    });

    it("subscribe after close does not throw", () => {
      const source = new SseExecutionEventSource({
        url: SSE_URL,
        fetch: vi.fn() as unknown as typeof globalThis.fetch,
      });
      source.close();

      const handler = vi.fn();
      expect(() => source.subscribe("run-1", handler)).not.toThrow();
    });

    it("sets connection state to disconnected on close", async () => {
      useSseHandler();

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        heartbeatTimeoutMs: 60_000,
      });

      source.subscribe("run-1", vi.fn());
      await flush(50);

      expect(source.connectionState$.current()).toBe("connected");
      source.close();
      expect(source.connectionState$.current()).toBe("disconnected");
    });
  });

  describe("fetch configuration", () => {
    it("sends Accept: text/event-stream header", async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        const stream = new ReadableStream({
          start() {
            /* hang open */
          },
        });
        return Promise.resolve(
          new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        );
      });

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        heartbeatTimeoutMs: 60_000,
      });

      source.subscribe("run-1", vi.fn());
      await flush(50);

      expect(mockFetch).toHaveBeenCalledWith(
        SSE_URL,
        expect.objectContaining({
          headers: { Accept: "text/event-stream" },
        }),
      );
      source.close();
    });
  });

  describe("unsubscribe", () => {
    it("unsubscribe stops event delivery", async () => {
      const sse = useSseHandler();
      const event1 = makeEvent("node.started", "run-1");
      const event2 = makeEvent("node.succeeded", "run-1");

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        heartbeatTimeoutMs: 60_000,
      });

      const handler = vi.fn();
      const unsub = source.subscribe("run-1", handler);
      await flush(50);

      sse.push(sseFrame(event1));
      await flush(50);
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();

      sse.push(sseFrame(event2));
      await flush(50);
      expect(handler).toHaveBeenCalledTimes(1);
      source.close();
    });

    it("double unsubscribe is safe", async () => {
      useSseHandler();

      const source = new SseExecutionEventSource({
        url: SSE_URL,
        heartbeatTimeoutMs: 60_000,
      });

      const unsub = source.subscribe("run-1", vi.fn());
      await flush(50);

      unsub();
      expect(() => {
        unsub();
      }).not.toThrow();
      source.close();
    });
  });
});
