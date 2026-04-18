import { useState, useEffect } from "react";
import { Clock, Loader2, CheckCircle2, XCircle, SkipForward } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
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
  /** Error message to display in tooltip when status is "error". */
  readonly errorMessage?: string;
  /** Called when the error badge is clicked (opens inspector). */
  readonly onErrorClick?: () => void;
}

/** Maximum number of characters shown in the error tooltip. */
const ERROR_TOOLTIP_MAX_CHARS = 200;

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

const CLICKABLE_STYLE: React.CSSProperties = {
  cursor: "pointer",
};

const TOOLTIP_CONTENT_STYLE: React.CSSProperties = {
  maxWidth: "260px",
  padding: "6px 10px",
  borderRadius: "6px",
  fontSize: "12px",
  lineHeight: 1.4,
  color: "#fff",
  background: "#1f2937",
  wordBreak: "break-word",
};

function truncateErrorMessage(message: string): string {
  if (message.length <= ERROR_TOOLTIP_MAX_CHARS) {
    return message;
  }
  return `${message.slice(0, ERROR_TOOLTIP_MAX_CHARS)}…`;
}

/**
 * StatusBadge renders an icon + text label for each of 5 execution states.
 * Includes `role="status"` and an `aria-label` describing the state for
 * accessibility.
 *
 * When status is "error" and an `errorMessage` is provided, a Radix tooltip
 * shows the first 200 characters of the error. Clicking the badge calls
 * `onErrorClick` (typically to open the inspector).
 */
export function StatusBadge({ status, errorMessage, onErrorClick }: StatusBadgeProps) {
  const label = LABEL_MAP[status];
  const Icon = ICON_MAP[status];
  const color = COLOR_MAP[status];
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldSpin = status === "running" && !prefersReducedMotion;

  const isError = status === "error";
  const hasTooltip = isError && errorMessage !== undefined && errorMessage.length > 0;

  const handleClick = isError && onErrorClick !== undefined ? onErrorClick : undefined;
  const isClickable = handleClick !== undefined;
  const handleKeyDown = isClickable
    ? (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }
    : undefined;

  /* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  const badge = (
    <span
      role="status"
      aria-label={label}
      data-testid="status-badge"
      data-status={status}
      tabIndex={isClickable ? 0 : undefined}
      style={{
        ...BADGE_STYLE,
        color,
        ...(isClickable ? CLICKABLE_STYLE : {}),
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
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
  /* eslint-enable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */

  if (!hasTooltip) {
    return badge;
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{badge}</Tooltip.Trigger>
        <Tooltip.Portal container={document.getElementById("portal-root") ?? undefined}>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            data-testid="error-tooltip"
            style={TOOLTIP_CONTENT_STYLE}
          >
            {truncateErrorMessage(errorMessage)}
            <Tooltip.Arrow />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
