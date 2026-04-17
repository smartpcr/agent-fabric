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

  it("places 2 ports at padding and 1-padding with default padding", () => {
    const result = computeHandlePositions({ count: 2, edge: "bottom" });
    expect(result).toHaveLength(2);
    expect(at(result, 0).offset).toBeCloseTo(0.1);
    expect(at(result, 1).offset).toBeCloseTo(0.9);
  });

  it("places 2 ports at ~33% and ~67% with 1/3 padding", () => {
    const result = computeHandlePositions({
      count: 2,
      edge: "bottom",
      padding: 1 / 3,
    });
    expect(result).toHaveLength(2);
    expect(at(result, 0).offset).toBeCloseTo(1 / 3);
    expect(at(result, 1).offset).toBeCloseTo(2 / 3);
  });

  it("distributes 5 ports evenly", () => {
    const result = computeHandlePositions({ count: 5, edge: "left" });
    expect(result).toHaveLength(5);

    // With default padding 0.1, range is [0.1, 0.9], step = 0.8/4 = 0.2
    const expected = [0.1, 0.3, 0.5, 0.7, 0.9];
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
    // Range is [0.2, 0.8], step = 0.6/2 = 0.3
    expect(at(result, 0).offset).toBeCloseTo(0.2);
    expect(at(result, 1).offset).toBeCloseTo(0.5);
    expect(at(result, 2).offset).toBeCloseTo(0.8);
  });

  it("clamps offsets to [padding, 1 - padding]", () => {
    const result = computeHandlePositions({
      count: 3,
      edge: "top",
      padding: 0.2,
    });
    for (const pos of result) {
      expect(pos.offset).toBeGreaterThanOrEqual(0.2);
      expect(pos.offset).toBeLessThanOrEqual(0.8);
    }
  });

  it("handles padding of 0 (no padding)", () => {
    const result = computeHandlePositions({
      count: 3,
      edge: "top",
      padding: 0,
    });
    expect(at(result, 0).offset).toBeCloseTo(0);
    expect(at(result, 1).offset).toBeCloseTo(0.5);
    expect(at(result, 2).offset).toBeCloseTo(1);
  });

  it("clamps padding above 0.5 to 0.5", () => {
    const result = computeHandlePositions({
      count: 1,
      edge: "bottom",
      padding: 0.8,
    });
    // Even with extreme padding, single port is at 50%
    expect(at(result, 0).offset).toBeCloseTo(0.5);
  });

  it("distributes 10 ports evenly within padded range", () => {
    const result = computeHandlePositions({ count: 10, edge: "right" });
    expect(result).toHaveLength(10);

    // Step = 0.8/9 ≈ 0.0889
    for (let i = 0; i < 10; i++) {
      const expectedOffset = 0.1 + (0.8 / 9) * i;
      expect(at(result, i).offset).toBeCloseTo(expectedOffset);
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
      expect(at(result, i).offset).toBeGreaterThan(at(result, i - 1).offset);
    }
  });
});
