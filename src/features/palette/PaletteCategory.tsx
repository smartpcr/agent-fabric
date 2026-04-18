import type { ReactNode } from "react";

interface PaletteCategoryProps {
  readonly category: string;
  readonly children?: ReactNode;
  readonly defaultExpanded?: boolean;
  readonly onToggle?: () => void;
}

export function PaletteCategory({
  category,
  children,
  defaultExpanded = true,
  onToggle,
}: PaletteCategoryProps) {
  return (
    <div data-testid={`palette-category-${category}`}>
      <button
        type="button"
        aria-expanded={defaultExpanded}
        onClick={onToggle}
        tabIndex={0}
        style={{
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "none",
          padding: "4px 8px",
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <span aria-hidden="true">{defaultExpanded ? "▾" : "▸"}</span>
        {category}
      </button>
      {defaultExpanded && children}
    </div>
  );
}
