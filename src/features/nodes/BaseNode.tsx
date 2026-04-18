import type { ReactNode } from "react";
import { icons } from "lucide-react";
import { useExecutionState } from "@/features/execution/useExecutionState";
import { useWorkflowStore } from "@/store/hooks";
import { StatusBadge, type BadgeStatus } from "@/features/nodes/badges/StatusBadge";
import { IterationBadge } from "@/features/nodes/badges/IterationBadge";
import type { NodeExecutionStatus } from "@/store/slices/executionSlice";

function resolveIconName(name: string): string {
  return name
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function NodeIcon({ name }: { readonly name: string }) {
  const pascalName = resolveIconName(name);
  if (!(pascalName in icons)) return null;
  const Icon = icons[pascalName as keyof typeof icons];
  return <Icon size={16} aria-hidden="true" data-testid="node-icon" />;
}

/** Map store execution status to the badge's display status. */
const STATUS_TO_BADGE: Record<NodeExecutionStatus, BadgeStatus> = {
  idle: "pending",
  running: "running",
  succeeded: "success",
  failed: "error",
  skipped: "skipped",
};

export interface BaseNodeProps {
  /** Node ID for keyboard interactions */
  readonly nodeId?: string;
  /** Display title in the header */
  readonly title: string;
  /** Lucide icon name (kebab-case, e.g. "play" or "circle-check") */
  readonly icon: string;
  /** Whether the node is currently selected */
  readonly selected?: boolean;
  /** Body content rendered below the header */
  readonly children?: ReactNode;
  /** Override border-radius (e.g. "9999px" for pill shape) */
  readonly borderRadius?: string;
  /** Callback when Enter is pressed on this node */
  readonly onEnter?: () => void;
  /** Callback when Delete/Backspace is pressed on this node */
  readonly onDelete?: () => void;
  /** Callback when the node receives focus (e.g., via Tab) */
  readonly onNodeFocus?: () => void;
}

const OUTER_STYLE: React.CSSProperties = {
  borderRadius: "8px",
  border: "2px solid transparent",
  background: "#fff",
  minWidth: "140px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
  outline: "none",
};

const SELECTED_BORDER = "2px solid #3b82f6";

const FOCUS_RING = "0 0 0 3px rgba(59,130,246,0.4)";

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 10px",
  borderBottom: "1px solid #e5e7eb",
  fontWeight: 600,
  fontSize: "13px",
};

const BODY_STYLE: React.CSSProperties = {
  padding: "8px 10px",
};

const BADGE_CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 10px",
  borderTop: "1px solid #e5e7eb",
};

export function BaseNode({
  nodeId,
  title,
  icon,
  selected = false,
  children,
  borderRadius,
  onEnter,
  onNodeFocus,
  onDelete,
}: BaseNodeProps) {
  const execState = useExecutionState(nodeId ?? "");
  const openInspector = useWorkflowStore((s) => s.openInspector);
  const hasNodeId = nodeId !== undefined;
  const badgeStatus =
    hasNodeId && execState !== undefined ? STATUS_TO_BADGE[execState.status] : undefined;

  /* eslint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */
  return (
    <div
      role="group"
      aria-label={title}
      data-selected={selected}
      data-testid="base-node"
      data-node-id={nodeId}
      tabIndex={0}
      style={{
        ...OUTER_STYLE,
        border: selected ? SELECTED_BORDER : OUTER_STYLE.border,
        ...(borderRadius === undefined ? {} : { borderRadius }),
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = FOCUS_RING;
        onNodeFocus?.();
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = "";
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) {
          onEnter();
        } else if ((e.key === "Delete" || e.key === "Backspace") && onDelete) {
          e.preventDefault();
          onDelete();
        }
      }}
    >
      <div data-testid="node-header" style={HEADER_STYLE}>
        <NodeIcon name={icon} />
        <span>{title}</span>
      </div>
      {children !== undefined && children !== null && (
        <div data-testid="node-body" style={BODY_STYLE}>
          {children}
        </div>
      )}
      {badgeStatus !== undefined && (
        <div data-testid="node-badges" style={BADGE_CONTAINER_STYLE}>
          <StatusBadge
            status={badgeStatus}
            errorMessage={execState?.error}
            onErrorClick={
              hasNodeId && badgeStatus === "error"
                ? () => {
                    openInspector(nodeId);
                  }
                : undefined
            }
          />
          <IterationBadge iteration={execState?.iteration} total={execState?.totalIterations} />
        </div>
      )}
    </div>
  );
  /* eslint-enable jsx-a11y/role-supports-aria-props, jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */
}
