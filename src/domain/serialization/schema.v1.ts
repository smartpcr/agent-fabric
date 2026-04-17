import { z } from "zod";

const PositionJsonV1 = z.object({
  x: z.number(),
  y: z.number(),
});

const NodeJsonV1 = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  position: PositionJsonV1,
  data: z.unknown(),
});

const EdgeJsonV1 = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  sourcePort: z.string().min(1),
  target: z.string().min(1),
  targetPort: z.string().min(1),
  label: z.string().optional(),
  condition: z.string().optional(),
  kind: z.literal("default").or(z.literal("loop-back")),
});

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
