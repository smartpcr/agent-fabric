import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedCommit } from "@/features/property-grid/useDebouncedCommit";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedCommit", () => {
  describe("basic debounce behaviour", () => {
    it("does not call onCommit immediately when a value is staged", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.stage("hello");
      });

      expect(onCommit).not.toHaveBeenCalled();
    });

    it("calls onCommit after the default 300ms delay", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.stage("hello");
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith("hello");
    });

    it("does not call onCommit before the delay elapses", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.stage("hello");
      });

      act(() => {
        vi.advanceTimersByTime(299);
      });

      expect(onCommit).not.toHaveBeenCalled();
    });

    it("respects a custom delay", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit, delay: 500 }));

      act(() => {
        result.current.stage("hello");
      });

      act(() => {
        vi.advanceTimersByTime(499);
      });
      expect(onCommit).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("rapid edits coalesced", () => {
    it("resets the timer on each new stage call", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.stage("a");
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      act(() => {
        result.current.stage("b");
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Only 400ms total, but timer was reset at 200ms
      expect(onCommit).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith("b");
    });

    it("coalesces many rapid edits into a single commit", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.stage("a");
        result.current.stage("b");
        result.current.stage("c");
        result.current.stage("d");
        result.current.stage("e");
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith("e");
    });

    it("commits the latest value after a burst of edits with gaps", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      // First burst
      act(() => {
        result.current.stage("first");
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        result.current.stage("second");
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        result.current.stage("third");
      });

      // Wait for commit
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith("third");
    });
  });

  describe("unmount cancels pending commit", () => {
    it("does not call onCommit when component unmounts with pending value", () => {
      const onCommit = vi.fn();
      const { result, unmount } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.stage("hello");
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onCommit).not.toHaveBeenCalled();
    });

    it("does not call onCommit on unmount even if timer nearly expired", () => {
      const onCommit = vi.fn();
      const { result, unmount } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.stage("hello");
      });

      act(() => {
        vi.advanceTimersByTime(299);
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  describe("flush", () => {
    it("immediately commits the latest staged value", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.stage("hello");
      });

      act(() => {
        result.current.flush();
      });

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith("hello");
    });

    it("clears the pending timer when flushed", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.stage("hello");
      });

      act(() => {
        result.current.flush();
      });

      // Timer should be cleared — no double commit
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it("does nothing when there is no pending value", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.flush();
      });

      expect(onCommit).not.toHaveBeenCalled();
    });

    it("does not fire after value was already committed by timer", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.stage("hello");
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onCommit).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.flush();
      });

      expect(onCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancel", () => {
    it("cancels the pending commit", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.stage("hello");
      });

      act(() => {
        result.current.cancel();
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onCommit).not.toHaveBeenCalled();
    });

    it("allows staging a new value after cancel", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      act(() => {
        result.current.stage("first");
      });

      act(() => {
        result.current.cancel();
      });

      act(() => {
        result.current.stage("second");
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith("second");
    });
  });

  describe("onCommit callback freshness", () => {
    it("uses the latest onCommit callback when the timer fires", () => {
      const onCommit1 = vi.fn();
      const onCommit2 = vi.fn();

      const { result, rerender } = renderHook(({ onCommit }) => useDebouncedCommit({ onCommit }), {
        initialProps: { onCommit: onCommit1 },
      });

      act(() => {
        result.current.stage("hello");
      });

      // Swap the callback before timer fires
      rerender({ onCommit: onCommit2 });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onCommit1).not.toHaveBeenCalled();
      expect(onCommit2).toHaveBeenCalledWith("hello");
    });
  });

  describe("object values", () => {
    it("commits object values correctly", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() =>
        useDebouncedCommit<Record<string, unknown>>({ onCommit }),
      );

      act(() => {
        result.current.stage({ name: "Alice", age: 30 });
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onCommit).toHaveBeenCalledWith({ name: "Alice", age: 30 });
    });

    it("coalesces object edits to the latest", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() =>
        useDebouncedCommit<Record<string, unknown>>({ onCommit }),
      );

      act(() => {
        result.current.stage({ name: "Alice" });
        result.current.stage({ name: "Bob" });
        result.current.stage({ name: "Charlie" });
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith({ name: "Charlie" });
    });
  });

  describe("multiple commit cycles", () => {
    it("supports sequential stage-commit cycles", () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedCommit({ onCommit }));

      // First cycle
      act(() => {
        result.current.stage("first");
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith("first");

      // Second cycle
      act(() => {
        result.current.stage("second");
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onCommit).toHaveBeenCalledTimes(2);
      expect(onCommit).toHaveBeenLastCalledWith("second");
    });
  });
});
