import { useContext } from "react";
import { Grid3X3, LayoutGrid, Save, Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkflowStore } from "@/store/hooks";
import { UndoRedoButtons } from "@/features/history/UndoRedoButtons";
import { RunControls } from "@/features/execution/runControls";
import { ExecutionContext } from "@/providers/ExecutionProvider";
import { useValidation } from "@/features/property-grid/ValidationContext";
import { useTheme } from "@/providers/ThemeProvider";
import type { RunStatus } from "@/store/slices/executionSlice";

/** Read the active run's status from the store. Returns undefined when no run is active. */
function useActiveRunStatus(): RunStatus | undefined {
  return useWorkflowStore((s) => {
    if (s.activeRunId === undefined) return undefined;
    const run = s.runs.get(s.activeRunId);
    return run?.status;
  });
}

export function Toolbar() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const snapEnabled = useWorkflowStore((s) => s.snapEnabled);
  const toggleSnap = useWorkflowStore((s) => s.toggleSnap);
  const layoutRunning = useWorkflowStore((s) => s.layoutRunning);
  const applyLayout = useWorkflowStore((s) => s.applyLayout);
  const { errorCount, errorMessages } = useValidation();
  const executionCtx = useContext(ExecutionContext);
  const runStatus = useActiveRunStatus();

  const hasErrors = errorCount > 0;
  const errorSummary = hasErrors ? errorMessages.join("; ") : undefined;

  return (
    <div data-testid="editor-toolbar" role="toolbar" aria-label={t("toolbar.ariaLabel")}>
      <UndoRedoButtons />
      {executionCtx !== null && <RunControls runStatus={runStatus} />}
      <button
        type="button"
        data-testid="snap-grid-toggle"
        aria-label={snapEnabled ? t("toolbar.disableSnap") : t("toolbar.enableSnap")}
        aria-pressed={snapEnabled}
        title={snapEnabled ? t("toolbar.disableSnap") : t("toolbar.enableSnap")}
        onClick={toggleSnap}
      >
        <Grid3X3 size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="auto-layout-button"
        aria-label={t("toolbar.autoLayout")}
        title={t("toolbar.autoLayout")}
        disabled={layoutRunning}
        onClick={() => {
          void applyLayout();
        }}
      >
        <LayoutGrid size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="theme-toggle"
        aria-label={theme === "light" ? t("toolbar.switchToDark") : t("toolbar.switchToLight")}
        aria-pressed={theme === "dark"}
        title={theme === "light" ? t("toolbar.switchToDark") : t("toolbar.switchToLight")}
        onClick={toggleTheme}
      >
        {theme === "light" ? (
          <Moon size={14} aria-hidden="true" />
        ) : (
          <Sun size={14} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        data-testid="save-button"
        aria-label={t("toolbar.save")}
        title={hasErrors ? errorSummary : t("toolbar.save")}
        aria-disabled={hasErrors || undefined}
        disabled={hasErrors}
      >
        <Save size={14} aria-hidden="true" />
        {t("toolbar.save")}
      </button>
    </div>
  );
}
