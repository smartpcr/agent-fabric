import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";
import { InputHandle } from "@/features/nodes/ports/InputHandle";
import { OutputHandle } from "@/features/nodes/ports/OutputHandle";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";
import type { PortSpec } from "@/domain/models/port";

interface TaskData {
  readonly name: string;
}

function portPosition(port: PortSpec): Position {
  return port.kind === "in" ? Position.Top : Position.Bottom;
}

export function TaskNode({ id, data, type, selected }: NodeProps) {
  const taskData = data as TaskData;
  const spec = useWorkflowStore((s) => selectNodeSpec(s, type ?? "task"));
  const openInspector = useWorkflowStore((s) => s.openInspector);
  const selectNode = useWorkflowStore((s) => s.select);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const icon = spec?.icon ?? "cog";
  const ports = spec?.ports;

  return (
    <BaseNode
      title={taskData.name}
      icon={icon}
      selected={selected}
      nodeId={id}
      onEnter={() => {
        openInspector(id);
      }}
      onNodeFocus={() => {
        selectNode(id, "replace");
      }}
      onDelete={deleteSelected}
    >
      {ports && ports.length > 0 ? (
        ports.map((port) =>
          port.kind === "out" ? (
            <OutputHandle
              key={port.id}
              portSpec={port}
              position={portPosition(port)}
              nodeId={id}
              data-testid={`task-handle-${port.id}`}
            />
          ) : (
            <InputHandle
              key={port.id}
              portSpec={port}
              position={portPosition(port)}
              nodeId={id}
              data-testid={`task-handle-${port.id}`}
            />
          ),
        )
      ) : (
        <>
          <Handle type="target" position={Position.Top} data-testid="task-handle-top" />
          <Handle type="source" position={Position.Bottom} data-testid="task-handle-bottom" />
        </>
      )}
    </BaseNode>
  );
}
