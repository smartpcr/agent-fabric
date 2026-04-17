import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWorkflowStore } from "@/store/hooks";

describe("useWorkflowStore", () => {
  it("returns the full store state without a selector", () => {
    const { result } = renderHook(() => useWorkflowStore());
    expect(result.current).toHaveProperty("nodes");
    expect(result.current).toHaveProperty("zoom");
    expect(result.current).toHaveProperty("executionStatus");
  });

  it("returns a selected slice with a selector", () => {
    const { result } = renderHook(() => useWorkflowStore((s) => s.zoom));
    expect(result.current).toBe(1);
  });
});
