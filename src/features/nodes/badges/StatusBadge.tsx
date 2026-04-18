import { useState, useEffect } from "react";
import { Clock, Loader2, CheckCircle2, XCircle, SkipForward } from "lucide-react";
import "@/styles/animations.css";

// ─── Reduced-motion detection ────────────────────────────────────────

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getMatchMediaResult(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(query).matches;
}

function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() =>
    getMatchMediaResult(REDUCED_MOTION_QUERY),
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    const handler = (e: MediaQueryListEvent) => {
      setPrefersReduced(e.matches);
    };
    mql.addEventListener("change", handler);
    return () => {
      mql.removeEventListener("change", handler);
    };
  }, []);

  return prefersReduced;
}

/** The five possible execution states for a node's status badge. */
export type BadgeStatus = "pending" | "running" | "success" | "error" | "skipped";

export interface StatusBadgeProps {
  /** Current execution status of the node. */
  readonly status: BadgeStatus;
}

const LABEL_MAP: Record<BadgeStatus, string> = {
  pending: "Pending",
  running: "Running",
  success: "Succeeded",
  error: "Failed",
  skipped: "Skipped",
};

const ICON_MAP: Record<
  BadgeStatus,
  React.ComponentType<{
    size?: number;
    "aria-hidden"?: boolean;
    "data-testid"?: string;
    className?: string;
  }>
> = {
  pending: Clock,
  running: Loader2,
  success: CheckCircle2,
  error: XCircle,
  skipped: SkipForward,
};

const COLOR_MAP: Record<BadgeStatus, string> = {
  pending: "#6b7280",
  running: "#3b82f6",
  success: "#22c55e",
  error: "#ef4444",
  skipped: "#a1a1aa",
};

const BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "11px",
  fontWeight: 500,
  lineHeight: 1,
  padding: "2px 6px",
  borderRadius: "4px",
};

/**
 * StatusBadge renders an icon + text label for each of 5 execution states.
 * Includes `role="status"` and an `aria-label` describing the state for
 * accessibility.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const label = LABEL_MAP[status];
  const Icon = ICON_MAP[status];
  const color = COLOR_MAP[status];
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldSpin = status === "running" && !prefersReducedMotion;

  return (
    <span
      role="status"
      aria-label={label}
      data-testid="status-badge"
      data-status={status}
      style={{ ...BADGE_STYLE, color }}
    >
      <Icon
        size={12}
        aria-hidden={true}
        data-testid={`badge-icon-${status}`}
        className={shouldSpin ? "badge-spin" : undefined}
      />
      <span data-testid="badge-label">{label}</span>
    </span>
  );
}
