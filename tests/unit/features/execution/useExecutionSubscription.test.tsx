import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";
import { type ReactNode } from "react";
import { useExecutionSubscription } from "@/features/execution/useExecutionSubscription";
import { ExecutionProvider } from "@/providers/ExecutionProvider";
import type { IExecutionEventSource, Unsubscribe } from "@/ports/IExecutionEventSource";
import type { IExecutionCommandSink } from "@/ports/IExecutionCommandSink";
import type { ExecutionEvent } from "@/domain/models/executionEvent";

// ── Helpers ────────────────────────────────────────────────────────────

/** Stub command sink (not exercised in these tests). */
function stubCommandSink(): IExecutionCommandSink {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

/**
 * Create a controllable mock event source.
 *
 * `subscribe` captures the handler for a given `runId` so tests can
 * emit events manually. `unsubscribeSpy` tracks whether the returned
 * unsubscribe function was called.
 */
function createMockEventSource() {
  type Handler = (event: ExecutionEvent) => void;
  const handlers = new Map<string, Handler[]>();
  const unsubscribeSpy = vi.fn();
  const subscribeSpy = vi.fn((runId: string, handler: Handler): Unsubscribe => {
    if (!handlers.has(runId)) {
      handlers.set(runId, []);
    }
    const arr = handlers.get(runId);
    if (arr) arr.push(handler);

    return () => {
      unsubscribeSpy();
      const list = handlers.get(runId);
      if (list) {
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  });

  const eventSource: IExecutionEventSource = {
    subscribe: subscribeSpy,
    close: vi.fn(),
    connectionState$: {
      subscribe: vi.fn(() => vi.fn()),
      current: vi.fn(() => "connected" as const),
    },
  };

  function emit(runId: string, event: ExecutionEvent) {
    const arr = handlers.get(runId);
    if (arr) {
      for (const h of arr) {
        h(event);
      }
    }
  }

  return { eventSource, subscribeSpy, unsubscribeSpy, emit };
}

/** Build a simple execution event for testing. */
function makeEvent(overrides: Partial<ExecutionEvent> = {}): ExecutionEvent {
  return {
    type: "node.started",
    runId: "run-1",
    nodeId: "n1",
    at: Date.now(),
    ...overrides,
  } as ExecutionEvent;
}

// ── Test suite ─────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
});

describe("useExecutionSubscription", () => {
  // ── Subscribe on mount ────────────────────────────────────────────

  it("subscribes to eventSource on mount with the given runId", () => {
    const { eventSource, subscribeSpy } = createMockEventSource();
    const onEvent = vi.fn();

    renderHook(
      () => {
        useExecutionSubscription("run-1", onEvent);
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ExecutionProvider eventSource={eventSource} commandSink={stubCommandSink()}>
            {children}
          </ExecutionProvider>
        ),
      },
    );

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith("run-1", expect.any(Function));
  });

  it("forwards events to onEvent while mounted", () => {
    const { eventSource, emit } = createMockEventSource();
    const onEvent = vi.fn();

    renderHook(
      () => {
        useExecutionSubscription("run-1", onEvent);
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ExecutionProvider eventSource={eventSource} commandSink={stubCommandSink()}>
            {children}
          </ExecutionProvider>
        ),
      },
    );

    const event = makeEvent();
    act(() => {
      emit("run-1", event);
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(event);
  });

  // ── Unsubscribe on unmount ────────────────────────────────────────

  it("calls unsubscribe on unmount", () => {
    const { eventSource, unsubscribeSpy } = createMockEventSource();
    const onEvent = vi.fn();

    const { unmount } = renderHook(
      () => {
        useExecutionSubscription("run-1", onEvent);
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ExecutionProvider eventSource={eventSource} commandSink={stubCommandSink()}>
            {children}
          </ExecutionProvider>
        ),
      },
    );

    expect(unsubscribeSpy).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  // ── Late event dropped ────────────────────────────────────────────

  it("ignores events delivered after unmount (late event dropped)", () => {
    // Build a custom event source where we can invoke the handler after unmount
    let capturedHandler: ((event: ExecutionEvent) => void) | undefined;
    const unsubscribeSpy = vi.fn();

    const eventSource: IExecutionEventSource = {
      subscribe: vi.fn((_runId: string, handler: (event: ExecutionEvent) => void) => {
        capturedHandler = handler;
        return () => {
          unsubscribeSpy();
          // Intentionally do NOT null out capturedHandler — simulates
          // a transport that delivers a late event after cleanup.
        };
      }),
      close: vi.fn(),
      connectionState$: {
        subscribe: vi.fn(() => vi.fn()),
        current: vi.fn(() => "connected" as const),
      },
    };

    const onEvent = vi.fn();

    const { unmount } = renderHook(
      () => {
        useExecutionSubscription("run-1", onEvent);
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ExecutionProvider eventSource={eventSource} commandSink={stubCommandSink()}>
            {children}
          </ExecutionProvider>
        ),
      },
    );

    // Handler was captured on mount
    expect(capturedHandler).toBeDefined();

    unmount();

    // Simulate a late event arriving after unmount
    act(() => {
      if (capturedHandler) {
        capturedHandler(makeEvent({ at: Date.now() + 1000 }));
      }
    });

    // The ref guard must prevent onEvent from being called
    expect(onEvent).not.toHaveBeenCalled();
  });

  // ── Skips subscription when runId is undefined ────────────────────

  it("does not subscribe when runId is undefined", () => {
    const { eventSource, subscribeSpy } = createMockEventSource();
    const onEvent = vi.fn();

    renderHook(
      () => {
        useExecutionSubscription(undefined, onEvent);
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ExecutionProvider eventSource={eventSource} commandSink={stubCommandSink()}>
            {children}
          </ExecutionProvider>
        ),
      },
    );

    expect(subscribeSpy).not.toHaveBeenCalled();
  });

  // ── Re-subscribes when runId changes ──────────────────────────────

  it("re-subscribes when runId changes", () => {
    const { eventSource, subscribeSpy, unsubscribeSpy } = createMockEventSource();
    const onEvent = vi.fn();

    const { rerender } = renderHook(
      ({ runId }: { runId: string }) => {
        useExecutionSubscription(runId, onEvent);
      },
      {
        initialProps: { runId: "run-1" },
        wrapper: ({ children }: { children: ReactNode }) => (
          <ExecutionProvider eventSource={eventSource} commandSink={stubCommandSink()}>
            {children}
          </ExecutionProvider>
        ),
      },
    );

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith("run-1", expect.any(Function));

    rerender({ runId: "run-2" });

    // Previous subscription should be cleaned up
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    // New subscription established
    expect(subscribeSpy).toHaveBeenCalledTimes(2);
    expect(subscribeSpy).toHaveBeenLastCalledWith("run-2", expect.any(Function));
  });

  // ── Does not re-subscribe when only onEvent changes ───────────────

  it("does not re-subscribe when only onEvent callback changes", () => {
    const { eventSource, subscribeSpy, emit } = createMockEventSource();
    const onEvent1 = vi.fn();
    const onEvent2 = vi.fn();

    const { rerender } = renderHook(
      ({ onEvent }: { onEvent: (e: ExecutionEvent) => void }) => {
        useExecutionSubscription("run-1", onEvent);
      },
      {
        initialProps: { onEvent: onEvent1 },
        wrapper: ({ children }: { children: ReactNode }) => (
          <ExecutionProvider eventSource={eventSource} commandSink={stubCommandSink()}>
            {children}
          </ExecutionProvider>
        ),
      },
    );

    // Only one subscription
    expect(subscribeSpy).toHaveBeenCalledTimes(1);

    // Swap the callback
    rerender({ onEvent: onEvent2 });

    // Still only one subscription (no re-subscribe)
    expect(subscribeSpy).toHaveBeenCalledTimes(1);

    // New callback should receive events (via ref)
    const event = makeEvent();
    act(() => {
      emit("run-1", event);
    });

    expect(onEvent1).not.toHaveBeenCalled();
    expect(onEvent2).toHaveBeenCalledTimes(1);
    expect(onEvent2).toHaveBeenCalledWith(event);
  });

  // ── Multiple events forwarded ─────────────────────────────────────

  it("forwards multiple events in order", () => {
    const { eventSource, emit } = createMockEventSource();
    const onEvent = vi.fn();

    renderHook(
      () => {
        useExecutionSubscription("run-1", onEvent);
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ExecutionProvider eventSource={eventSource} commandSink={stubCommandSink()}>
            {children}
          </ExecutionProvider>
        ),
      },
    );

    const events = [
      makeEvent({ type: "node.started", nodeId: "n1", at: 100 }),
      makeEvent({ type: "node.succeeded", nodeId: "n1", at: 200 }),
    ] as ExecutionEvent[];

    act(() => {
      for (const e of events) {
        emit("run-1", e);
      }
    });

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenNthCalledWith(1, events[0]);
    expect(onEvent).toHaveBeenNthCalledWith(2, events[1]);
  });

  // ── Throws outside provider ───────────────────────────────────────

  it("throws when used outside ExecutionProvider", () => {
    const onEvent = vi.fn();

    expect(() => {
      renderHook(() => {
        useExecutionSubscription("run-1", onEvent);
      });
    }).toThrow("useExecutionEventSource used outside of provider");
  });
});
