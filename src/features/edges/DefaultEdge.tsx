import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useEdgeExecutionState } from "@/features/execution/useEdgeExecutionState";

const ARROW_MARKER_ID = "default-edge-arrow";
const MAX_LABEL_LENGTH = 20;

function truncateLabel(text: string): string {
  if (text.length <= MAX_LABEL_LENGTH) return text;
  return `${text.slice(0, MAX_LABEL_LENGTH)}…`;
}

export function DefaultEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  data,
}: EdgeProps) {
  const edgeExecState = useEdgeExecutionState(id);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  // Use top-level label prop (from WorkflowEdge.label) as primary, fallback to data.label
  const rawLabel = label ?? data?.label;
  const labelText = typeof rawLabel === "string" ? rawLabel : undefined;

  return (
    <g data-testid="default-edge" data-edge-id={id} data-edge-status={edgeExecState?.status}>
      <defs>
        <marker
          id={ARROW_MARKER_ID}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 12 6 L 0 12 z" fill="currentColor" />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd ?? `url(#${ARROW_MARKER_ID})`}
        style={style}
      />
      {labelText && (
        <EdgeLabelRenderer>
          <div
            data-testid="edge-label"
            title={labelText}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${String(labelX)}px, ${String(labelY)}px)`,
              pointerEvents: "all",
              fontSize: 12,
              background: "white",
              padding: "2px 6px",
              borderRadius: 4,
              border: "1px solid #e2e8f0",
            }}
          >
            {truncateLabel(labelText)}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}

DefaultEdge.ARROW_MARKER_ID = ARROW_MARKER_ID;
DefaultEdge.MAX_LABEL_LENGTH = MAX_LABEL_LENGTH;
