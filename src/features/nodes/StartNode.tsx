import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";
import { useWorkflowStore } from "@/store/hooks";

export function StartNode({ id, selected }: NodeProps) {
  const openInspector = useWorkflowStore((s) => s.openInspector);
  const selectNode = useWorkflowStore((s) => s.select);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  return (
    <BaseNode
      title="Start"
      icon="play"
      selected={selected}
      borderRadius="9999px"
      nodeId={id}
      onEnter={() => {
        openInspector(id);
      }}
      onNodeFocus={() => {
        selectNode(id, "replace");
      }}
      onDelete={deleteSelected}
    >
      <Handle type="source" position={Position.Bottom} data-testid="start-handle-bottom" />
    </BaseNode>
  );
}
