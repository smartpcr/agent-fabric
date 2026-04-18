import { describe, it, expect } from "vitest";
import type { z } from "zod";
import {
  executionEventSchema,
  EXECUTION_EVENT_TYPES,
  type ExecutionEvent,
  type NodeStartedEvent,
  type NodeSucceededEvent,
  type NodeFailedEvent,
  type NodeSkippedEvent,
  type EdgeActivatedEvent,
  type EdgeTakenEvent,
  type RunStartedEvent,
  type RunCompletedEvent,
  type RunFailedEvent,
  type RunCancelledEvent,
  nodeStartedSchema,
  nodeSucceededSchema,
  nodeFailedSchema,
  nodeSkippedSchema,
  edgeActivatedSchema,
  edgeTakenSchema,
  runStartedSchema,
  runCompletedSchema,
  runFailedSchema,
  runCancelledSchema,
} from "@/domain/models/executionEvent";
import { assertNever } from "@/utils/assertNever";

// ─── Helpers ─────────────────────────────────────────────────────────

const NOW = Date.now();
const RUN_ID = "run-abc-123";
const NODE_ID = "node-1";
const EDGE_ID = "edge-1";

function makeBase(type: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { type, runId: RUN_ID, at: NOW, ...extra };
}

// ─── EXECUTION_EVENT_TYPES ───────────────────────────────────────────

describe("EXECUTION_EVENT_TYPES", () => {
  it("contains exactly 10 event types", () => {
    expect(EXECUTION_EVENT_TYPES).toHaveLength(10);
  });

  it("contains all expected event types", () => {
    const expected = [
      "node.started",
      "node.succeeded",
      "node.failed",
      "node.skipped",
      "edge.activated",
      "edge.taken",
      "run.started",
      "run.completed",
      "run.failed",
      "run.cancelled",
    ];
    expect([...EXECUTION_EVENT_TYPES]).toEqual(expected);
  });
});

// ─── Exhaustive match via assertNever ────────────────────────────────

describe("exhaustive match via assertNever", () => {
  function describeEvent(event: ExecutionEvent): string {
    switch (event.type) {
      case "node.started":
        return `node ${event.nodeId} started`;
      case "node.succeeded":
        return `node ${event.nodeId} succeeded`;
      case "node.failed":
        return `node ${event.nodeId} failed`;
      case "node.skipped":
        return `node ${event.nodeId} skipped`;
      case "edge.activated":
        return `edge ${event.edgeId} activated`;
      case "edge.taken":
        return `edge ${event.edgeId} taken`;
      case "run.started":
        return `run ${event.runId} started`;
      case "run.completed":
        return `run ${event.runId} completed`;
      case "run.failed":
        return `run ${event.runId} failed`;
      case "run.cancelled":
        return `run ${event.runId} cancelled`;
      default:
        return assertNever(event);
    }
  }

  it("handles node.started", () => {
    const event: ExecutionEvent = { type: "node.started", runId: RUN_ID, at: NOW, nodeId: NODE_ID };
    expect(describeEvent(event)).toBe(`node ${NODE_ID} started`);
  });

  it("handles node.succeeded", () => {
    const event: ExecutionEvent = {
      type: "node.succeeded",
      runId: RUN_ID,
      at: NOW,
      nodeId: NODE_ID,
    };
    expect(describeEvent(event)).toBe(`node ${NODE_ID} succeeded`);
  });

  it("handles node.failed", () => {
    const event: ExecutionEvent = {
      type: "node.failed",
      runId: RUN_ID,
      at: NOW,
      nodeId: NODE_ID,
    };
    expect(describeEvent(event)).toBe(`node ${NODE_ID} failed`);
  });

  it("handles node.skipped", () => {
    const event: ExecutionEvent = {
      type: "node.skipped",
      runId: RUN_ID,
      at: NOW,
      nodeId: NODE_ID,
    };
    expect(describeEvent(event)).toBe(`node ${NODE_ID} skipped`);
  });

  it("handles edge.activated", () => {
    const event: ExecutionEvent = {
      type: "edge.activated",
      runId: RUN_ID,
      at: NOW,
      edgeId: EDGE_ID,
    };
    expect(describeEvent(event)).toBe(`edge ${EDGE_ID} activated`);
  });

  it("handles edge.taken", () => {
    const event: ExecutionEvent = {
      type: "edge.taken",
      runId: RUN_ID,
      at: NOW,
      edgeId: EDGE_ID,
    };
    expect(describeEvent(event)).toBe(`edge ${EDGE_ID} taken`);
  });

  it("handles run.started", () => {
    const event: ExecutionEvent = { type: "run.started", runId: RUN_ID, at: NOW };
    expect(describeEvent(event)).toBe(`run ${RUN_ID} started`);
  });

  it("handles run.completed", () => {
    const event: ExecutionEvent = { type: "run.completed", runId: RUN_ID, at: NOW };
    expect(describeEvent(event)).toBe(`run ${RUN_ID} completed`);
  });

  it("handles run.failed", () => {
    const event: ExecutionEvent = { type: "run.failed", runId: RUN_ID, at: NOW };
    expect(describeEvent(event)).toBe(`run ${RUN_ID} failed`);
  });

  it("handles run.cancelled", () => {
    const event: ExecutionEvent = { type: "run.cancelled", runId: RUN_ID, at: NOW };
    expect(describeEvent(event)).toBe(`run ${RUN_ID} cancelled`);
  });

  it("assertNever throws on invalid type at runtime", () => {
    const bad = { type: "bogus", runId: RUN_ID, at: NOW } as unknown as ExecutionEvent;
    expect(() => describeEvent(bad)).toThrow(/Unexpected value/);
  });
});

