import { useRef, useCallback, useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useWorkflowStore } from "@/store/hooks";
import { PaletteCategory } from "@/features/palette/PaletteCategory";
import type { NodeSpec } from "@/domain/models/nodeSpec";

interface CategoryGroup {
  readonly category: string;
  readonly specs: NodeSpec[];
}

function groupByCategory(specs: readonly NodeSpec[]): CategoryGroup[] {
  const map = new Map<string, NodeSpec[]>();
  for (const spec of specs) {
    const list = map.get(spec.category);
    if (list) {
      list.push(spec);
    } else {
      map.set(spec.category, [spec]);
    }
  }
  return Array.from(map.entries()).map(([category, items]) => ({
    category,
    specs: items,
  }));
}

type FlatRow =
  | { readonly type: "category"; readonly category: string }
  | { readonly type: "item"; readonly spec: NodeSpec; readonly category: string };

function flattenGroups(groups: CategoryGroup[], collapsed: Set<string>): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const group of groups) {
    rows.push({ type: "category", category: group.category });
    if (!collapsed.has(group.category)) {
      for (const spec of group.specs) {
        rows.push({ type: "item", spec, category: group.category });
      }
    }
  }
  return rows;
}

export function Palette() {
  const registry = useWorkflowStore((s) => s.registry);
  const specs = useMemo(() => registry.list(), [registry]);
  const groups = useMemo(() => groupByCategory(specs), [specs]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const rows = useMemo(() => flattenGroups(groups, collapsed), [groups, collapsed]);

  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 5,
  });

  const toggleCategory = useCallback((category: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next["delete"](category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const container = e.currentTarget;
    const options = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
    const currentIndex = options.indexOf(target);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextEl = options[currentIndex + 1];
      if (nextEl) {
        nextEl.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevEl = options[currentIndex - 1];
      if (prevEl) {
        prevEl.focus();
      }
    }
  }, []);

  return (
    <div
      role="complementary"
      aria-label="Node Palette"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <div
        ref={parentRef}
        role="listbox"
        aria-label="Node types"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          overflow: "auto",
        }}
      >
        <div
          style={{
            height: `${String(virtualizer.getTotalSize())}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;

            if (row.type === "category") {
              return (
                <div
                  key={`cat-${row.category}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${String(virtualRow.size)}px`,
                    transform: `translateY(${String(virtualRow.start)}px)`,
                  }}
                >
                  <PaletteCategory
                    category={row.category}
                    defaultExpanded={!collapsed.has(row.category)}
                    onToggle={() => {
                      toggleCategory(row.category);
                    }}
                  />
                </div>
              );
            }

            const { spec } = row;
            return (
              <div
                key={`item-${spec.kind}`}
                role="option"
                aria-selected={false}
                tabIndex={0}
                data-kind={spec.kind}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${String(virtualRow.size)}px`,
                  transform: `translateY(${String(virtualRow.start)}px)`,
                  padding: "4px 8px 4px 24px",
                  cursor: "grab",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxSizing: "border-box",
                }}
              >
                {spec.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
