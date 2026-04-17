import { z } from "zod";

const PositionJsonV1 = z.object({
  x: z.number(),
  y: z.number(),
});

const nodeBase = {
  id: z.string().min(1),
  position: PositionJsonV1,
  data: z.unknown(),
};

const StartNodeJsonV1 = z.object({ ...nodeBase, kind: z.literal("start") });
const EndNodeJsonV1 = z.object({ ...nodeBase, kind: z.literal("end") });
const TaskNodeJsonV1 = z.object({ ...nodeBase, kind: z.literal("task") });

const NodeJsonV1 = z.discriminatedUnion("kind", [StartNodeJsonV1, EndNodeJsonV1, TaskNodeJsonV1]);

const edgeBase = {
  id: z.string().min(1),
  source: z.string().min(1),
  sourcePort: z.string().min(1),
  target: z.string().min(1),
  targetPort: z.string().min(1),
  label: z.string().optional(),
  condition: z.string().optional(),
};

const DefaultEdgeJsonV1 = z.object({ ...edgeBase, kind: z.literal("default") });
const LoopBackEdgeJsonV1 = z.object({ ...edgeBase, kind: z.literal("loop-back") });

const EdgeJsonV1 = z.discriminatedUnion("kind", [DefaultEdgeJsonV1, LoopBackEdgeJsonV1]);

export const GraphJsonV1 = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string(),
  nodes: z.array(NodeJsonV1),
  edges: z.array(EdgeJsonV1),
});

export type GraphJsonV1Type = z.infer<typeof GraphJsonV1>;
export type NodeJsonV1Type = z.infer<typeof NodeJsonV1>;
export type EdgeJsonV1Type = z.infer<typeof EdgeJsonV1>;
