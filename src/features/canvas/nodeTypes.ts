import type { NodeTypes } from "@xyflow/react";
import { StartNode } from "@/features/nodes/StartNode";
import { EndNode } from "@/features/nodes/EndNode";
import { TaskNode } from "@/features/nodes/TaskNode";

export const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  task: TaskNode,
};
