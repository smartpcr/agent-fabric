import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

const ARROW_MARKER_ID = "default-edge-arrow";

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
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
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
    </>
  );
}

DefaultEdge.ARROW_MARKER_ID = ARROW_MARKER_ID;
