import { Handle, Position } from "@xyflow/react";
import type { PortSpec } from "@/domain/models/port";
import { useStartKeyboardConnect } from "@/features/canvas/KeyboardConnectContext";

export interface OutputHandleProps {
  readonly portSpec: PortSpec;
  readonly position?: Position;
  readonly nodeId?: string;
  readonly onStartConnect?: (nodeId: string, portId: string) => void;
  readonly "data-testid"?: string;
}

export function OutputHandle({
  portSpec,
  position = Position.Bottom,
  nodeId,
  onStartConnect,
  "data-testid": testId,
}: OutputHandleProps) {
  const contextStartConnect = useStartKeyboardConnect();
  const startConnect = onStartConnect ?? contextStartConnect;

  return (
    <Handle
      type="source"
      position={position}
      id={portSpec.id}
      data-testid={testId}
      data-port-id={portSpec.id}
      aria-label={portSpec.label}
      className={`port-handle port-type-${portSpec.dataType}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && nodeId && startConnect) {
          e.preventDefault();
          e.stopPropagation();
          startConnect(nodeId, portSpec.id);
        }
      }}
    />
  );
}
