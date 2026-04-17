import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";
import { useWorkflowStore } from "@/store/hooks";

export function EndNode({ id, selected }: NodeProps) {
  const openInspector = useWorkflowStore((s) => s.openInspector);
  const selectNode = useWorkflowStore((s) => s.select);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  return (
    <BaseNode
      title="End"
      icon="square"
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
      <Handle type="target" position={Position.Top} data-testid="end-handle-top" />
    </BaseNode>
  );
}
