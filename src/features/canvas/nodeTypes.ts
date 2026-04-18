import type { NodeTypes } from "@xyflow/react";
import { StartNode } from "@/features/nodes/StartNode";
import { EndNode } from "@/features/nodes/EndNode";
import { TaskNode } from "@/features/nodes/TaskNode";
import { DecisionNode } from "@/features/nodes/DecisionNode";

export const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  task: TaskNode,
  decision: DecisionNode,
  "decision-switch": DecisionNode,
};
