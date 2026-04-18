import { Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";
import { InputHandle } from "@/features/nodes/ports/InputHandle";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";

export function EndNode({ id, selected, type }: NodeProps) {
  const spec = useWorkflowStore((s) => selectNodeSpec(s, type ?? "end"));
  const openInspector = useWorkflowStore((s) => s.openInspector);
  const selectNode = useWorkflowStore((s) => s.select);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const inPort = spec?.ports.find((p) => p.kind === "in");
  return (
    <BaseNode
      title="End"
      icon="square"
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
      {inPort ? (
        <InputHandle
          portSpec={inPort}
          position={Position.Top}
          nodeId={id}
          data-testid="end-handle-top"
        />
      ) : null}
    </BaseNode>
  );
}
