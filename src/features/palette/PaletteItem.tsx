import { useMemo } from "react";
import { icons, GripVertical } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { useDragStart } from "@/features/palette/useDragStart";

interface PaletteItemProps {
  readonly spec: NodeSpec;
  readonly disabled?: boolean;
  readonly style?: React.CSSProperties;
}

function resolveIconName(name: string): string {
  return name
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function PaletteIcon({ name }: { readonly name: string }) {
  const pascalName = resolveIconName(name);
  if (!(pascalName in icons)) return null;
  const Icon = icons[pascalName as keyof typeof icons];
  return <Icon size={16} aria-hidden="true" />;
}

export function PaletteItem({ spec, disabled = false, style }: PaletteItemProps) {
  const description = useMemo(() => `${spec.category} — ${spec.kind}`, [spec.category, spec.kind]);
  const { onPointerDown } = useDragStart({ kind: spec.kind, disabled });

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div
            role="option"
            aria-selected={false}
            aria-disabled={disabled}
            aria-label={spec.label}
            tabIndex={disabled ? -1 : 0}
            data-kind={spec.kind}
            onPointerDown={onPointerDown}
            style={{
              ...style,
              padding: "4px 8px",
              cursor: disabled ? "not-allowed" : "grab",
              opacity: disabled ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxSizing: "border-box",
            }}
          >
            <GripVertical
              size={14}
              aria-hidden="true"
              data-testid="drag-handle"
              style={{
                flexShrink: 0,
                color: disabled ? "inherit" : "#888",
                cursor: disabled ? "not-allowed" : "grab",
              }}
            />
            <PaletteIcon name={spec.icon} />
            <span>{spec.label}</span>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="right" sideOffset={8}>
            {description}
            <Tooltip.Arrow />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
