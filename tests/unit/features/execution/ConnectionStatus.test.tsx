import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { ConnectionStatus } from "@/features/execution/ConnectionStatus";
import { ExecutionProvider } from "@/providers/ExecutionProvider";
import type {
  IExecutionEventSource,
  ConnectionState,
  ConnectionStateListener,
  Unsubscribe,
} from "@/ports/IExecutionEventSource";
import type { IExecutionCommandSink } from "@/ports/IExecutionCommandSink";

// ── Helpers ────────────────────────────────────────────────────────────

function stubCommandSink(): IExecutionCommandSink {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

/**
 * Controllable event source whose `connectionState$` can be driven
 * from tests via `setConnectionState()`.
 */
function createMockEventSource(initialState: ConnectionState = "connected") {
  let currentState: ConnectionState = initialState;
  const listeners: ConnectionStateListener[] = [];
  const unsubscribeSpy = vi.fn();
  const connectionSubscribeSpy = vi.fn((listener: ConnectionStateListener): Unsubscribe => {
    listeners.push(listener);
    return () => {
      unsubscribeSpy();
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  });

  const eventSource: IExecutionEventSource = {
    subscribe: vi.fn(() => vi.fn()),
    close: vi.fn(),
    connectionState$: {
      subscribe: connectionSubscribeSpy,
      current: vi.fn(() => currentState),
    },
  };

  function setConnectionState(next: ConnectionState) {
    currentState = next;
    for (const l of listeners) {
      l(next);
    }
  }

  return { eventSource, setConnectionState, unsubscribeSpy, connectionSubscribeSpy };
}

function renderStatus(eventSource: IExecutionEventSource) {
  return render(
    <ExecutionProvider eventSource={eventSource} commandSink={stubCommandSink()}>
      <ConnectionStatus />
    </ExecutionProvider>,
  );
}

// ── Test suite ─────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
});

describe("ConnectionStatus", () => {
  // ── Initial rendering ─────────────────────────────────────────────

  it("renders 'Connected' badge when initial state is connected", () => {
    const { eventSource } = createMockEventSource("connected");
    renderStatus(eventSource);

    const badge = screen.getByTestId("connection-status");
    expect(badge).toHaveTextContent("Connected");
    expect(badge).toHaveClass("connection-status--connected");
  });

  it("renders 'Reconnecting' badge when initial state is reconnecting", () => {
    const { eventSource } = createMockEventSource("reconnecting");
    renderStatus(eventSource);

    const badge = screen.getByTestId("connection-status");
    expect(badge).toHaveTextContent("Reconnecting");
    expect(badge).toHaveClass("connection-status--reconnecting");
  });

  it("renders 'Disconnected' badge when initial state is disconnected", () => {
    const { eventSource } = createMockEventSource("disconnected");
    renderStatus(eventSource);

    const badge = screen.getByTestId("connection-status");
    expect(badge).toHaveTextContent("Disconnected");
    expect(badge).toHaveClass("connection-status--disconnected");
  });

  // ── State transitions ─────────────────────────────────────────────

  it("updates badge when state transitions from connected to reconnecting", () => {
    const { eventSource, setConnectionState } = createMockEventSource("connected");
    renderStatus(eventSource);

    expect(screen.getByTestId("connection-status")).toHaveTextContent("Connected");

    act(() => {
      setConnectionState("reconnecting");
    });

    const badge = screen.getByTestId("connection-status");
    expect(badge).toHaveTextContent("Reconnecting");
    expect(badge).toHaveClass("connection-status--reconnecting");
  });

  it("updates badge when state transitions from reconnecting to connected", () => {
    const { eventSource, setConnectionState } = createMockEventSource("reconnecting");
    renderStatus(eventSource);

    expect(screen.getByTestId("connection-status")).toHaveTextContent("Reconnecting");

    act(() => {
      setConnectionState("connected");
    });

    const badge = screen.getByTestId("connection-status");
    expect(badge).toHaveTextContent("Connected");
    expect(badge).toHaveClass("connection-status--connected");
  });

  it("updates badge when state transitions from connected to disconnected", () => {
    const { eventSource, setConnectionState } = createMockEventSource("connected");
    renderStatus(eventSource);

    act(() => {
      setConnectionState("disconnected");
    });

    const badge = screen.getByTestId("connection-status");
    expect(badge).toHaveTextContent("Disconnected");
    expect(badge).toHaveClass("connection-status--disconnected");
  });

  it("updates badge when state transitions from disconnected to reconnecting", () => {
    const { eventSource, setConnectionState } = createMockEventSource("disconnected");
    renderStatus(eventSource);

    act(() => {
      setConnectionState("reconnecting");
    });

    const badge = screen.getByTestId("connection-status");
    expect(badge).toHaveTextContent("Reconnecting");
    expect(badge).toHaveClass("connection-status--reconnecting");
  });

  it("handles multiple rapid state transitions", () => {
    const { eventSource, setConnectionState } = createMockEventSource("connected");
    renderStatus(eventSource);

    act(() => {
      setConnectionState("reconnecting");
      setConnectionState("disconnected");
      setConnectionState("reconnecting");
      setConnectionState("connected");
    });

    const badge = screen.getByTestId("connection-status");
    expect(badge).toHaveTextContent("Connected");
    expect(badge).toHaveClass("connection-status--connected");
  });

  // ── Subscription lifecycle ────────────────────────────────────────

  it("subscribes to connectionState$ on mount", () => {
    const { eventSource, connectionSubscribeSpy } = createMockEventSource("connected");
    renderStatus(eventSource);

    expect(connectionSubscribeSpy).toHaveBeenCalledTimes(1);
    expect(connectionSubscribeSpy).toHaveBeenCalledWith(expect.any(Function));
  });

  it("unsubscribes from connectionState$ on unmount", () => {
    const { eventSource, unsubscribeSpy } = createMockEventSource("connected");
    const { unmount } = renderStatus(eventSource);

    expect(unsubscribeSpy).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  // ── Accessibility ─────────────────────────────────────────────────

  it("has role='status' for live region announcements", () => {
    const { eventSource } = createMockEventSource("connected");
    renderStatus(eventSource);

    expect(screen.getByTestId("connection-status")).toHaveAttribute("role", "status");
  });

  it("has accessible aria-label reflecting current state", () => {
    const { eventSource, setConnectionState } = createMockEventSource("connected");
    renderStatus(eventSource);

    expect(screen.getByTestId("connection-status")).toHaveAttribute(
      "aria-label",
      "Connection status: Connected",
    );

    act(() => {
      setConnectionState("disconnected");
    });

    expect(screen.getByTestId("connection-status")).toHaveAttribute(
      "aria-label",
      "Connection status: Disconnected",
    );
  });

  // ── Provider guard ────────────────────────────────────────────────

  it("throws when used outside ExecutionProvider", () => {
    expect(() => {
      render(<ConnectionStatus />);
    }).toThrow("useExecutionEventSource used outside of provider");
  });
});
