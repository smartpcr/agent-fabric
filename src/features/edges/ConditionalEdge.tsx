import { EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { DefaultEdge } from "@/features/edges/DefaultEdge";

/**
 * Placeholder edge for conditional connections.
 * Renders a DefaultEdge with a "conditional" label chip overlay.
 * Full implementation comes in Phase 4.
 */
export function ConditionalEdge(props: EdgeProps) {
  return (
    <>
      <DefaultEdge {...props} />
      <EdgeLabelRenderer>
        <div
          data-testid="conditional-chip"
          style={{
            position: "absolute",
            transform: "translate(-50%, 8px)",
            pointerEvents: "all",
            fontSize: 10,
            fontWeight: 600,
            background: "#fef3c7",
            color: "#92400e",
            padding: "1px 6px",
            borderRadius: 8,
            border: "1px solid #fcd34d",
          }}
        >
          conditional
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
