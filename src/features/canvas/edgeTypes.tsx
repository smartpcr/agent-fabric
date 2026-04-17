import type { EdgeTypes } from "@xyflow/react";
import { DefaultEdge } from "@/features/edges/DefaultEdge";
import { ConditionalEdge } from "@/features/edges/ConditionalEdge";

export const edgeTypes: EdgeTypes = {
  default: DefaultEdge,
  "loop-back": DefaultEdge,
  conditional: ConditionalEdge,
};
