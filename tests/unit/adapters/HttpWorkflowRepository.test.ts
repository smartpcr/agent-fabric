import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { HttpWorkflowRepository } from "@/adapters/HttpWorkflowRepository";
import type { WorkflowGraph } from "@/domain/models/graph";
import type { WorkflowSummary } from "@/ports/IWorkflowRepository";

// ─── MSW server ──────────────────────────────────────────────────────

const BASE_URL = "http://test.local/api/workflows";
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

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

function repo(): HttpWorkflowRepository {
  return new HttpWorkflowRepository({ baseUrl: BASE_URL });
}

// ─── list() ──────────────────────────────────────────────────────────

describe("HttpWorkflowRepository — list()", () => {
  it("returns workflow summaries on 200", async () => {
    const summaries: WorkflowSummary[] = [
      { id: "w-1", name: "Alpha" },
      { id: "w-2", name: "Beta" },
    ];
    server.use(http.get(BASE_URL, () => HttpResponse.json(summaries)));

    const result = await repo().list();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(summaries);
    }
  });

  it("returns an empty list on 200 with []", async () => {
    server.use(http.get(BASE_URL, () => HttpResponse.json([])));

    const result = await repo().list();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it("returns UNKNOWN error on 500", async () => {
    server.use(
      http.get(BASE_URL, () => HttpResponse.text("Internal Server Error", { status: 500 })),
    );

    const result = await repo().list();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.status).toBe(500);
      expect(result.error.message).toContain("500");
    }
  });

  it("returns NETWORK error when fetch throws", async () => {
    server.use(http.get(BASE_URL, () => HttpResponse.error()));

    const result = await repo().list();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK");
    }
  });
});

// ─── get(id) ─────────────────────────────────────────────────────────

describe("HttpWorkflowRepository — get()", () => {
  it("returns graph + ETag on 200", async () => {
    const graph = makeGraph();
    server.use(
      http.get(`${BASE_URL}/w-1`, () =>
        HttpResponse.json(graph, { headers: { ETag: '"etag-abc"' } }),
      ),
    );

    const result = await repo().get("w-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.graph).toEqual(graph);
      expect(result.value.etag).toBe('"etag-abc"');
    }
  });

  it("returns NOT_FOUND error on 404", async () => {
    server.use(
      http.get(`${BASE_URL}/missing`, () => HttpResponse.text("Not Found", { status: 404 })),
    );

    const result = await repo().get("missing");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.status).toBe(404);
      expect(result.error.message).toContain("missing");
    }
  });

  it("returns UNKNOWN error on 500", async () => {
    server.use(
      http.get(`${BASE_URL}/w-1`, () => HttpResponse.text("server error", { status: 500 })),
    );

    const result = await repo().get("w-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.status).toBe(500);
    }
  });

  it("returns NETWORK error when fetch throws", async () => {
    server.use(http.get(`${BASE_URL}/w-1`, () => HttpResponse.error()));

    const result = await repo().get("w-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK");
    }
  });

  it("returns empty ETag when header is missing", async () => {
    server.use(http.get(`${BASE_URL}/w-1`, () => HttpResponse.json(makeGraph())));

    const result = await repo().get("w-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.etag).toBe("");
    }
  });
});

// ─── save(id, graph, etag?) ──────────────────────────────────────────

