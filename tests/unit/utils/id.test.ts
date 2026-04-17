import { describe, it, expect } from "vitest";
import { newId } from "@/utils/id";

describe("newId", () => {
  it("returns a string prefixed with the given prefix", () => {
    const id = newId("test");
    expect(id).toMatch(/^test_/);
  });

  it("generates unique IDs across 10,000 calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      ids.add(newId("n"));
    }
    expect(ids.size).toBe(10_000);
  });

  it("works with empty prefix", () => {
    const id = newId("");
    expect(id).toMatch(/^_/);
  });
});