// ─── Zod schema: accepts valid events ────────────────────────────────

describe("executionEventSchema — accepts valid events", () => {
  it("accepts node.started without payload", () => {
    const data = makeBase("node.started", { nodeId: NODE_ID });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("node.started");
      expect(result.data.runId).toBe(RUN_ID);
      expect(result.data.at).toBe(NOW);
      expect((result.data as NodeStartedEvent).nodeId).toBe(NODE_ID);
    }
  });

  it("accepts node.started with payload", () => {
    const data = makeBase("node.started", { nodeId: NODE_ID, payload: { iteration: 2 } });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      const event = result.data as NodeStartedEvent;
      expect(event.payload?.iteration).toBe(2);
    }
  });

  it("accepts node.succeeded without payload", () => {
    const data = makeBase("node.succeeded", { nodeId: NODE_ID });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts node.succeeded with payload", () => {
    const data = makeBase("node.succeeded", {
      nodeId: NODE_ID,
      payload: { result: { output: 42 }, durationMs: 150 },
    });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      const event = result.data as NodeSucceededEvent;
      expect(event.payload?.durationMs).toBe(150);
    }
  });

  it("accepts node.failed without payload", () => {
    const data = makeBase("node.failed", { nodeId: NODE_ID });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts node.failed with payload", () => {
    const data = makeBase("node.failed", {
      nodeId: NODE_ID,
      payload: { error: "Timeout", durationMs: 5000 },
    });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      const event = result.data as NodeFailedEvent;
      expect(event.payload?.error).toBe("Timeout");
    }
  });

  it("accepts node.skipped without payload", () => {
    const data = makeBase("node.skipped", { nodeId: NODE_ID });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts node.skipped with payload", () => {
    const data = makeBase("node.skipped", { nodeId: NODE_ID, payload: { reason: "condition" } });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      const event = result.data as NodeSkippedEvent;
      expect(event.payload?.reason).toBe("condition");
    }
  });

  it("accepts edge.activated without payload", () => {
    const data = makeBase("edge.activated", { edgeId: EDGE_ID });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts edge.activated with payload", () => {
    const data = makeBase("edge.activated", {
      edgeId: EDGE_ID,
      payload: { sourceNodeId: "n1", targetNodeId: "n2" },
    });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      const event = result.data as EdgeActivatedEvent;
      expect(event.payload?.sourceNodeId).toBe("n1");
    }
  });

  it("accepts edge.taken without payload", () => {
    const data = makeBase("edge.taken", { edgeId: EDGE_ID });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts edge.taken with payload", () => {
    const data = makeBase("edge.taken", { edgeId: EDGE_ID, payload: { dataSize: 1024 } });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      const event = result.data as EdgeTakenEvent;
      expect(event.payload?.dataSize).toBe(1024);
    }
  });

  it("accepts run.started without payload", () => {
    const data = makeBase("run.started");
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts run.started with payload", () => {
    const data = makeBase("run.started", { payload: { totalNodes: 5 } });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      const event = result.data as RunStartedEvent;
      expect(event.payload?.totalNodes).toBe(5);
    }
  });

  it("accepts run.completed without payload", () => {
    const data = makeBase("run.completed");
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts run.completed with payload", () => {
    const data = makeBase("run.completed", { payload: { durationMs: 3000, nodesExecuted: 4 } });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      const event = result.data as RunCompletedEvent;
      expect(event.payload?.durationMs).toBe(3000);
      expect(event.payload?.nodesExecuted).toBe(4);
    }
  });

  it("accepts run.failed without payload", () => {
    const data = makeBase("run.failed");
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts run.failed with payload", () => {
    const data = makeBase("run.failed", {
      payload: { error: "node-3 crashed", failedNodeId: "node-3" },
    });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      const event = result.data as RunFailedEvent;
      expect(event.payload?.error).toBe("node-3 crashed");
      expect(event.payload?.failedNodeId).toBe("node-3");
    }
  });

  it("accepts run.cancelled without payload", () => {
    const data = makeBase("run.cancelled");
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts run.cancelled with payload", () => {
    const data = makeBase("run.cancelled", { payload: { reason: "user request" } });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      const event = result.data as RunCancelledEvent;
      expect(event.payload?.reason).toBe("user request");
    }
  });
});

