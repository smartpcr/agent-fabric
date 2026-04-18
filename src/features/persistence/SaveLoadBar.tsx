import type { ChangeEvent } from "react";

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
  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    onNameChange(e.target.value);
  };

  return (
    <div data-testid="save-load-bar" style={BAR_STYLE}>
      <input
        data-testid="workflow-name-input"
        type="text"
        aria-label="Workflow name"
        value={name}
        onChange={handleNameChange}
        style={NAME_INPUT_STYLE}
      />

      <button
        type="button"
        data-testid="save-button"
        aria-label="Save"
        onClick={onSave}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save"}
      </button>

      <button type="button" data-testid="load-button" aria-label="Load" onClick={onLoad}>
        Load
      </button>

      <button type="button" data-testid="new-button" aria-label="New" onClick={onNew}>
        New
      </button>

      {dirty && (
        <span
          data-testid="dirty-indicator"
          role="status"
          aria-label="Unsaved changes"
          title="Unsaved changes"
          style={DIRTY_DOT_STYLE}
        />
      )}

      {lastSavedAt !== null && (
        <span data-testid="last-saved-timestamp" style={TIMESTAMP_STYLE}>
          Saved {formatTimestamp(lastSavedAt)}
        </span>
      )}
    </div>
  );
}
