import { Grid3X3, LayoutGrid } from "lucide-react";
import { useWorkflowStore } from "@/store/hooks";

export function Toolbar() {
  const snapEnabled = useWorkflowStore((s) => s.snapEnabled);
  const toggleSnap = useWorkflowStore((s) => s.toggleSnap);
  const layoutRunning = useWorkflowStore((s) => s.layoutRunning);
  const applyLayout = useWorkflowStore((s) => s.applyLayout);

  return (
    <div data-testid="editor-toolbar" role="toolbar" aria-label="Editor toolbar">
      <button
        type="button"
        data-testid="snap-grid-toggle"
        aria-label={snapEnabled ? "Disable snap to grid" : "Enable snap to grid"}
        aria-pressed={snapEnabled}
        title={snapEnabled ? "Disable snap to grid" : "Enable snap to grid"}
        onClick={toggleSnap}
      >
        <Grid3X3 size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="auto-layout-button"
        aria-label="Auto-layout"
        title="Auto-layout"
        disabled={layoutRunning}
        onClick={() => {
          void applyLayout();
        }}
      >
        <LayoutGrid size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
