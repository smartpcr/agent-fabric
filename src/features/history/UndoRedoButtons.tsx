import { useCallback } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTemporalStore } from "@/store/hooks";

export function UndoRedoButtons() {
  const { t } = useTranslation();
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
    <div data-testid="undo-redo-buttons" role="toolbar" aria-label={t("undoRedo.ariaLabel")}>
      <button
        type="button"
        data-testid="undo-button"
        aria-label={t("undoRedo.undo")}
        title={t("undoRedo.undo")}
        disabled={!canUndo}
        onClick={handleUndo}
      >
        <Undo2 size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="redo-button"
        aria-label={t("undoRedo.redo")}
        title={t("undoRedo.redo")}
        disabled={!canRedo}
        onClick={handleRedo}
      >
        <Redo2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
