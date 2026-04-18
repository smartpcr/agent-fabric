import type { EdgeTypes } from "@xyflow/react";
import { DefaultEdge } from "@/features/edges/DefaultEdge";
import { ConditionalEdge } from "@/features/edges/ConditionalEdge";
import { LoopBackEdge } from "@/features/edges/LoopBackEdge";

export const edgeTypes: EdgeTypes = {
  default: DefaultEdge,
  "loop-back": LoopBackEdge,
  conditional: ConditionalEdge,
};
