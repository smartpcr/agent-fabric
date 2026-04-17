import { useCallback, useEffect } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { Canvas } from "@/features/canvas/Canvas";
import { Palette } from "@/features/palette/Palette";
import { PropertyGrid } from "@/features/property-grid/PropertyGrid";

const PALETTE_DEFAULT_SIZE = 15;
const PALETTE_MIN_SIZE = 10;
const CANVAS_MIN_SIZE = 40;
const PROPERTY_GRID_DEFAULT_SIZE = 20;
const PROPERTY_GRID_MIN_SIZE = 10;

export function EditorLayout() {
  const paletteRef = usePanelRef();

  const togglePalette = useCallback(() => {
    const panel: PanelImperativeHandle | null = paletteRef.current;
    if (!panel) return;

    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [paletteRef]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "\\") {
        event.preventDefault();
        togglePalette();
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [togglePalette]);

  return (
    <Group orientation="horizontal" style={{ width: "100%", height: "100%" }}>
      <Panel
        panelRef={paletteRef}
        defaultSize={PALETTE_DEFAULT_SIZE}
        minSize={PALETTE_MIN_SIZE}
        collapsible
      >
        <Palette />
      </Panel>

      <Separator
        className="editor-resize-handle"
        style={{
          width: "4px",
          background: "var(--color-border)",
          cursor: "col-resize",
        }}
      />

      <Panel defaultSize={100 - PALETTE_DEFAULT_SIZE - PROPERTY_GRID_DEFAULT_SIZE} minSize={CANVAS_MIN_SIZE}>
        <Canvas />
      </Panel>

      <Separator
        className="editor-resize-handle"
        style={{
          width: "4px",
          background: "var(--color-border)",
          cursor: "col-resize",
        }}
      />

      <Panel defaultSize={PROPERTY_GRID_DEFAULT_SIZE} minSize={PROPERTY_GRID_MIN_SIZE} collapsible>
        <PropertyGrid />
      </Panel>
    </Group>
  );
}
