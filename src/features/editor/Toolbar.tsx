import { Grid3X3 } from "lucide-react";
import { useWorkflowStore } from "@/store/hooks";

export function Toolbar() {
  const snapEnabled = useWorkflowStore((s) => s.snapEnabled);
  const toggleSnap = useWorkflowStore((s) => s.toggleSnap);

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
    </div>
  );
}
