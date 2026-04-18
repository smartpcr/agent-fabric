import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";

// ─── Props ───────────────────────────────────────────────────────────

export interface SaveLoadBarProps {
  /** Current workflow name. */
  readonly name: string;
  /** Called when the user changes the name field. */
  readonly onNameChange: (name: string) => void;
  /** Called when Save is clicked. */
  readonly onSave: () => void;
  /** Called when Load is clicked. */
  readonly onLoad: () => void;
  /** Called when New is clicked. */
  readonly onNew: () => void;
  /** Whether the workflow has unsaved changes. */
  readonly dirty: boolean;
  /** ISO timestamp of the last successful save, or null if never saved. */
  readonly lastSavedAt: string | null;
  /** Whether a save operation is in progress. */
  readonly saving?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleTimeString();
}

// ─── Styles ──────────────────────────────────────────────────────────

const BAR_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "4px 8px",
  fontSize: "13px",
};

const NAME_INPUT_STYLE: React.CSSProperties = {
  fontSize: "13px",
  padding: "2px 6px",
  border: "1px solid #d1d5db",
  borderRadius: "4px",
  minWidth: "140px",
};

const DIRTY_DOT_STYLE: React.CSSProperties = {
  display: "inline-block",
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  backgroundColor: "#f59e0b",
};

const TIMESTAMP_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "#6b7280",
};

// ─── Component ───────────────────────────────────────────────────────

/**
 * SaveLoadBar renders workflow name input, Save / Load / New action
 * buttons, a dirty-state indicator, and a last-saved timestamp.
 *
 * This is a controlled, presentational component — all state and
 * callbacks are provided via props.
 */
export function SaveLoadBar({
  name,
  onNameChange,
  onSave,
  onLoad,
  onNew,
  dirty,
  lastSavedAt,
  saving = false,
}: SaveLoadBarProps) {
  const { t } = useTranslation();
  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    onNameChange(e.target.value);
  };

  return (
    <div data-testid="save-load-bar" style={BAR_STYLE}>
      <input
        data-testid="workflow-name-input"
        type="text"
        aria-label={t("persistence.workflowName")}
        value={name}
        onChange={handleNameChange}
        style={NAME_INPUT_STYLE}
      />

      <button
        type="button"
        data-testid="save-button"
        aria-label={t("persistence.save")}
        onClick={onSave}
        disabled={saving}
      >
        {saving ? t("persistence.saving") : t("persistence.save")}
      </button>

      <button type="button" data-testid="load-button" aria-label={t("persistence.load")} onClick={onLoad}>
        {t("persistence.load")}
      </button>

      <button type="button" data-testid="new-button" aria-label={t("persistence.new")} onClick={onNew}>
        {t("persistence.new")}
      </button>

      {dirty && (
        <span
          data-testid="dirty-indicator"
          role="status"
          aria-label={t("persistence.unsavedChanges")}
          title={t("persistence.unsavedChanges")}
          style={DIRTY_DOT_STYLE}
        />
      )}

      {lastSavedAt !== null && (
        <span data-testid="last-saved-timestamp" style={TIMESTAMP_STYLE}>
          {t("persistence.saved", { timestamp: formatTimestamp(lastSavedAt) })}
        </span>
      )}
    </div>
  );
}
