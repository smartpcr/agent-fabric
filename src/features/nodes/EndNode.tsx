import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";

const PILL_STYLE: React.CSSProperties = {
  borderRadius: "9999px",
};

export function EndNode({ selected }: NodeProps) {
  return (
    <div style={PILL_STYLE} data-testid="end-node">
      <BaseNode title="End" icon="square" selected={selected}>
        <Handle type="target" position={Position.Top} data-testid="end-handle-top" />
      </BaseNode>
    </div>
  );
}
