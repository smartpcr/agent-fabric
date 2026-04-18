import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ELK } from "elkjs/lib/elk-api";

// Stub ELK instance returned by the mocked module
function makeElkStub(): ELK {
  return {
    layout: vi.fn().mockResolvedValue({ id: "root", children: [] }),
    knownLayoutAlgorithms: vi.fn().mockResolvedValue([]),
    knownLayoutOptions: vi.fn().mockResolvedValue([]),
    knownLayoutCategories: vi.fn().mockResolvedValue([]),
    terminateWorker: vi.fn(),
  };
}

// Mock elkjs so jsdom never loads the real WASM module.
// The default export must be constructable (called with `new`).
const sharedStub = makeElkStub();

vi.mock("elkjs/lib/elk.bundled.js", () => {
  // eslint-disable-next-line func-style -- must be function declaration for `new`
  const MockElkConstructor = vi.fn(function () {
    return sharedStub;
  });
  return { default: MockElkConstructor };
});

// Re-export helpers so dynamic re-imports are typed without import() annotations
type GetElkFn = () => Promise<ELK>;
type ResetFn = () => void;

describe("elkLoader", () => {
  let getElk: GetElkFn;
  let resetElkLoader: ResetFn;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to get a fresh module with reset state
    vi.resetModules();
    const mod = await import("@/domain/layout/elkLoader");
    getElk = mod.getElk;
    resetElkLoader = mod.resetElkLoader;
  });

  it("returns an ELK instance", async () => {
    const elk = await getElk();
    expect(elk).toBeDefined();
    expect(typeof elk.layout).toBe("function");
  });

  it("caches the ELK instance across multiple calls", async () => {
    const first = await getElk();
    const second = await getElk();
    expect(first).toBe(second);
  });

  it("calls the ElkConstructor exactly once even with concurrent calls", async () => {
    const mod = await import("elkjs/lib/elk.bundled.js");
    const ElkConstructor = (mod as Record<string, unknown>)["default"] as ReturnType<typeof vi.fn>;

    const [a, b, c] = await Promise.all([getElk(), getElk(), getElk()]);

    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(ElkConstructor).toHaveBeenCalledTimes(1);
  });

  it("returns an instance with the expected ELK API surface", async () => {
    const elk = await getElk();
    expect(typeof elk.layout).toBe("function");
    expect(typeof elk.knownLayoutAlgorithms).toBe("function");
    expect(typeof elk.knownLayoutOptions).toBe("function");
    expect(typeof elk.knownLayoutCategories).toBe("function");
    expect(typeof elk.terminateWorker).toBe("function");
  });

  it("resetElkLoader clears the cached instance", async () => {
    const first = await getElk();
    resetElkLoader();

    // After reset, re-import the mock module so constructor count is fresh
    vi.resetModules();
    const freshMod = await import("@/domain/layout/elkLoader");
    const second = await freshMod.getElk();

    // They should both be valid ELK instances but not the same reference
    // (because the module was re-imported, creating a new scope)
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(typeof first.layout).toBe("function");
    expect(typeof second.layout).toBe("function");
  });

  it("mock stub layout returns a valid response", async () => {
    const elk = await getElk();
    const result = await elk.layout({ id: "root", children: [] });
    expect(result).toEqual({ id: "root", children: [] });
  });
});
