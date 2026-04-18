import { useCallback, useEffect, useState } from "react";
import {
  Group,
  Panel,
  Separator,
  usePanelRef,
  type PanelImperativeHandle,
} from "react-resizable-panels";
import { Canvas } from "@/features/canvas/Canvas";
import { useGraphPersistence } from "@/features/canvas/useGraphPersistence";
import { ConnectedPalette } from "@/features/palette/ConnectedPalette";
import { PropertyGrid } from "@/features/property-grid/PropertyGrid";
import { Toolbar } from "@/features/editor/Toolbar";

/**
 * CSS grid baseline: 240px | 1fr | 320px
 * react-resizable-panels overrides column widths at runtime via percentage
 * defaults that approximate the grid contract.
 */
const EDITOR_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "240px 1fr 320px",
  width: "100%",
  height: "100%",
};

const PALETTE_DEFAULT_SIZE = 15;
const PALETTE_MIN_SIZE = 5;
const CANVAS_MIN_SIZE = 40;
const PROPERTY_GRID_DEFAULT_SIZE = 20;
const PROPERTY_GRID_MIN_SIZE = 5;

export function EditorLayout() {
  useGraphPersistence();
  const paletteRef = usePanelRef();
  const propertyGridRef = usePanelRef();
  const [sidePanelsCollapsed, setSidePanelsCollapsed] = useState(false);

  const toggleSidePanels = useCallback(() => {
    const palette: PanelImperativeHandle | null = paletteRef.current;
    const propertyGrid: PanelImperativeHandle | null = propertyGridRef.current;

    const bothCollapsed = palette?.isCollapsed() && propertyGrid?.isCollapsed();

    if (bothCollapsed) {
      palette?.expand();
      propertyGrid?.expand();
      setSidePanelsCollapsed(false);
    } else {
      palette?.collapse();
      propertyGrid?.collapse();
      setSidePanelsCollapsed(true);
    }
  }, [paletteRef, propertyGridRef]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "\\") {
        event.preventDefault();
        toggleSidePanels();
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [toggleSidePanels]);

  return (
    <div style={EDITOR_GRID_STYLE} data-testid="editor-grid">
      <div style={{ gridColumn: "1 / -1" }}>
        <Toolbar />
      </div>
      <Group
        orientation="horizontal"
        style={{ gridColumn: "1 / -1", width: "100%", height: "100%" }}
      >
        <Panel
          panelRef={paletteRef}
          defaultSize={PALETTE_DEFAULT_SIZE}
          minSize={PALETTE_MIN_SIZE}
          collapsible
          data-collapsed={sidePanelsCollapsed}
        >
          <ConnectedPalette />
        </Panel>

        <Separator
          className="editor-resize-handle"
          style={{
            width: "4px",
            background: "var(--color-border)",
            cursor: "col-resize",
          }}
        />

        <Panel
          defaultSize={100 - PALETTE_DEFAULT_SIZE - PROPERTY_GRID_DEFAULT_SIZE}
          minSize={CANVAS_MIN_SIZE}
        >
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

        <Panel
          panelRef={propertyGridRef}
          defaultSize={PROPERTY_GRID_DEFAULT_SIZE}
          minSize={PROPERTY_GRID_MIN_SIZE}
          collapsible
          data-collapsed={sidePanelsCollapsed}
        >
          <PropertyGrid />
        </Panel>
      </Group>
    </div>
  );
}