describe("HttpWorkflowRepository — save()", () => {
  it("sends PUT with JSON body and returns new ETag on 200", async () => {
    const graph = makeGraph();
    let capturedHeaders: Record<string, string> = {};

    server.use(
      http.put(`${BASE_URL}/w-1`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json({}, { headers: { ETag: '"etag-new"' } });
      }),
    );

    const result = await repo().save("w-1", graph);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe("w-1");
      expect(result.value.etag).toBe('"etag-new"');
    }
    expect(capturedHeaders["content-type"]).toBe("application/json");
  });

  it("sends If-Match header when ETag is provided", async () => {
    let capturedIfMatch: string | null = null;
    server.use(
      http.put(`${BASE_URL}/w-1`, ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return HttpResponse.json({}, { headers: { ETag: '"etag-v2"' } });
      }),
    );

    const result = await repo().save("w-1", makeGraph(), '"etag-v1"');

    expect(result.ok).toBe(true);
    expect(capturedIfMatch).toBe('"etag-v1"');
  });

  it("does not send If-Match when no ETag is provided", async () => {
    let capturedIfMatch: string | null = "should-be-null";
    server.use(
      http.put(`${BASE_URL}/w-1`, ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return HttpResponse.json({}, { headers: { ETag: '"etag-1"' } });
      }),
    );

    await repo().save("w-1", makeGraph());

    expect(capturedIfMatch).toBeNull();
  });

  it("returns CONFLICT error on 409", async () => {
    server.use(http.put(`${BASE_URL}/w-1`, () => HttpResponse.text("Conflict", { status: 409 })));

    const result = await repo().save("w-1", makeGraph(), '"old-etag"');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.status).toBe(409);
      expect(result.error.message).toContain("modified");
    }
  });

  it("returns NOT_FOUND error on 404", async () => {
    server.use(http.put(`${BASE_URL}/w-1`, () => HttpResponse.text("Not Found", { status: 404 })));

    const result = await repo().save("w-1", makeGraph());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.status).toBe(404);
    }
  });

  it("returns UNKNOWN error on 500", async () => {
    server.use(
      http.put(`${BASE_URL}/w-1`, () =>
        HttpResponse.text("Internal Server Error", { status: 500 }),
      ),
    );

    const result = await repo().save("w-1", makeGraph());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.status).toBe(500);
    }
  });

  it("returns NETWORK error when fetch throws", async () => {
    server.use(http.put(`${BASE_URL}/w-1`, () => HttpResponse.error()));

    const result = await repo().save("w-1", makeGraph());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK");
    }
  });

  it("sends the graph as JSON body", async () => {
    const graph = makeGraph({ id: "g-99", name: "My Workflow" });
    let capturedBody: unknown = null;

    server.use(
      http.put(`${BASE_URL}/g-99`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({}, { headers: { ETag: '"e"' } });
      }),
    );

    await repo().save("g-99", graph);

    expect(capturedBody).toEqual(graph);
  });
});

// ─── create(graph) ───────────────────────────────────────────────────

describe("HttpWorkflowRepository — create()", () => {
  it("sends POST with JSON body and returns id + ETag on 201", async () => {
    const graph = makeGraph({ id: "new-graph" });
    let capturedBody: unknown = null;

    server.use(
      http.post(BASE_URL, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { id: "created-id" },
          { status: 201, headers: { ETag: '"etag-created"' } },
        );
      }),
    );

    const result = await repo().create(graph);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe("created-id");
      expect(result.value.etag).toBe('"etag-created"');
    }
    expect(capturedBody).toEqual(graph);
  });

  it("returns id + ETag on 200 (some servers use 200 for create)", async () => {
    server.use(
      http.post(BASE_URL, () =>
        HttpResponse.json({ id: "w-new" }, { status: 200, headers: { ETag: '"e-1"' } }),
      ),
    );

    const result = await repo().create(makeGraph());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe("w-new");
      expect(result.value.etag).toBe('"e-1"');
    }
  });

  it("returns UNKNOWN error on 500", async () => {
    server.use(http.post(BASE_URL, () => HttpResponse.text("server error", { status: 500 })));

    const result = await repo().create(makeGraph());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.status).toBe(500);
    }
  });

  it("returns NETWORK error when fetch throws", async () => {
    server.use(http.post(BASE_URL, () => HttpResponse.error()));

    const result = await repo().create(makeGraph());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK");
    }
  });

  it("returns UNKNOWN error on 400", async () => {
    server.use(http.post(BASE_URL, () => HttpResponse.text("Bad Request", { status: 400 })));

    const result = await repo().create(makeGraph());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.status).toBe(400);
    }
  });
});

// ─── Constructor ─────────────────────────────────────────────────────

describe("HttpWorkflowRepository — constructor", () => {
  it("strips trailing slashes from baseUrl", async () => {
    let requestedUrl = "";
    server.use(
      http.get("http://test.local/api/wf", ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const r = new HttpWorkflowRepository({ baseUrl: "http://test.local/api/wf///" });
    await r.list();

    expect(requestedUrl).toBe("http://test.local/api/wf");
  });
});

// ─── Non-Error network failure edge case ─────────────────────────────

describe("HttpWorkflowRepository — non-Error throw", () => {
  it("handles non-Error thrown objects in network catch", async () => {
    const r = new HttpWorkflowRepository({
      baseUrl: BASE_URL,
      fetch: () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "string error";
      },
    });

    const result = await r.list();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK");
      expect(result.error.message).toBe("Network error");
    }
  });
});
