import { describe, it, expect } from "vitest";
import { computeHandlePositions } from "@/features/nodes/ports/handleLayout";

function at<T>(arr: readonly T[], index: number): T {
  const value = arr[index];
  if (value === undefined) throw new Error(`Index ${String(index)} out of bounds`);
  return value;
}

describe("computeHandlePositions", () => {
  it("returns empty array for count 0", () => {
    const result = computeHandlePositions({ count: 0, edge: "top" });
    expect(result).toEqual([]);
  });

  it("returns empty array for negative count", () => {
    const result = computeHandlePositions({ count: -1, edge: "bottom" });
    expect(result).toEqual([]);
  });

  it("places 1 port at 50%", () => {
    const result = computeHandlePositions({ count: 1, edge: "top" });
    expect(result).toHaveLength(1);
    expect(at(result, 0).offset).toBeCloseTo(0.5);
    expect(at(result, 0).index).toBe(0);
    expect(at(result, 0).edge).toBe("top");
  });

  it("places 2 ports at ~33% and ~67%", () => {
    const result = computeHandlePositions({ count: 2, edge: "bottom" });
    expect(result).toHaveLength(2);
    expect(at(result, 0).offset).toBeCloseTo(1 / 3);
    expect(at(result, 1).offset).toBeCloseTo(2 / 3);
  });

  it("distributes 5 ports evenly", () => {
    const result = computeHandlePositions({ count: 5, edge: "left" });
    expect(result).toHaveLength(5);

    // Positions at k/6 for k = 1..5
    const expected = [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6];
    for (let i = 0; i < 5; i++) {
      expect(at(result, i).offset).toBeCloseTo(at(expected, i));
      expect(at(result, i).index).toBe(i);
      expect(at(result, i).edge).toBe("left");
    }
  });

  it("respects custom padding", () => {
    const result = computeHandlePositions({
      count: 3,
      edge: "right",
      padding: 0.2,
    });
    expect(result).toHaveLength(3);
    // Positions at 1/4=0.25, 2/4=0.5, 3/4=0.75 — all within [0.2, 0.8]
    expect(at(result, 0).offset).toBeCloseTo(0.25);
    expect(at(result, 1).offset).toBeCloseTo(0.5);
    expect(at(result, 2).offset).toBeCloseTo(0.75);
  });

  it("clamps offsets to [padding, 1 - padding]", () => {
    // 5 handles with padding=0.25: raw positions 1/6≈0.167, ..., 5/6≈0.833
    // First clamped up to 0.25, last clamped down to 0.75
    const result = computeHandlePositions({
      count: 5,
      edge: "top",
      padding: 0.25,
    });
    for (const pos of result) {
      expect(pos.offset).toBeGreaterThanOrEqual(0.25);
      expect(pos.offset).toBeLessThanOrEqual(0.75);
    }
    // First and last should be clamped
    expect(at(result, 0).offset).toBeCloseTo(0.25);
    expect(at(result, 4).offset).toBeCloseTo(0.75);
  });

  it("handles padding of 0 (no padding)", () => {
    const result = computeHandlePositions({
      count: 3,
      edge: "top",
      padding: 0,
    });
    // Positions at 1/4=0.25, 2/4=0.5, 3/4=0.75
    expect(at(result, 0).offset).toBeCloseTo(0.25);
    expect(at(result, 1).offset).toBeCloseTo(0.5);
    expect(at(result, 2).offset).toBeCloseTo(0.75);
  });

  it("clamps padding above 0.5 to 0.5", () => {
    const result = computeHandlePositions({
      count: 1,
      edge: "bottom",
      padding: 0.8,
    });
    // Single port at 1/2 = 0.5, padding clamped to 0.5, offset = max(0.5, min(0.5, 0.5)) = 0.5
    expect(at(result, 0).offset).toBeCloseTo(0.5);
  });

  it("distributes 10 ports evenly within padded range", () => {
    const result = computeHandlePositions({ count: 10, edge: "right" });
    expect(result).toHaveLength(10);

    // Positions at k/11 for k=1..10, clamped to [0.1, 0.9]
    for (let i = 0; i < 10; i++) {
      const raw = (i + 1) / 11;
      const expected = Math.max(0.1, Math.min(0.9, raw));
      expect(at(result, i).offset).toBeCloseTo(expected);
      expect(at(result, i).index).toBe(i);
    }
  });

  it("preserves edge field on all returned positions", () => {
    for (const edge of ["top", "bottom", "left", "right"] as const) {
      const result = computeHandlePositions({ count: 3, edge });
      for (const pos of result) {
        expect(pos.edge).toBe(edge);
      }
    }
  });

  it("returns monotonically increasing offsets", () => {
    const result = computeHandlePositions({ count: 7, edge: "top" });
    for (let i = 1; i < result.length; i++) {
      expect(at(result, i).offset).toBeGreaterThanOrEqual(at(result, i - 1).offset);
    }
  });
});
