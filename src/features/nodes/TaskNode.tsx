import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";

interface TaskData {
  readonly name: string;
}

export function TaskNode({ id, data, type, selected }: NodeProps) {
  const taskData = data as TaskData;
  const spec = useWorkflowStore((s) => selectNodeSpec(s, type ?? "task"));
  const openInspector = useWorkflowStore((s) => s.openInspector);
  const selectNode = useWorkflowStore((s) => s.select);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const icon = spec?.icon ?? "cog";

  return (
    <BaseNode
      title={taskData.name}
      icon={icon}
      selected={selected}
      nodeId={id}
      onEnter={() => {
        openInspector(id);
      }}
      onNodeFocus={() => {
        selectNode(id, "replace");
      }}
      onDelete={deleteSelected}
    >
      <Handle type="target" position={Position.Top} data-testid="task-handle-top" />
      <Handle type="source" position={Position.Bottom} data-testid="task-handle-bottom" />
    </BaseNode>
  );
}
