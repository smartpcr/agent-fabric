import { Grid3X3, LayoutGrid, Save } from "lucide-react";
import { useWorkflowStore } from "@/store/hooks";
import { UndoRedoButtons } from "@/features/history/UndoRedoButtons";
import { useValidation } from "@/features/property-grid/ValidationContext";

export function Toolbar() {
  const snapEnabled = useWorkflowStore((s) => s.snapEnabled);
  const toggleSnap = useWorkflowStore((s) => s.toggleSnap);
  const layoutRunning = useWorkflowStore((s) => s.layoutRunning);
  const applyLayout = useWorkflowStore((s) => s.applyLayout);
  const { errorCount, errorMessages } = useValidation();

  const hasErrors = errorCount > 0;
  const errorSummary = hasErrors ? errorMessages.join("; ") : undefined;

  return (
    <div data-testid="editor-toolbar" role="toolbar" aria-label="Editor toolbar">
      <UndoRedoButtons />
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
      <button
        type="button"
        data-testid="save-button"
        aria-label="Save"
        title={hasErrors ? errorSummary : "Save"}
        aria-disabled={hasErrors || undefined}
        disabled={hasErrors}
      >
        <Save size={14} aria-hidden="true" />
        Save
      </button>
    </div>
  );
}
