import { Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";
import { InputHandle } from "@/features/nodes/ports/InputHandle";
import { OutputHandle } from "@/features/nodes/ports/OutputHandle";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";

interface DecisionData {
  readonly condition?: string;
}

const MAX_CONDITION_LENGTH = 24;

function truncateCondition(condition: string): string {
  if (condition.length <= MAX_CONDITION_LENGTH) return condition;
  return `${condition.slice(0, MAX_CONDITION_LENGTH - 1)}…`;
}

const DIAMOND_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
};

const LABEL_STYLE: React.CSSProperties = {
  position: "absolute",
  fontSize: "10px",
  fontWeight: 600,
  color: "#16a34a",
  pointerEvents: "none",
  whiteSpace: "nowrap",
};

const FALSE_LABEL_STYLE: React.CSSProperties = {
  ...LABEL_STYLE,
  color: "#dc2626",
};

export function DecisionNode({ id, data, type, selected }: NodeProps) {
  const decisionData = data as DecisionData;
  const spec = useWorkflowStore((s) => selectNodeSpec(s, type ?? "decision"));
  const openInspector = useWorkflowStore((s) => s.openInspector);
  const selectNode = useWorkflowStore((s) => s.select);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const icon = spec?.icon ?? "git-branch";
  const inPort = spec?.ports.find((p) => p.kind === "in");
  const truePort = spec?.ports.find((p) => p.kind === "out" && p.id === "true");
  const falsePort = spec?.ports.find((p) => p.kind === "out" && p.id === "false");

  const condition = decisionData.condition ?? "";
  const conditionPreview = condition ? truncateCondition(condition) : "—";

  return (
    <div
      style={{ position: "relative", width: "160px", height: "100px" }}
      data-testid="decision-node-wrapper"
    >
      {/* Diamond background */}
      <svg
        viewBox="0 0 160 100"
        style={DIAMOND_STYLE}
        data-testid="decision-diamond"
        aria-hidden="true"
      >
        <polygon points="80,4 156,50 80,96 4,50" fill="#fef9c3" stroke="#ca8a04" strokeWidth="2" />
      </svg>

      <BaseNode
        title="Decision"
        icon={icon}
        selected={selected}
        nodeId={id}
        borderRadius="0px"
        onEnter={() => {
          openInspector(id);
        }}
        onNodeFocus={() => {
          selectNode(id, "replace");
        }}
        onDelete={deleteSelected}
      >
        {/* Condition preview */}
        <div
          data-testid="condition-preview"
          title={condition || undefined}
          style={{
            fontSize: "11px",
            color: "#713f12",
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "120px",
            margin: "0 auto",
          }}
        >
          {conditionPreview}
        </div>
      </BaseNode>

      {/* Input handle on left */}
      {inPort ? (
        <InputHandle
          portSpec={inPort}
          position={Position.Left}
          nodeId={id}
          data-testid="decision-handle-in"
        />
      ) : null}

      {/* True output handle on right */}
      {truePort ? (
        <>
          <OutputHandle
            portSpec={truePort}
            position={Position.Right}
            nodeId={id}
            data-testid="decision-handle-true"
          />
          <span
            data-testid="decision-label-true"
            style={{
              ...LABEL_STYLE,
              right: "-8px",
              top: "50%",
              transform: "translate(100%, -50%)",
            }}
          >
            T
          </span>
        </>
      ) : null}

      {/* False output handle on bottom */}
      {falsePort ? (
        <>
          <OutputHandle
            portSpec={falsePort}
            position={Position.Bottom}
            nodeId={id}
            data-testid="decision-handle-false"
          />
          <span
            data-testid="decision-label-false"
            style={{
              ...FALSE_LABEL_STYLE,
              bottom: "-8px",
              left: "50%",
              transform: "translate(-50%, 100%)",
            }}
          >
            F
          </span>
        </>
      ) : null}
    </div>
  );
}
