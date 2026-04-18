import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, renderHook } from "@testing-library/react";
import { AnnouncerProvider } from "@/providers/AnnouncerProvider";
import { useAnnounce } from "@/hooks/useAnnounce";

// ── Helper: consumer component that triggers announce ────────────────

function AnnounceButton({ message }: { message: string }) {
  const { announce } = useAnnounce();
  return (
    <button
      type="button"
      onClick={() => {
        announce(message);
      }}
    >
      Announce
    </button>
  );
}

// ── Tests ────────────────────────────────────────────────────────────

describe("AnnouncerProvider + useAnnounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("renders an aria-live region", () => {
    render(
      <AnnouncerProvider>
        <div>child</div>
      </AnnouncerProvider>,
    );

    const region = screen.getByTestId("announcer-live-region");
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveAttribute("role", "status");
  });

  it("live region is initially empty", () => {
    render(
      <AnnouncerProvider>
        <div />
      </AnnouncerProvider>,
    );

    const region = screen.getByTestId("announcer-live-region");
    expect(region).toHaveTextContent("");
  });

  it("announce() displays message in the live region", () => {
    render(
      <AnnouncerProvider>
        <AnnounceButton message="Node selected" />
      </AnnouncerProvider>,
    );

    act(() => {
      screen.getByText("Announce").click();
    });

    // The 0 ms setTimeout inside announce — advance past it
    act(() => {
      vi.advanceTimersByTime(1);
    });

    const region = screen.getByTestId("announcer-live-region");
    expect(region).toHaveTextContent("Node selected");
  });

  it("message is cleared after 3 seconds", () => {
    render(
      <AnnouncerProvider>
        <AnnounceButton message="Connection added" />
      </AnnouncerProvider>,
    );

    act(() => {
      screen.getByText("Announce").click();
    });

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId("announcer-live-region")).toHaveTextContent("Connection added");

    // Advance past the 3 s clear delay
    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByTestId("announcer-live-region")).toHaveTextContent("");
  });

  it("rapid announcements reset the 3 s clear timer", () => {
    render(
      <AnnouncerProvider>
        <AnnounceButton message="First" />
      </AnnouncerProvider>,
    );

    // First announcement
    act(() => {
      screen.getByText("Announce").click();
    });
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId("announcer-live-region")).toHaveTextContent("First");

    // Advance 2 s (not yet cleared)
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByTestId("announcer-live-region")).toHaveTextContent("First");

    // Second announcement resets the timer
    act(() => {
      screen.getByText("Announce").click();
    });
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // The 3 s timer resets; after 2 more seconds the message is still present
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByTestId("announcer-live-region")).toHaveTextContent("First");

    // After the full 3 s from the second announce, it clears
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByTestId("announcer-live-region")).toHaveTextContent("");
  });

  it("consecutive different messages update the live region", () => {
    // Two buttons with different messages
    function TwoButtons() {
      const { announce } = useAnnounce();
      return (
        <>
          <button
            type="button"
            onClick={() => {
              announce("First msg");
            }}
          >
            First
          </button>
          <button
            type="button"
            onClick={() => {
              announce("Second msg");
            }}
          >
            Second
          </button>
        </>
      );
    }

    render(
      <AnnouncerProvider>
        <TwoButtons />
      </AnnouncerProvider>,
    );

    act(() => {
      screen.getByText("First").click();
    });
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("announcer-live-region")).toHaveTextContent("First msg");

    act(() => {
      screen.getByText("Second").click();
    });
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("announcer-live-region")).toHaveTextContent("Second msg");
  });

  it("useAnnounce throws when used outside AnnouncerProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderHook(() => useAnnounce())).toThrow(
      "useAnnounce used outside of AnnouncerProvider",
    );

    spy.mockRestore();
  });

  it("announce returns a stable function identity across renders", () => {
    const refs: Array<(msg: string) => void> = [];

    function Collector() {
      const { announce } = useAnnounce();
      refs.push(announce);
      return null;
    }

    const { rerender } = render(
      <AnnouncerProvider>
        <Collector />
      </AnnouncerProvider>,
    );

    rerender(
      <AnnouncerProvider>
        <Collector />
      </AnnouncerProvider>,
    );

    expect(refs).toHaveLength(2);
    expect(refs[0]).toBe(refs[1]);
  });
});
