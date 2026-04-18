import { memo, useRef, useState, useEffect } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useEdgeExecutionState } from "@/features/execution/useEdgeExecutionState";
import { usePrefersReducedMotion } from "@/features/edges/usePrefersReducedMotion";
import type { EdgeExecutionStatus } from "@/store/slices/executionSlice";
import "@/features/edges/edgeAnimations.css";

const ARROW_MARKER_ID = "default-edge-arrow";
const MAX_LABEL_LENGTH = 20;

/** Duration of flash animations in ms — must match CSS. */
const FLASH_DURATION_MS = 500;

/** Map terminal edge statuses to their flash CSS class. */
const FLASH_CLASS_MAP: Partial<Record<EdgeExecutionStatus, string>> = {
  taken: "edge-flash-success",
  succeeded: "edge-flash-success",
  failed: "edge-flash-error",
};

/**
 * Hook that detects edge status transitions and returns a one-shot flash
 * CSS class name. The class is set on transition to a flash-mapped status
 * and auto-cleared after `FLASH_DURATION_MS`.
 */
function useEdgeFlash(status: EdgeExecutionStatus | undefined): string | undefined {
  const [flashClass, setFlashClass] = useState<string | undefined>(undefined);
  const prevStatusRef = useRef<EdgeExecutionStatus | undefined>(undefined);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (prev === undefined) {
      return;
    }

    if (status !== undefined && status !== prev) {
      const cls = FLASH_CLASS_MAP[status];
      if (cls !== undefined) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: flash is derived from status transition
        setFlashClass(cls);
      }
    }
  }, [status]);

  // Auto-clear flash class after animation duration
  useEffect(() => {
    if (flashClass === undefined) {
      return;
    }
    const timer = setTimeout(() => {
      setFlashClass(undefined);
    }, FLASH_DURATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [flashClass]);

  return flashClass;
}

function truncateLabel(text: string): string {
  if (text.length <= MAX_LABEL_LENGTH) return text;
  return `${text.slice(0, MAX_LABEL_LENGTH)}…`;
}

const DefaultEdgeInner = memo(function DefaultEdge({
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
  const prefersReducedMotion = usePrefersReducedMotion();
  const isActive = edgeExecState?.status === "active";
  const flowClass = isActive && !prefersReducedMotion ? "edge-flow-active" : undefined;

  // ── Flash on success / error ────────────────────────────────────
  const flashClass = useEdgeFlash(edgeExecState?.status);

  // ── Not-taken dim ─────────────────────────────────────────────
  const isNotTaken = edgeExecState?.status === "not-taken";
  const notTakenClass = isNotTaken ? "edge-not-taken" : undefined;

  // Combine classes for BaseEdge
  const combinedClass =
    [flowClass, flashClass, notTakenClass].filter(Boolean).join(" ") || undefined;

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
        className={combinedClass}
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
});

export const DefaultEdge = Object.assign(DefaultEdgeInner, {
  ARROW_MARKER_ID,
  MAX_LABEL_LENGTH,
});
