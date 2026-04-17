import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";

const PILL_STYLE: React.CSSProperties = {
  borderRadius: "9999px",
};

export function StartNode({ selected }: NodeProps) {
  return (
    <div style={PILL_STYLE} data-testid="start-node">
      <BaseNode title="Start" icon="play" selected={selected}>
        <Handle type="source" position={Position.Bottom} data-testid="start-handle-bottom" />
      </BaseNode>
    </div>
  );
}
