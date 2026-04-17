import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";

export function StartNode({ selected }: NodeProps) {
  return (
    <BaseNode title="Start" icon="play" selected={selected} borderRadius="9999px">
      <Handle type="source" position={Position.Bottom} data-testid="start-handle-bottom" />
    </BaseNode>
  );
}
