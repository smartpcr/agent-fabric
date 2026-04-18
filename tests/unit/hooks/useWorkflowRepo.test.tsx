import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { IWorkflowRepository } from "@/ports/IWorkflowRepository";
import type { WorkflowGraph } from "@/domain/models/graph";
import { RepositoryProvider } from "@/providers/RepositoryProvider";
import { useWorkflowRepo } from "@/hooks/useWorkflowRepo";
import { ok, err } from "@/domain/result";

// ─── Helpers ─────────────────────────────────────────────────────────

function makeGraph(overrides: Partial<WorkflowGraph> = {}): WorkflowGraph {
  return {
    schemaVersion: 1,
    id: "graph-1",
    name: "Test Graph",
    nodes: [],
    edges: [],
    ...overrides,
  };
}

function stubRepo(overrides: Partial<IWorkflowRepository> = {}): IWorkflowRepository {
  return {
    get: vi.fn().mockResolvedValue(ok({ graph: makeGraph(), etag: '"v1"' })),
    save: vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v2"' })),
    create: vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v1"' })),
    list: vi.fn().mockResolvedValue(ok([])),
    ...overrides,
  };
}

function renderWithRepo(repo: IWorkflowRepository) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repository={repo}>{children}</RepositoryProvider>
  );
  return renderHook(() => useWorkflowRepo(), { wrapper });
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("useWorkflowRepo", () => {
  // ── Provider guard ────────────────────────────────────────────────

  it("throws when used outside of RepositoryProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useWorkflowRepo())).toThrow(
      "useWorkflowRepo used outside of provider",
    );
    spy.mockRestore();
  });

  // ── Return shape ──────────────────────────────────────────────────

  it("returns an object with load, save, create, and list", () => {
    const { result } = renderWithRepo(stubRepo());
    expect(typeof result.current.load).toBe("function");
    expect(typeof result.current.save).toBe("function");
    expect(typeof result.current.create).toBe("function");
    expect(typeof result.current.list).toBe("function");
  });

  // ── load() ────────────────────────────────────────────────────────

  describe("load()", () => {
    it("delegates to repo.get() and returns success Result", async () => {
      const graph = makeGraph({ id: "w-1", name: "Loaded" });
      const getMock = vi.fn().mockResolvedValue(ok({ graph, etag: '"v5"' }));
      const repo = stubRepo({ get: getMock });
      const { result } = renderWithRepo(repo);

      const r = await result.current.load("w-1");

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.graph).toEqual(graph);
        expect(r.value.etag).toBe('"v5"');
      }
      expect(getMock).toHaveBeenCalledWith("w-1");
    });

    it("returns error Result when repo.get() fails", async () => {
      const repo = stubRepo({
        get: vi.fn().mockResolvedValue(err({ code: "NOT_FOUND", message: "not found" })),
      });
      const { result } = renderWithRepo(repo);

      const r = await result.current.load("missing");

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe("NOT_FOUND");
      }
    });
  });

  // ── save() ────────────────────────────────────────────────────────

  describe("save()", () => {
    it("delegates to repo.save() and returns success Result", async () => {
      const graph = makeGraph({ id: "w-1" });
      const saveMock = vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v3"' }));
      const repo = stubRepo({ save: saveMock });
      const { result } = renderWithRepo(repo);

      const r = await result.current.save("w-1", graph, '"v2"');

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.id).toBe("w-1");
        expect(r.value.etag).toBe('"v3"');
      }
      expect(saveMock).toHaveBeenCalledWith("w-1", graph, '"v2"');
    });

    it("passes etag as undefined when omitted", async () => {
      const graph = makeGraph({ id: "w-1" });
      const saveMock = vi.fn().mockResolvedValue(ok({ id: "w-1", etag: '"v2"' }));
      const repo = stubRepo({ save: saveMock });
      const { result } = renderWithRepo(repo);

      await result.current.save("w-1", graph);

      expect(saveMock).toHaveBeenCalledWith("w-1", graph, undefined);
    });

    it("returns error Result on conflict", async () => {
      const repo = stubRepo({
        save: vi.fn().mockResolvedValue(err({ code: "CONFLICT", message: "conflict" })),
      });
      const { result } = renderWithRepo(repo);

      const r = await result.current.save("w-1", makeGraph(), '"old"');

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe("CONFLICT");
      }
    });

    it("returns error Result on not found", async () => {
      const repo = stubRepo({
        save: vi.fn().mockResolvedValue(err({ code: "NOT_FOUND", message: "missing" })),
      });
      const { result } = renderWithRepo(repo);

      const r = await result.current.save("missing", makeGraph());

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe("NOT_FOUND");
      }
    });
  });

  // ── create() ──────────────────────────────────────────────────────

  describe("create()", () => {
    it("delegates to repo.create() and returns success Result", async () => {
      const graph = makeGraph({ id: "new-1" });
      const createMock = vi.fn().mockResolvedValue(ok({ id: "new-1", etag: '"v1"' }));
      const repo = stubRepo({ create: createMock });
      const { result } = renderWithRepo(repo);

      const r = await result.current.create(graph);

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.id).toBe("new-1");
        expect(r.value.etag).toBe('"v1"');
      }
      expect(createMock).toHaveBeenCalledWith(graph);
    });

    it("returns error Result when repo.create() fails", async () => {
      const repo = stubRepo({
        create: vi.fn().mockResolvedValue(err({ code: "UNKNOWN", message: "500" })),
      });
      const { result } = renderWithRepo(repo);

      const r = await result.current.create(makeGraph());

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe("UNKNOWN");
      }
    });
  });

  // ── list() ────────────────────────────────────────────────────────

  describe("list()", () => {
    it("delegates to repo.list() and returns success Result", async () => {
      const summaries = [
        { id: "w-1", name: "Alpha" },
        { id: "w-2", name: "Beta" },
      ];
      const listMock = vi.fn().mockResolvedValue(ok(summaries));
      const repo = stubRepo({ list: listMock });
      const { result } = renderWithRepo(repo);

      const r = await result.current.list();

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value).toEqual(summaries);
      }
      expect(listMock).toHaveBeenCalled();
    });

    it("returns error Result when repo.list() fails", async () => {
      const repo = stubRepo({
        list: vi.fn().mockResolvedValue(err({ code: "NETWORK", message: "offline" })),
      });
      const { result } = renderWithRepo(repo);

      const r = await result.current.list();

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe("NETWORK");
      }
    });
  });
});
