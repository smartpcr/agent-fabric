import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { icons } from "lucide-react";
import { useDragContext } from "@/features/palette/DragContext";
import { useWorkflowStore } from "@/store/hooks";

function resolveIconName(name: string): string {
  return name
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function GhostIcon({ name }: { readonly name: string }) {
  const pascalName = resolveIconName(name);
  if (!(pascalName in icons)) return null;
  const Icon = icons[pascalName as keyof typeof icons];
  return <Icon size={16} aria-hidden="true" />;
}

const GHOST_STYLE: React.CSSProperties = {
  position: "fixed",
  pointerEvents: "none",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 10px",
  borderRadius: "4px",
  background: "rgba(59, 130, 246, 0.9)",
  color: "#fff",
  fontSize: "13px",
  fontWeight: 500,
  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
  whiteSpace: "nowrap",
};

const OFFSET_X = 12;
const OFFSET_Y = 12;

export function DragGhost() {
  const { state } = useDragContext();
  const registry = useWorkflowStore((s) => s.registry);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!state.isDragging) return;

    const onMove = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
    };
  }, [state.isDragging]);

  if (!state.isDragging || !state.payload) return null;

  const spec = registry.get(state.payload.kind);
  const label = spec?.label ?? state.payload.kind;
  const iconName = spec?.icon ?? "";

  return createPortal(
    <div
      data-testid="drag-ghost"
      style={{
        ...GHOST_STYLE,
        left: pos.x + OFFSET_X,
        top: pos.y + OFFSET_Y,
      }}
    >
      <GhostIcon name={iconName} />
      <span>{label}</span>
    </div>,
    document.body,
  );
}