// ─── Zod schema: rejects invalid events ──────────────────────────────

describe("executionEventSchema — rejects invalid events", () => {
  it("rejects unknown event type", () => {
    const data = makeBase("node.exploded", { nodeId: NODE_ID });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects missing runId", () => {
    const data = { type: "node.started", at: NOW, nodeId: NODE_ID };
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects empty runId", () => {
    const data = { type: "node.started", runId: "", at: NOW, nodeId: NODE_ID };
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects missing at timestamp", () => {
    const data = { type: "node.started", runId: RUN_ID, nodeId: NODE_ID };
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric at", () => {
    const data = { type: "node.started", runId: RUN_ID, at: "not-a-number", nodeId: NODE_ID };
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects node event without nodeId", () => {
    const data = makeBase("node.started");
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects node event with empty nodeId", () => {
    const data = makeBase("node.started", { nodeId: "" });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects edge event without edgeId", () => {
    const data = makeBase("edge.activated");
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects edge event with empty edgeId", () => {
    const data = makeBase("edge.activated", { edgeId: "" });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects completely empty object", () => {
    const result = executionEventSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects null input", () => {
    const result = executionEventSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it("rejects string input", () => {
    const result = executionEventSchema.safeParse("node.started");
    expect(result.success).toBe(false);
  });

  it("rejects negative iteration in node.started payload", () => {
    const data = makeBase("node.started", { nodeId: NODE_ID, payload: { iteration: -1 } });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects negative durationMs in node.succeeded payload", () => {
    const data = makeBase("node.succeeded", { nodeId: NODE_ID, payload: { durationMs: -100 } });
    const result = executionEventSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ─── Per-variant schema exports ──────────────────────────────────────

describe("per-variant schema exports", () => {
  const variantSchemas = [
    {
      name: "nodeStartedSchema",
      schema: nodeStartedSchema,
      type: "node.started",
      extra: { nodeId: NODE_ID },
    },
    {
      name: "nodeSucceededSchema",
      schema: nodeSucceededSchema,
      type: "node.succeeded",
      extra: { nodeId: NODE_ID },
    },
    {
      name: "nodeFailedSchema",
      schema: nodeFailedSchema,
      type: "node.failed",
      extra: { nodeId: NODE_ID },
    },
    {
      name: "nodeSkippedSchema",
      schema: nodeSkippedSchema,
      type: "node.skipped",
      extra: { nodeId: NODE_ID },
    },
    {
      name: "edgeActivatedSchema",
      schema: edgeActivatedSchema,
      type: "edge.activated",
      extra: { edgeId: EDGE_ID },
    },
    {
      name: "edgeTakenSchema",
      schema: edgeTakenSchema,
      type: "edge.taken",
      extra: { edgeId: EDGE_ID },
    },
    { name: "runStartedSchema", schema: runStartedSchema, type: "run.started", extra: {} },
    { name: "runCompletedSchema", schema: runCompletedSchema, type: "run.completed", extra: {} },
    { name: "runFailedSchema", schema: runFailedSchema, type: "run.failed", extra: {} },
    { name: "runCancelledSchema", schema: runCancelledSchema, type: "run.cancelled", extra: {} },
  ];

  for (const { name, schema, type, extra } of variantSchemas) {
    it(`${name} accepts a valid ${type} event`, () => {
      const data = makeBase(type, extra);
      const result = (schema as z.ZodType).safeParse(data);
      expect(result.success).toBe(true);
    });

    it(`${name} rejects an event with the wrong type`, () => {
      const wrongType = type === "run.started" ? "run.completed" : "run.started";
      const data = makeBase(wrongType, extra);
      const result = (schema as z.ZodType).safeParse(data);
      expect(result.success).toBe(false);
    });
  }
});

// ─── Type-level checks ───────────────────────────────────────────────

describe("type-level checks", () => {
  it("ExecutionEvent type narrowing works for node events", () => {
    const raw: unknown = {
      type: "node.started",
      runId: RUN_ID,
      at: NOW,
      nodeId: NODE_ID,
    };
    const result = executionEventSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "node.started") {
      // TypeScript should narrow to NodeStartedEvent here
      const _nodeId: string = result.data.nodeId;
      expect(_nodeId).toBe(NODE_ID);
    }
  });

  it("ExecutionEvent type narrowing works for edge events", () => {
    const raw: unknown = {
      type: "edge.activated",
      runId: RUN_ID,
      at: NOW,
      edgeId: EDGE_ID,
    };
    const result = executionEventSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "edge.activated") {
      const _edgeId: string = result.data.edgeId;
      expect(_edgeId).toBe(EDGE_ID);
    }
  });

  it("ExecutionEvent type narrowing works for run events", () => {
    const raw: unknown = {
      type: "run.started",
      runId: RUN_ID,
      at: NOW,
    };
    const result = executionEventSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "run.started") {
      const _runId: string = result.data.runId;
      expect(_runId).toBe(RUN_ID);
    }
  });
});
