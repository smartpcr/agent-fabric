import { Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";
import { OutputHandle } from "@/features/nodes/ports/OutputHandle";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";

export function StartNode({ id, selected, type }: NodeProps) {
  const spec = useWorkflowStore((s) => selectNodeSpec(s, type ?? "start"));
  const openInspector = useWorkflowStore((s) => s.openInspector);
  const selectNode = useWorkflowStore((s) => s.select);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const outPort = spec?.ports.find((p) => p.kind === "out");
  return (
    <BaseNode
      title="Start"
      icon="play"
      selected={selected}
      borderRadius="9999px"
      nodeId={id}
      onEnter={() => {
        openInspector(id);
      }}
      onNodeFocus={() => {
        selectNode(id, "replace");
      }}
      onDelete={deleteSelected}
    >
      {outPort ? (
        <OutputHandle
          portSpec={outPort}
          position={Position.Bottom}
          nodeId={id}
          data-testid="start-handle-bottom"
        />
      ) : null}
    </BaseNode>
  );
}
