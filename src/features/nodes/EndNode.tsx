import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";
import { useWorkflowStore } from "@/store/hooks";

export function EndNode({ id, selected }: NodeProps) {
  const openInspector = useWorkflowStore((s) => s.openInspector);
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
    >
      <Handle type="target" position={Position.Top} data-testid="end-handle-top" />
    </BaseNode>
  );
}
