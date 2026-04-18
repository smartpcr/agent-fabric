import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { IExecutionEventSource, ConnectionState } from "@/ports/IExecutionEventSource";
import type { ExecutionEvent } from "@/domain/models/executionEvent";

// ─── Helpers ─────────────────────────────────────────────────────────

const NOW = Date.now();

function makeEvent(
  type: ExecutionEvent["type"],
  runId: string,
  extra: Record<string, unknown> = {},
): ExecutionEvent {
  const base = { runId, at: NOW };
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

// ─── Contract test factory ───────────────────────────────────────────

/**
 * Reusable contract test suite for `IExecutionEventSource`.
 *
 * Any adapter that implements the interface can import this function
 * and call it to verify contract compliance.
 *
 * @param name - Display name for the test suite (e.g. "FakeExecutionEventSource").
 * @param factory - Creates a fresh source for each test. Also returns an
 *   `emit` helper to push events into the source and an optional
 *   `setConnectionState` helper for adapters that support it.
 */
export function runExecutionEventSourceContractTests(
  name: string,
  factory: () => {
    source: IExecutionEventSource;
    emit: (event: ExecutionEvent) => void;
    setConnectionState?: (state: ConnectionState) => void;
  },
) {
  describe(`IExecutionEventSource contract — ${name}`, () => {
    let source: IExecutionEventSource;
    let emit: (event: ExecutionEvent) => void;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used conditionally below
    let _setConnectionState: ((state: ConnectionState) => void) | undefined;

    beforeEach(() => {
      const created = factory();
      source = created.source;
      emit = created.emit;
      _setConnectionState = created.setConnectionState;
    });

    afterEach(() => {
      source.close();
    });

    // ── subscribe ──────────────────────────────────────────────────

    describe("subscribe(runId, handler)", () => {
      it("delivers events matching the subscribed runId", () => {
        const handler = vi.fn();
        source.subscribe("run-1", handler);

        const event = makeEvent("node.started", "run-1");
        emit(event);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(event);
      });

      it("does not deliver events for a different runId", () => {
        const handler = vi.fn();
        source.subscribe("run-1", handler);

        emit(makeEvent("node.started", "run-2"));

        expect(handler).not.toHaveBeenCalled();
      });

      it("delivers events to multiple subscribers for the same runId", () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        source.subscribe("run-1", handler1);
        source.subscribe("run-1", handler2);

        const event = makeEvent("node.started", "run-1");
        emit(event);

        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
      });

      it("delivers events to separate subscribers for different runIds", () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        source.subscribe("run-1", handler1);
        source.subscribe("run-2", handler2);

        emit(makeEvent("node.started", "run-1"));
        emit(makeEvent("node.succeeded", "run-2"));

        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
      });

      it("returns an unsubscribe function", () => {
        const handler = vi.fn();
        const unsub = source.subscribe("run-1", handler);

        expect(typeof unsub).toBe("function");
      });

      it("unsubscribe stops future event delivery", () => {
        const handler = vi.fn();
        const unsub = source.subscribe("run-1", handler);

        emit(makeEvent("node.started", "run-1"));
        expect(handler).toHaveBeenCalledTimes(1);

        unsub();

        emit(makeEvent("node.succeeded", "run-1"));
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it("unsubscribing one handler does not affect others", () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        const unsub1 = source.subscribe("run-1", handler1);
        source.subscribe("run-1", handler2);

        unsub1();

        emit(makeEvent("node.started", "run-1"));

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).toHaveBeenCalledTimes(1);
      });

      it("double-unsubscribe is safe (no-op)", () => {
        const handler = vi.fn();
        const unsub = source.subscribe("run-1", handler);

        unsub();
        unsub(); // second call should not throw

        emit(makeEvent("node.started", "run-1"));
        expect(handler).not.toHaveBeenCalled();
      });

      it("delivers multiple event types for the same run", () => {
        const handler = vi.fn();
        source.subscribe("run-1", handler);

        emit(makeEvent("run.started", "run-1"));
        emit(makeEvent("node.started", "run-1"));
        emit(makeEvent("node.succeeded", "run-1"));
        emit(makeEvent("edge.activated", "run-1"));
        emit(makeEvent("run.completed", "run-1"));

        expect(handler).toHaveBeenCalledTimes(5);
      });
    });

    // ── connectionState$ ───────────────────────────────────────────

    describe("connectionState$", () => {
      it("exposes a connectionState$ observable", () => {
        expect(source.connectionState$).toBeDefined();
        expect(typeof source.connectionState$.subscribe).toBe("function");
        expect(typeof source.connectionState$.current).toBe("function");
      });

      it("current() returns a valid ConnectionState", () => {
        const state = source.connectionState$.current();
        expect(["connected", "reconnecting", "disconnected"]).toContain(state);
      });

      it("subscribe returns an unsubscribe function", () => {
        const listener = vi.fn();
        const unsub = source.connectionState$.subscribe(listener);
        expect(typeof unsub).toBe("function");
        unsub();
      });

      if (factory().setConnectionState) {
        it("notifies listeners when connection state changes", () => {
          const listener = vi.fn();
          const fresh = factory();
          fresh.source.connectionState$.subscribe(listener);

          const setState = fresh.setConnectionState;
          if (!setState) throw new Error("setConnectionState expected");

          setState("reconnecting");
          expect(listener).toHaveBeenCalledWith("reconnecting");

          setState("disconnected");
          expect(listener).toHaveBeenCalledWith("disconnected");

          setState("connected");
          expect(listener).toHaveBeenCalledWith("connected");

          expect(listener).toHaveBeenCalledTimes(3);
          fresh.source.close();
        });

        it("unsubscribing from connectionState$ stops notifications", () => {
          const listener = vi.fn();
          const fresh = factory();
          const unsub = fresh.source.connectionState$.subscribe(listener);

          const setState = fresh.setConnectionState;
          if (!setState) throw new Error("setConnectionState expected");

          setState("reconnecting");
          expect(listener).toHaveBeenCalledTimes(1);

          unsub();

          setState("disconnected");
          expect(listener).toHaveBeenCalledTimes(1);
          fresh.source.close();
        });
      }
    });

    // ── close ──────────────────────────────────────────────────────

    describe("close()", () => {
      it("stops delivering events after close", () => {
        const handler = vi.fn();
        source.subscribe("run-1", handler);

        source.close();

        emit(makeEvent("node.started", "run-1"));
        expect(handler).not.toHaveBeenCalled();
      });

      it("is safe to call close() multiple times", () => {
        source.close();
        expect(() => {
          source.close();
        }).not.toThrow();
      });

      it("subscribe after close does not throw but handler is not called", () => {
        source.close();

        const handler = vi.fn();
        expect(() => source.subscribe("run-1", handler)).not.toThrow();

        emit(makeEvent("node.started", "run-1"));
        expect(handler).not.toHaveBeenCalled();
      });

      if (factory().setConnectionState) {
        it("sets connection state to disconnected on close", () => {
          const fresh = factory();
          fresh.source.close();
          expect(fresh.source.connectionState$.current()).toBe("disconnected");
        });
      }
    });
  });
}

