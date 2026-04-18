import { z } from "zod";

// ─── Base schema shared by all events ────────────────────────────────

const baseEventSchema = z.object({
  runId: z.string().min(1),
  at: z.number(),
});

// ─── Node events ─────────────────────────────────────────────────────

const nodeStartedSchema = baseEventSchema.extend({
  type: z.literal("node.started"),
  nodeId: z.string().min(1),
  payload: z
    .object({
      iteration: z.number()["int"]().nonnegative().optional(),
    })
    .optional(),
});

const nodeSucceededSchema = baseEventSchema.extend({
  type: z.literal("node.succeeded"),
  nodeId: z.string().min(1),
  payload: z
    .object({
      result: z.unknown().optional(),
      durationMs: z.number().nonnegative().optional(),
    })
    .optional(),
});

const nodeFailedSchema = baseEventSchema.extend({
  type: z.literal("node.failed"),
  nodeId: z.string().min(1),
  payload: z
    .object({
      error: z.string().optional(),
      durationMs: z.number().nonnegative().optional(),
    })
    .optional(),
});

const nodeSkippedSchema = baseEventSchema.extend({
  type: z.literal("node.skipped"),
  nodeId: z.string().min(1),
  payload: z
    .object({
      reason: z.string().optional(),
    })
    .optional(),
});

// ─── Edge events ─────────────────────────────────────────────────────

const edgeActivatedSchema = baseEventSchema.extend({
  type: z.literal("edge.activated"),
  edgeId: z.string().min(1),
  payload: z
    .object({
      sourceNodeId: z.string().optional(),
      targetNodeId: z.string().optional(),
    })
    .optional(),
});

const edgeTakenSchema = baseEventSchema.extend({
  type: z.literal("edge.taken"),
  edgeId: z.string().min(1),
  payload: z
    .object({
      dataSize: z.number().nonnegative().optional(),
    })
    .optional(),
});

// ─── Run events ──────────────────────────────────────────────────────

const runStartedSchema = baseEventSchema.extend({
  type: z.literal("run.started"),
  payload: z
    .object({
      totalNodes: z.number()["int"]().nonnegative().optional(),
    })
    .optional(),
});

const runCompletedSchema = baseEventSchema.extend({
  type: z.literal("run.completed"),
  payload: z
    .object({
      durationMs: z.number().nonnegative().optional(),
      nodesExecuted: z.number()["int"]().nonnegative().optional(),
    })
    .optional(),
});

const runFailedSchema = baseEventSchema.extend({
  type: z.literal("run.failed"),
  payload: z
    .object({
      error: z.string().optional(),
      failedNodeId: z.string().optional(),
    })
    .optional(),
});

const runCancelledSchema = baseEventSchema.extend({
  type: z.literal("run.cancelled"),
  payload: z
    .object({
      reason: z.string().optional(),
    })
    .optional(),
});

// ─── Discriminated union ─────────────────────────────────────────────

/**
 * Zod schema for the discriminated union of all execution events.
 * Uses `type` as the discriminator key.
 */
export const executionEventSchema = z.discriminatedUnion("type", [
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
]);

/** Discriminated union type for all execution events. */
export type ExecutionEvent = z.infer<typeof executionEventSchema>;

// ─── Per-variant type aliases ────────────────────────────────────────

export type NodeStartedEvent = z.infer<typeof nodeStartedSchema>;
export type NodeSucceededEvent = z.infer<typeof nodeSucceededSchema>;
export type NodeFailedEvent = z.infer<typeof nodeFailedSchema>;
export type NodeSkippedEvent = z.infer<typeof nodeSkippedSchema>;
export type EdgeActivatedEvent = z.infer<typeof edgeActivatedSchema>;
export type EdgeTakenEvent = z.infer<typeof edgeTakenSchema>;
export type RunStartedEvent = z.infer<typeof runStartedSchema>;
export type RunCompletedEvent = z.infer<typeof runCompletedSchema>;
export type RunFailedEvent = z.infer<typeof runFailedSchema>;
export type RunCancelledEvent = z.infer<typeof runCancelledSchema>;

/** All possible event type discriminator values. */
export const EXECUTION_EVENT_TYPES = [
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
] as const;

export type ExecutionEventType = (typeof EXECUTION_EVENT_TYPES)[number];

// ─── Per-variant schemas (exported for adapter use) ──────────────────

export {
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
};
