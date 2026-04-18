import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import "./edgeAnimations.css";

const LOOP_ARROW_MARKER_ID = "loop-back-edge-arrow";

/**
 * Build a curved path that routes around the loop body from body-out back to body-in.
 * The path curves outward (to the right and down) before arcing back upward.
 */
function buildLoopBackPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): [string, number, number] {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;

  // Offset determines how far the curve extends outward
  const offset = Math.max(60, Math.abs(dy) * 0.5, Math.abs(dx) * 0.3);

  // Control points route the curve around the body to the right
  const cx1 = sourceX + offset;
  const cy1 = sourceY;
  const cx2 = targetX + offset;
  const cy2 = targetY;

  const path = `M ${String(sourceX)} ${String(sourceY)} C ${String(cx1)} ${String(cy1)}, ${String(cx2)} ${String(cy2)}, ${String(targetX)} ${String(targetY)}`;

  // Label position at the midpoint of the curve (shifted outward)
  const labelX = (sourceX + targetX) / 2 + offset * 0.5;
  const labelY = (sourceY + targetY) / 2;

  return [path, labelX, labelY];
}

export function LoopBackEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  label,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = buildLoopBackPath(sourceX, sourceY, targetX, targetY);

  const rawLabel = label ?? data?.label ?? "loop";
  const labelText = typeof rawLabel === "string" ? rawLabel : "loop";

  return (
    <>
      <defs>
        <marker
          id={LOOP_ARROW_MARKER_ID}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 12 6 L 0 12 z" fill="#6366f1" />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd ?? `url(#${LOOP_ARROW_MARKER_ID})`}
        style={{
          ...style,
          stroke: "#6366f1",
          strokeWidth: 2,
          strokeDasharray: "6 4",
        }}
        className="loop-back-edge"
      />
      <EdgeLabelRenderer>
        <div
          data-testid="loop-back-label"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${String(labelX)}px, ${String(labelY)}px)`,
            pointerEvents: "all",
            fontSize: 10,
            fontWeight: 600,
            fontStyle: "italic",
            background: "#eef2ff",
            color: "#4338ca",
            padding: "2px 8px",
            borderRadius: 9999,
            border: "1px solid #a5b4fc",
            whiteSpace: "nowrap",
          }}
        >
          {labelText}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

LoopBackEdge.ARROW_MARKER_ID = LOOP_ARROW_MARKER_ID;
