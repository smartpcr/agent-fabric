import { memo } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { BaseNode } from "@/features/nodes/BaseNode";
import { OutputHandle } from "@/features/nodes/ports/OutputHandle";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";

export const StartNode = memo(function StartNode({ id, selected, type }: NodeProps) {
  const { t } = useTranslation();
  const spec = useWorkflowStore((s) => selectNodeSpec(s, type ?? "start"));
  const openInspector = useWorkflowStore((s) => s.openInspector);
  const selectNode = useWorkflowStore((s) => s.select);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const outPort = spec?.ports.find((p) => p.kind === "out");
  return (
    <BaseNode
      title={t("nodes.start")}
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
});
