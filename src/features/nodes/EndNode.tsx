import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";

export function EndNode({ selected }: NodeProps) {
  return (
    <BaseNode title="End" icon="square" selected={selected} borderRadius="9999px">
      <Handle type="target" position={Position.Top} data-testid="end-handle-top" />
    </BaseNode>
  );
}
