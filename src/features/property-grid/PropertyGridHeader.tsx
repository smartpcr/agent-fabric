import { useState, useCallback, useRef, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { ToastContext } from "@/features/editor/Toast";

export interface PropertyGridHeaderProps {
  /** The node kind (e.g. "task", "decision"). */
  readonly kind: string;
  /** The node ID (read-only, copiable). */
  readonly nodeId: string;
  /** The node label (from node.data.name). Undefined if node has no name field. */
  readonly label?: string;
  /** Callback to commit an edited label. */
  readonly onLabelChange?: (newLabel: string) => void;
  /** Optional callback fired after the node ID is copied. Falls back to ToastContext. */
  readonly onCopyId?: () => void;
}

/**
 * Property grid header showing:
 * - Node kind as a badge
 * - Editable label (inline-edit, commits on blur or Enter)
 * - Read-only node ID with copy button (fires toast via context or onCopyId)
 */
export function PropertyGridHeader({
  kind,
  nodeId,
  label,
  onLabelChange,
  onCopyId,
}: PropertyGridHeaderProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const toastCtx = useContext(ToastContext);

  const startEditing = useCallback(() => {
    if (label !== undefined && onLabelChange) {
      setEditValue(label);
      setEditing(true);
    }
  }, [label, onLabelChange]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label && onLabelChange) {
      onLabelChange(trimmed);
    }
  }, [editValue, label, onLabelChange]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditValue(label ?? "");
  }, [label]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit],
  );

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(nodeId);
      if (onCopyId) {
        onCopyId();
      } else if (toastCtx) {
        toastCtx.show({ title: "Node ID copied", variant: "success" });
      }
    } catch {
      // Clipboard write failed
    }
  }, [nodeId, onCopyId, toastCtx]);

  return (
    <div data-testid="property-grid-header">
      {/* Kind badge */}
      <span
        data-testid="header-kind-badge"
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "4px",
          backgroundColor: "#e0e0e0",
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "uppercase",
          marginRight: "8px",
        }}
      >
        {kind}
      </span>

      {/* Editable label */}
      {label === undefined ? null : editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
          }}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          aria-label="Node label"
          data-testid="header-label-input"
          style={{ fontWeight: 600, fontSize: "1rem" }}
        />
      ) : (
        <span
          data-testid="header-label"
          role="button"
          tabIndex={0}
          onClick={startEditing}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              startEditing();
            }
          }}
          aria-label="Edit node label"
          style={{ fontWeight: 600, fontSize: "1rem", cursor: "pointer" }}
        >
          {label}
        </span>
      )}

      {/* Node ID (read-only + copy) */}
      <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
        <code
          data-testid="header-node-id"
          style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#666" }}
        >
          {nodeId}
        </code>
        <button
          type="button"
          onClick={() => {
            void handleCopyId();
          }}
          aria-label="Copy node ID"
          data-testid="header-copy-id"
          style={{
            fontSize: "0.65rem",
            padding: "1px 4px",
            cursor: "pointer",
            border: "1px solid #ccc",
            borderRadius: "2px",
            background: "transparent",
          }}
        >
          {t("propertyGrid.copy")}
        </button>
      </div>
    </div>
  );
}
