import { Repeat } from "lucide-react";

export interface IterationBadgeProps {
  /** Current iteration (1-based). Undefined or absent means the node is not a loop. */
  readonly iteration?: number;
  /** Total expected iterations. When undefined, only the current iteration is shown. */
  readonly total?: number;
}

const BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "11px",
  fontWeight: 500,
  lineHeight: 1,
  padding: "2px 6px",
  borderRadius: "4px",
  color: "#6b7280",
};

/**
 * IterationBadge shows the current loop iteration for a node.
 * Renders `N / total` when total is known, otherwise just `N`.
 * Returns null when `iteration` is undefined (node is not a loop).
 */
export function IterationBadge({ iteration, total }: IterationBadgeProps) {
  if (iteration === undefined) {
    return null;
  }

  const iterStr = String(iteration);
  const text = total === undefined ? iterStr : `${iterStr} / ${String(total)}`;
  const label =
    total === undefined ? `Iteration ${iterStr}` : `Iteration ${iterStr} of ${String(total)}`;

  return (
    <span role="status" aria-label={label} data-testid="iteration-badge" style={BADGE_STYLE}>
      <Repeat size={12} aria-hidden={true} data-testid="iteration-icon" />
      <span data-testid="iteration-text">{text}</span>
    </span>
  );
}
