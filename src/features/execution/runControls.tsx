import { useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useExecutionCommand, type ExecutionCommand } from "@/hooks/useExecutionCommand";
import type { RunStatus } from "@/store/slices/executionSlice";

export interface RunControlsProps {
  /** Current run status (determines disabled states). `undefined` means no active run. */
  readonly runStatus: RunStatus | undefined;
}

/**
 * Run control buttons: Start, Pause, and Cancel.
 *
 * Dispatches typed commands to `IExecutionCommandSink` via `useExecutionCommand`.
 * Buttons are disabled based on the current `runStatus`:
 * - Start: disabled when running
 * - Pause: disabled when not running
 * - Cancel: disabled when not running
 *
 * Keyboard shortcuts:
 * - Ctrl+R → run
 * - Ctrl+. → cancel
 */
export function RunControls({ runStatus }: RunControlsProps) {
  const { t } = useTranslation();
  const { dispatch } = useExecutionCommand();

  const isRunning = runStatus === "running";

  const handleDispatch = useCallback(
    (command: ExecutionCommand) => {
      void dispatch(command);
    },
    [dispatch],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        return;
      }

      if (e.key === "r" && !isRunning) {
        e.preventDefault();
        handleDispatch({ type: "run" });
      } else if (e.key === "." && isRunning) {
        e.preventDefault();
        handleDispatch({ type: "cancel" });
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [isRunning, handleDispatch]);

  return (
    <div data-testid="run-controls" role="toolbar" aria-label={t("execution.runControlsLabel")}>
      <button
        data-testid="run-btn"
        aria-label={t("execution.startRun")}
        disabled={isRunning}
        onClick={() => {
          handleDispatch({ type: "run" });
        }}
      >
        {t("execution.start")}
      </button>
      <button
        data-testid="pause-btn"
        aria-label={t("execution.pauseRun")}
        disabled={!isRunning}
        onClick={() => {
          handleDispatch({ type: "pause" });
        }}
      >
        {t("execution.pause")}
      </button>
      <button
        data-testid="cancel-btn"
        aria-label={t("execution.cancelRun")}
        disabled={!isRunning}
        onClick={() => {
          handleDispatch({ type: "cancel" });
        }}
      >
        {t("execution.cancel")}
      </button>
    </div>
  );
}
