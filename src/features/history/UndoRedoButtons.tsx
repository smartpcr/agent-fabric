import { useCallback } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useTemporalStore } from "@/store/hooks";

export function UndoRedoButtons() {
  const undo = useTemporalStore((s) => s.undo);
  const redo = useTemporalStore((s) => s.redo);
  const canUndo = useTemporalStore((s) => s.pastStates.length > 0);
  const canRedo = useTemporalStore((s) => s.futureStates.length > 0);

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

  return (
    <div data-testid="undo-redo-buttons" role="toolbar" aria-label="Undo / Redo">
      <button
        type="button"
        data-testid="undo-button"
        aria-label="Undo"
        title="Undo"
        disabled={!canUndo}
        onClick={handleUndo}
      >
        <Undo2 size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="redo-button"
        aria-label="Redo"
        title="Redo"
        disabled={!canRedo}
        onClick={handleRedo}
      >
        <Redo2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
