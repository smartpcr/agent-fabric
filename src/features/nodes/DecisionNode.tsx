import { Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";
import { InputHandle } from "@/features/nodes/ports/InputHandle";
import { OutputHandle } from "@/features/nodes/ports/OutputHandle";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";

interface DecisionData {
  readonly condition?: string;
  readonly branches?: ReadonlyArray<{ label: string; condition: string }>;
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

const BRANCH_LABEL_STYLE: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  color: "#1d4ed8",
  pointerEvents: "none",
  whiteSpace: "nowrap",
};

/**
 * Compute evenly spaced Y-position percentages for N output handles along the right edge.
 * Returns values in [0..100] percent range.
 */
function evenlySpacedPositions(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [50];
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    positions.push((100 * (i + 1)) / (count + 1));
  }
  return positions;
}

export function DecisionNode({ id, data, type, selected }: NodeProps) {
  const decisionData = data as DecisionData;
  const spec = useWorkflowStore((s) => selectNodeSpec(s, type ?? "decision"));
  const openInspector = useWorkflowStore((s) => s.openInspector);
  const selectNode = useWorkflowStore((s) => s.select);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const icon = spec?.icon ?? "git-branch";
  const variant = spec?.variant ?? "if-else";
  const isSwitch = variant === "switch";

  const inPort = spec?.ports.find((p) => p.kind === "in");

  if (isSwitch) {
    // Switch variant: render N branch handles + default on right side, evenly spaced
    const outputPorts = spec?.ports.filter((p) => p.kind === "out") ?? [];
    const positions = evenlySpacedPositions(outputPorts.length);
    const nodeHeight = Math.max(100, outputPorts.length * 32 + 40);

    return (
      <div
        style={{ position: "relative", width: "180px", height: `${String(nodeHeight)}px` }}
        data-testid="decision-node-wrapper"
        data-variant="switch"
      >
        {/* Diamond background */}
        <svg
          viewBox={`0 0 180 ${String(nodeHeight)}`}
          style={DIAMOND_STYLE}
          data-testid="decision-diamond"
          aria-hidden="true"
        >
          <polygon
            points={`90,4 176,${String(nodeHeight / 2)} 90,${String(nodeHeight - 4)} 4,${String(nodeHeight / 2)}`}
            fill="#dbeafe"
            stroke="#2563eb"
            strokeWidth="2"
          />
        </svg>

        <BaseNode
          title="Switch"
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
          <div
            data-testid="condition-preview"
            style={{
              fontSize: "11px",
              color: "#1e3a5f",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "140px",
              margin: "0 auto",
            }}
          >
            {outputPorts.length - 1} branches
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

        {/* Branch output handles on right, evenly spaced */}
        {outputPorts.map((port, idx) => (
          <div
            key={port.id}
            style={{
              position: "absolute",
              right: 0,
              top: `${String(positions[idx])}%`,
              transform: "translateY(-50%)",
            }}
            data-testid={`switch-branch-${port.id}`}
            data-branch-index={idx}
            data-branch-position={positions[idx].toFixed(1)}
          >
            <OutputHandle
              portSpec={port}
              position={Position.Right}
              nodeId={id}
              data-testid={`decision-handle-${port.id}`}
            />
            <span style={BRANCH_LABEL_STYLE} data-testid={`decision-label-${port.id}`}>
              {port.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // If-else variant (original behavior)
  const truePort = spec?.ports.find((p) => p.kind === "out" && p.id === "true");
  const falsePort = spec?.ports.find((p) => p.kind === "out" && p.id === "false");

  const condition = decisionData.condition ?? "";
  const conditionPreview = condition ? truncateCondition(condition) : "—";

  return (
    <div
      style={{ position: "relative", width: "160px", height: "100px" }}
      data-testid="decision-node-wrapper"
      data-variant="if-else"
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
            true
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
            false
          </span>
        </>
      ) : null}
    </div>
  );
}
