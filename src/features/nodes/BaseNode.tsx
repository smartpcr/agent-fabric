import type { ReactNode } from "react";
import { icons } from "lucide-react";

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

export interface BaseNodeProps {
  /** Display title in the header */
  readonly title: string;
  /** Lucide icon name (kebab-case, e.g. "play" or "circle-check") */
  readonly icon: string;
  /** Whether the node is currently selected */
  readonly selected?: boolean;
  /** Body content rendered below the header */
  readonly children?: ReactNode;
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

export function BaseNode({ title, icon, selected = false, children }: BaseNodeProps) {
  /* eslint-disable jsx-a11y/role-supports-aria-props, jsx-a11y/no-noninteractive-tabindex */
  return (
    <div
      role="group"
      aria-label={title}
      aria-selected={selected}
      data-selected={selected}
      data-testid="base-node"
      tabIndex={0}
      style={{
        ...OUTER_STYLE,
        border: selected ? SELECTED_BORDER : OUTER_STYLE.border,
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = FOCUS_RING;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = "";
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
    </div>
  );
  /* eslint-enable jsx-a11y/role-supports-aria-props, jsx-a11y/no-noninteractive-tabindex */
}
