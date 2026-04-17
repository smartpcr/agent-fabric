import { Handle, Position } from "@xyflow/react";
import type { PortSpec } from "@/domain/models/port";

export interface InputHandleProps {
  readonly portSpec: PortSpec;
  readonly position?: Position;
}

export function InputHandle({ portSpec, position = Position.Top }: InputHandleProps) {
  return (
    <Handle
      type="target"
      position={position}
      id={portSpec.id}
      data-port-id={portSpec.id}
      aria-label={portSpec.label}
      className={`port-handle port-type-${portSpec.dataType}`}
    />
  );
}
