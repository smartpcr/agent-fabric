import { Handle, Position } from "@xyflow/react";
import type { PortSpec } from "@/domain/models/port";
import { useWorkflowStore } from "@/store/hooks";
import { selectIsPortMissing } from "@/store/selectors/graphSelectors";

export interface InputHandleProps {
  readonly portSpec: PortSpec;
  readonly position?: Position;
  readonly nodeId?: string;
  readonly "data-testid"?: string;
}

export function InputHandle({
  portSpec,
  position = Position.Top,
  nodeId,
  "data-testid": testId,
}: InputHandleProps) {
  const isMissing = useWorkflowStore((state) =>
    nodeId ? selectIsPortMissing(state, nodeId, portSpec.id, portSpec.required) : false,
  );

  return (
    <Handle
      type="target"
      position={position}
      id={portSpec.id}
      data-testid={testId}
      data-port-id={portSpec.id}
      data-missing={isMissing ? "true" : undefined}
      aria-label={portSpec.label}
      className={`port-handle port-type-${portSpec.dataType}`}
    />
  );
}