// ─── Self-test: verify the contract tests pass with an inline adapter ─

/** Minimal inline adapter to self-verify the contract test suite. */
function createInlineAdapter() {
  type Handler = (event: ExecutionEvent) => void;
  type StateListener = (state: ConnectionState) => void;

  let closed = false;
  let connectionState: ConnectionState = "connected";
  const subscriptions = new Map<string, Set<Handler>>();
  const stateListeners = new Set<StateListener>();

  const source: IExecutionEventSource = {
    subscribe(runId: string, handler: Handler) {
      if (closed) {
        return () => {
          /* closed — no-op unsubscribe */
        };
      }
      if (!subscriptions.has(runId)) subscriptions.set(runId, new Set());
      const handlers = subscriptions.get(runId);
      if (handlers) handlers.add(handler);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        subscriptions.get(runId)?.["delete"](handler);
      };
    },
    connectionState$: {
      subscribe(listener: StateListener) {
        stateListeners.add(listener);
        return () => {
          stateListeners["delete"](listener);
        };
      },
      current() {
        return connectionState;
      },
    },
    close() {
      closed = true;
      subscriptions.clear();
      connectionState = "disconnected";
      for (const l of stateListeners) l("disconnected");
      stateListeners.clear();
    },
  };

  function emit(event: ExecutionEvent) {
    if (closed) return;
    const handlers = subscriptions.get(event.runId);
    if (handlers) {
      for (const h of handlers) h(event);
    }
  }

  function setConnectionState(state: ConnectionState) {
    connectionState = state;
    for (const l of stateListeners) l(state);
  }

  return { source, emit, setConnectionState };
}

runExecutionEventSourceContractTests("InlineAdapter (self-test)", createInlineAdapter);
