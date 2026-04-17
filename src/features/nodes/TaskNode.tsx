import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";

interface TaskData {
  readonly name: string;
}

export function TaskNode({ data, type, selected }: NodeProps) {
  const taskData = data as TaskData;
  const spec = useWorkflowStore((s) => selectNodeSpec(s, type ?? "task"));
  const icon = spec?.icon ?? "cog";

  return (
    <BaseNode title={taskData.name} icon={icon} selected={selected}>
      <Handle type="target" position={Position.Top} data-testid="task-handle-top" />
      <Handle type="source" position={Position.Bottom} data-testid="task-handle-bottom" />
    </BaseNode>
  );
}
