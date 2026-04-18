import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";

const MAX_CONDITION_LENGTH = 20;

function truncateCondition(text: string): string {
  if (text.length <= MAX_CONDITION_LENGTH) return text;
  return `${text.slice(0, MAX_CONDITION_LENGTH)}…`;
}

/**
 * Edge component for conditional connections (decision/switch branches).
 * Renders a bezier path with a pill-shaped chip showing the condition expression.
 * Hover tooltip shows the full condition text when truncated.
 * Empty or missing conditions display "—".
 */
export function ConditionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const condition = typeof data?.condition === "string" ? data.condition : "";
  const displayText = condition ? truncateCondition(condition) : "—";
  const hasCondition = condition.length > 0;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: hasCondition ? "#2563eb" : "#9ca3af",
          strokeWidth: 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          data-testid="conditional-chip"
          title={hasCondition ? condition : undefined}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${String(labelX)}px, ${String(labelY)}px)`,
            pointerEvents: "all",
            fontSize: 10,
            fontWeight: 600,
            background: hasCondition ? "#dbeafe" : "#f3f4f6",
            color: hasCondition ? "#1e40af" : "#6b7280",
            padding: "2px 8px",
            borderRadius: 9999,
            border: `1px solid ${hasCondition ? "#93c5fd" : "#d1d5db"}`,
            whiteSpace: "nowrap",
          }}
        >
          {displayText}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
