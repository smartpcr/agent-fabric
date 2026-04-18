import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryWorkflowRepository } from "@/adapters/InMemoryWorkflowRepository";
import type { WorkflowGraph } from "@/domain/models/graph";

// ─── Fixture helpers ─────────────────────────────────────────────────

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

// ─── Test suite ──────────────────────────────────────────────────────

describe("InMemoryWorkflowRepository", () => {
  let repo: InMemoryWorkflowRepository;

  beforeEach(() => {
    repo = new InMemoryWorkflowRepository();
  });

  // ── list() ──────────────────────────────────────────────────────────

  describe("list()", () => {
    it("returns empty array when store is empty", async () => {
      const result = await repo.list();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });

    it("returns summaries of all stored workflows", async () => {
      await repo.create(makeGraph({ id: "w-1", name: "Alpha" }));
      await repo.create(makeGraph({ id: "w-2", name: "Beta" }));

      const result = await repo.list();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value).toContainEqual({ id: "w-1", name: "Alpha" });
        expect(result.value).toContainEqual({ id: "w-2", name: "Beta" });
      }
    });

    it("reflects updated names after save", async () => {
      await repo.create(makeGraph({ id: "w-1", name: "Original" }));
      await repo.save("w-1", makeGraph({ id: "w-1", name: "Renamed" }));

      const result = await repo.list();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContainEqual({ id: "w-1", name: "Renamed" });
      }
    });
  });

  // ── get(id) ─────────────────────────────────────────────────────────

  describe("get()", () => {
    it("returns NOT_FOUND for unknown id", async () => {
      const result = await repo.get("nonexistent");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toContain("nonexistent");
      }
    });

    it("returns graph + ETag for existing workflow", async () => {
      const graph = makeGraph({ id: "w-1", name: "My Flow" });
      await repo.create(graph);

      const result = await repo.get("w-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.graph).toEqual(graph);
        expect(result.value.etag).toBe('"v1"');
      }
    });

    it("returns updated ETag after save", async () => {
      await repo.create(makeGraph({ id: "w-1" }));
      await repo.save("w-1", makeGraph({ id: "w-1", name: "Updated" }));

      const result = await repo.get("w-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.etag).toBe('"v2"');
        expect(result.value.graph.name).toBe("Updated");
      }
    });
  });

  // ── create(graph) ───────────────────────────────────────────────────

  describe("create()", () => {
    it("stores a new workflow and returns id + ETag v1", async () => {
      const graph = makeGraph({ id: "new-1", name: "Brand New" });
      const result = await repo.create(graph);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe("new-1");
        expect(result.value.etag).toBe('"v1"');
      }
    });

    it("workflow is retrievable after create", async () => {
      const graph = makeGraph({ id: "w-3" });
      await repo.create(graph);

      const getResult = await repo.get("w-3");

      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value.graph).toEqual(graph);
      }
    });

    it("overwrites existing workflow on re-create (resets version)", async () => {
      await repo.create(makeGraph({ id: "w-1", name: "First" }));
      await repo.save("w-1", makeGraph({ id: "w-1", name: "V2" }));

      // Re-create resets the version counter
      const result = await repo.create(makeGraph({ id: "w-1", name: "Reset" }));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.etag).toBe('"v1"');
      }

      const getResult = await repo.get("w-1");

      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value.graph.name).toBe("Reset");
      }
    });
  });

  // ── save(id, graph, etag?) ──────────────────────────────────────────

  describe("save()", () => {
    it("returns NOT_FOUND when saving to unknown id", async () => {
      const result = await repo.save("missing", makeGraph());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toContain("missing");
      }
    });

    it("saves without ETag (unconditional update)", async () => {
      await repo.create(makeGraph({ id: "w-1" }));

      const result = await repo.save("w-1", makeGraph({ id: "w-1", name: "No Etag" }));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe("w-1");
        expect(result.value.etag).toBe('"v2"');
      }
    });

    it("saves with matching ETag", async () => {
      await repo.create(makeGraph({ id: "w-1" }));

      const result = await repo.save("w-1", makeGraph({ id: "w-1", name: "Etag OK" }), '"v1"');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.etag).toBe('"v2"');
      }
    });

    it("returns CONFLICT when ETag does not match", async () => {
      await repo.create(makeGraph({ id: "w-1" }));

      const result = await repo.save("w-1", makeGraph({ id: "w-1", name: "Stale" }), '"v99"');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CONFLICT");
        expect(result.error.message).toContain("modified");
      }
    });

    it("increments version on each successive save", async () => {
      await repo.create(makeGraph({ id: "w-1" }));

      const r1 = await repo.save("w-1", makeGraph({ id: "w-1", name: "v2" }));

      expect(r1.ok).toBe(true);
      if (!r1.ok) return;
      expect(r1.value.etag).toBe('"v2"');

      const r2 = await repo.save("w-1", makeGraph({ id: "w-1", name: "v3" }), r1.value.etag);

      expect(r2.ok).toBe(true);
      if (!r2.ok) return;
      expect(r2.value.etag).toBe('"v3"');

      const r3 = await repo.save("w-1", makeGraph({ id: "w-1", name: "v4" }), r2.value.etag);

      expect(r3.ok).toBe(true);
      if (!r3.ok) return;
      expect(r3.value.etag).toBe('"v4"');
    });

    it("conflict does not advance the version", async () => {
      await repo.create(makeGraph({ id: "w-1" }));

      // Conflict attempt with wrong ETag
      const conflict = await repo.save("w-1", makeGraph({ id: "w-1", name: "Bad" }), '"v999"');

      expect(conflict.ok).toBe(false);

      // Version should still be v1
      const getResult = await repo.get("w-1");

      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value.etag).toBe('"v1"');
      }
    });

    it("updates graph data on successful save", async () => {
      const original = makeGraph({ id: "w-1", name: "Original" });
      await repo.create(original);

      const updated = makeGraph({ id: "w-1", name: "Updated" });
      await repo.save("w-1", updated);

      const getResult = await repo.get("w-1");

      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value.graph.name).toBe("Updated");
      }
    });
  });

  // ── ETag simulation ─────────────────────────────────────────────────

  describe("ETag simulation", () => {
    it("ETag format is deterministic based on version", async () => {
      await repo.create(makeGraph({ id: "w-1" }));
      const r1 = await repo.get("w-1");

      expect(r1.ok).toBe(true);
      if (r1.ok) {
        expect(r1.value.etag).toMatch(/^"v\d+"$/);
      }
    });

    it("different workflows have independent version counters", async () => {
      await repo.create(makeGraph({ id: "w-1" }));
      await repo.create(makeGraph({ id: "w-2" }));

      // Save w-1 twice
      await repo.save("w-1", makeGraph({ id: "w-1", name: "A2" }));
      await repo.save("w-1", makeGraph({ id: "w-1", name: "A3" }));

      const r1 = await repo.get("w-1");
      const r2 = await repo.get("w-2");

      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      if (r1.ok && r2.ok) {
        expect(r1.value.etag).toBe('"v3"');
        expect(r2.value.etag).toBe('"v1"');
      }
    });
  });
});
