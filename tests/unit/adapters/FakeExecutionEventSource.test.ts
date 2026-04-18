import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { FakeExecutionEventSource } from "@/adapters/FakeExecutionEventSource";
import { runExecutionEventSourceContractTests } from "../ports/IExecutionEventSource.contract.test";
import type { ExecutionEvent } from "@/domain/models/executionEvent";

// ─── Contract tests ──────────────────────────────────────────────────

runExecutionEventSourceContractTests(
  "FakeExecutionEventSource",
  () => {
    const source = new FakeExecutionEventSource();
    return {
      source,
      emit: (event: ExecutionEvent) => {
        source.emit(event);
      },
      setConnectionState: (state) => {
        source.setConnectionState(state);
      },
    };
  },
  { supportsConnectionStateControl: true },
);

// ─── FakeExecutionEventSource-specific tests ─────────────────────────

const NOW = Date.now();
const RUN_ID = "run-1";

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

describe("FakeExecutionEventSource — adapter-specific", () => {
  let source: FakeExecutionEventSource;

  beforeEach(() => {
    source = new FakeExecutionEventSource();
  });

  afterEach(() => {
    source.close();
  });

  describe("emit()", () => {
    it("delivers to handlers subscribed for that runId", () => {
      const handler = vi.fn();
      source.subscribe(RUN_ID, handler);

      const event = makeEvent("node.started", RUN_ID);
      source.emit(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it("does not deliver to handlers for other runIds", () => {
      const handler = vi.fn();
      source.subscribe("run-other", handler);

      source.emit(makeEvent("node.started", RUN_ID));

      expect(handler).not.toHaveBeenCalled();
    });

    it("delivers to multiple handlers for the same runId", () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      const h3 = vi.fn();
      source.subscribe(RUN_ID, h1);
      source.subscribe(RUN_ID, h2);
      source.subscribe(RUN_ID, h3);

      source.emit(makeEvent("run.started", RUN_ID));

      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
      expect(h3).toHaveBeenCalledTimes(1);
    });

    it("does nothing after close()", () => {
      const handler = vi.fn();
      source.subscribe(RUN_ID, handler);
      source.close();

      source.emit(makeEvent("node.started", RUN_ID));

      expect(handler).not.toHaveBeenCalled();
    });

    it("delivers all 10 event types correctly", () => {
      const handler = vi.fn();
      source.subscribe(RUN_ID, handler);

      source.emit(makeEvent("node.started", RUN_ID));
      source.emit(makeEvent("node.succeeded", RUN_ID));
      source.emit(makeEvent("node.failed", RUN_ID));
      source.emit(makeEvent("node.skipped", RUN_ID));
      source.emit(makeEvent("edge.activated", RUN_ID));
      source.emit(makeEvent("edge.taken", RUN_ID));
      source.emit(makeEvent("run.started", RUN_ID));
      source.emit(makeEvent("run.completed", RUN_ID));
      source.emit(makeEvent("run.failed", RUN_ID));
      source.emit(makeEvent("run.cancelled", RUN_ID));

      expect(handler).toHaveBeenCalledTimes(10);
    });
  });

  describe("setConnectionState()", () => {
    it("updates current() immediately", () => {
      expect(source.connectionState$.current()).toBe("connected");

      source.setConnectionState("reconnecting");
      expect(source.connectionState$.current()).toBe("reconnecting");

      source.setConnectionState("disconnected");
      expect(source.connectionState$.current()).toBe("disconnected");

      source.setConnectionState("connected");
      expect(source.connectionState$.current()).toBe("connected");
    });

    it("notifies all connection state listeners", () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      source.connectionState$.subscribe(l1);
      source.connectionState$.subscribe(l2);

      source.setConnectionState("reconnecting");

      expect(l1).toHaveBeenCalledWith("reconnecting");
      expect(l2).toHaveBeenCalledWith("reconnecting");
    });

    it("does not notify unsubscribed listeners", () => {
      const listener = vi.fn();
      const unsub = source.connectionState$.subscribe(listener);

      unsub();
      source.setConnectionState("disconnected");

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("instance is a class", () => {
    it("can be constructed with new", () => {
      const s = new FakeExecutionEventSource();
      expect(s).toBeInstanceOf(FakeExecutionEventSource);
      s.close();
    });

    it("initial connection state is 'connected'", () => {
      expect(source.connectionState$.current()).toBe("connected");
    });
  });
});
