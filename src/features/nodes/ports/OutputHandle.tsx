import { Handle, Position } from "@xyflow/react";
import type { PortSpec } from "@/domain/models/port";

export interface OutputHandleProps {
  readonly portSpec: PortSpec;
  readonly position?: Position;
}

export function OutputHandle({ portSpec, position = Position.Bottom }: OutputHandleProps) {
  return (
    <Handle
      type="source"
      position={position}
      id={portSpec.id}
      data-port-id={portSpec.id}
      aria-label={portSpec.label}
      className={`port-handle port-type-${portSpec.dataType}`}
    />
  );
}
