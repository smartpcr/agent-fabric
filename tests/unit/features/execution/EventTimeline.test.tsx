import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventTimeline, type NodeExecutionEvent } from "@/features/execution/EventTimeline";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Helper to build a node event. */
function makeNodeEvent(
  overrides: Partial<NodeExecutionEvent> & { type: NodeExecutionEvent["type"] },
): NodeExecutionEvent {
  return {
    runId: "run-1",
    nodeId: "node-A",
    at: Date.now(),
    ...overrides,
  } as NodeExecutionEvent;
}

describe("EventTimeline", () => {
  // ── Empty state ─────────────────────────────────────────────────

  it("shows empty message when no events are provided", () => {
    render(<EventTimeline events={[]} />);
    expect(screen.getByTestId("event-timeline-empty")).toBeInTheDocument();
    expect(screen.getByTestId("event-timeline-empty")).toHaveTextContent(
      "No events recorded for this node.",
    );
  });

  it("does not render the timeline list when empty", () => {
    render(<EventTimeline events={[]} />);
    expect(screen.queryByTestId("event-timeline")).not.toBeInTheDocument();
  });

  // ── Rendering events ────────────────────────────────────────────

  it("renders events in the timeline list", () => {
    const events: NodeExecutionEvent[] = [makeNodeEvent({ type: "node.started", at: 1000 })];
    render(<EventTimeline events={events} />);
    expect(screen.getByTestId("event-timeline")).toBeInTheDocument();
    expect(screen.getAllByTestId("event-timeline-item")).toHaveLength(1);
  });

  it("renders the event type label", () => {
    const events: NodeExecutionEvent[] = [makeNodeEvent({ type: "node.started", at: 1000 })];
    render(<EventTimeline events={events} />);
    expect(screen.getByTestId("event-type")).toHaveTextContent("node.started");
  });

  it("renders the event timestamp", () => {
    // Use a known timestamp: 2026-01-01T12:30:45.123Z
    const ts = new Date(2026, 0, 1, 12, 30, 45, 123).getTime();
    const events: NodeExecutionEvent[] = [makeNodeEvent({ type: "node.started", at: ts })];
    render(<EventTimeline events={events} />);
    expect(screen.getByTestId("event-timestamp")).toHaveTextContent("12:30:45.123");
  });

  // ── Chronological ordering ──────────────────────────────────────

  it("renders events in chronological order by timestamp", () => {
    const events: NodeExecutionEvent[] = [
      makeNodeEvent({ type: "node.succeeded", at: 3000 }),
      makeNodeEvent({ type: "node.started", at: 1000 }),
      makeNodeEvent({ type: "node.failed", at: 2000 }),
    ];
    render(<EventTimeline events={events} />);
    const items = screen.getAllByTestId("event-timeline-item");
    expect(items).toHaveLength(3);

    const types = items.map((item) => within(item).getByTestId("event-type").textContent);
    expect(types).toEqual(["node.started", "node.failed", "node.succeeded"]);
  });

  it("preserves order for events with the same timestamp", () => {
    const events: NodeExecutionEvent[] = [
      makeNodeEvent({ type: "node.started", at: 1000 }),
      makeNodeEvent({ type: "node.succeeded", at: 1000 }),
    ];
    render(<EventTimeline events={events} />);
    const items = screen.getAllByTestId("event-timeline-item");
    const types = items.map((item) => within(item).getByTestId("event-type").textContent);
    // Stable sort — original order preserved
    expect(types).toEqual(["node.started", "node.succeeded"]);
  });

  // ── Payload rendering ───────────────────────────────────────────

  it("renders payload as pretty-printed JSON in a <pre> element", () => {
    const events: NodeExecutionEvent[] = [
      makeNodeEvent({
        type: "node.succeeded",
        at: 1000,
        payload: { result: "ok", durationMs: 42 },
      }),
    ];
    render(<EventTimeline events={events} />);
    const pre = screen.getByTestId("event-payload");
    expect(pre.tagName).toBe("PRE");
    expect(pre.textContent).toContain('"result": "ok"');
    expect(pre.textContent).toContain('"durationMs": 42');
  });

  it("does not render payload block when payload is absent", () => {
    const events: NodeExecutionEvent[] = [makeNodeEvent({ type: "node.started", at: 1000 })];
    render(<EventTimeline events={events} />);
    expect(screen.queryByTestId("event-payload")).not.toBeInTheDocument();
    expect(screen.queryByTestId("event-copy-btn")).not.toBeInTheDocument();
  });

  it("renders multiple events with different payloads", () => {
    const events: NodeExecutionEvent[] = [
      makeNodeEvent({
        type: "node.started",
        at: 1000,
        payload: { iteration: 1 },
      }),
      makeNodeEvent({
        type: "node.failed",
        at: 2000,
        payload: { error: "timeout" },
      }),
    ];
    render(<EventTimeline events={events} />);
    const payloads = screen.getAllByTestId("event-payload");
    expect(payloads).toHaveLength(2);
    expect(payloads[0].textContent).toContain('"iteration": 1');
    expect(payloads[1].textContent).toContain('"error": "timeout"');
  });

  // ── Copy to clipboard ───────────────────────────────────────────

  describe("copy functionality", () => {
    it("renders a copy button for events with payload", () => {
      const events: NodeExecutionEvent[] = [
        makeNodeEvent({
          type: "node.succeeded",
          at: 1000,
          payload: { result: "ok" },
        }),
      ];
      render(<EventTimeline events={events} />);
      const copyBtn = screen.getByTestId("event-copy-btn");
      expect(copyBtn).toBeInTheDocument();
      expect(copyBtn).toHaveTextContent("Copy");
    });

    it("copies payload JSON to clipboard when copy button is clicked", async () => {
      const user = userEvent.setup();
      const onCopy = vi.fn().mockResolvedValue(undefined);
      const events: NodeExecutionEvent[] = [
        makeNodeEvent({
          type: "node.succeeded",
          at: 1000,
          payload: { result: "ok" },
        }),
      ];
      render(<EventTimeline events={events} onCopy={onCopy} />);

      const copyBtn = screen.getByTestId("event-copy-btn");
      await user.click(copyBtn);

      expect(onCopy).toHaveBeenCalledTimes(1);
      const written = onCopy.mock.calls[0][0] as string;
      expect(JSON.parse(written)).toEqual({ result: "ok" });
    });

    it("shows 'Copied!' feedback after clicking copy", async () => {
      const user = userEvent.setup();
      const onCopy = vi.fn().mockResolvedValue(undefined);
      const events: NodeExecutionEvent[] = [
        makeNodeEvent({
          type: "node.succeeded",
          at: 1000,
          payload: { result: "ok" },
        }),
      ];
      render(<EventTimeline events={events} onCopy={onCopy} />);

      const copyBtn = screen.getByTestId("event-copy-btn");
      await user.click(copyBtn);

      expect(copyBtn).toHaveTextContent("Copied!");
    });

    it("copy button has accessible label", () => {
      const events: NodeExecutionEvent[] = [
        makeNodeEvent({
          type: "node.succeeded",
          at: 1000,
          payload: { result: "ok" },
        }),
      ];
      render(<EventTimeline events={events} />);
      const copyBtn = screen.getByTestId("event-copy-btn");
      expect(copyBtn).toHaveAttribute("aria-label", "Copy payload for node.succeeded");
    });

    it("resets 'Copied!' back to 'Copy' after timeout", async () => {
      vi.useFakeTimers();
      const onCopy = vi.fn().mockResolvedValue(undefined);

      const events: NodeExecutionEvent[] = [
        makeNodeEvent({
          type: "node.succeeded",
          at: 1000,
          payload: { result: "ok" },
        }),
      ];
      const { getByTestId } = render(<EventTimeline events={events} onCopy={onCopy} />);

      const copyBtn = getByTestId("event-copy-btn");

      // Simulate the click handler synchronously
      await act(async () => {
        copyBtn.click();
        // Flush the microtask (promise resolution from onCopy)
        await Promise.resolve();
      });

      expect(copyBtn).toHaveTextContent("Copied!");

      // Advance past the 2000ms reset timeout
      act(() => {
        vi.advanceTimersByTime(2100);
      });

      expect(copyBtn).toHaveTextContent("Copy");

      vi.useRealTimers();
    });
  });

  // ── Accessibility ───────────────────────────────────────────────

  it("timeline has aria-label", () => {
    const events: NodeExecutionEvent[] = [makeNodeEvent({ type: "node.started", at: 1000 })];
    render(<EventTimeline events={events} />);
    const timeline = screen.getByTestId("event-timeline");
    expect(timeline).toHaveAttribute("aria-label", "Event timeline");
  });

  it("timeline uses an <ol> element", () => {
    const events: NodeExecutionEvent[] = [makeNodeEvent({ type: "node.started", at: 1000 })];
    render(<EventTimeline events={events} />);
    const timeline = screen.getByTestId("event-timeline");
    expect(timeline.tagName).toBe("OL");
  });
});
