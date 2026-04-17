import { useCallback, useEffect, useRef, useState } from "react";

export interface InlineLabelEditorProps {
  /** The current label text */
  readonly value: string;
  /** Called with the new label when the user commits (Enter or Blur) */
  readonly onCommit: (newLabel: string) => void;
  /** Called when the user cancels editing (Escape) */
  readonly onCancel: () => void;
}

/**
 * Inline edge label that supports double-click to edit.
 * - Shows a read-only label initially
 * - Double-click switches to an `<input>` for editing
 * - Enter commits the new value
 * - Escape cancels and reverts to label view
 * - Blur commits the current value
 * - Tab/Shift+Tab are trapped inside the input during editing
 * - Auto-focuses and selects text when entering edit mode
 */
export function InlineLabelEditor({ value, onCommit, onCancel }: InlineLabelEditorProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guard against double-commit from Escape→blur sequence
  const committedRef = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleDoubleClick = useCallback(() => {
    setText(value);
    committedRef.current = false;
    setEditing(true);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        committedRef.current = true;
        setEditing(false);
        onCommit(text);
      } else if (e.key === "Escape") {
        e.preventDefault();
        committedRef.current = true;
        setEditing(false);
        onCancel();
      } else if (e.key === "Tab") {
        // Focus trap: prevent Tab from leaving the input
        e.preventDefault();
      }
      // Stop propagation so canvas keyboard shortcuts don't fire
      e.stopPropagation();
    },
    [text, onCommit, onCancel],
  );

  const handleBlur = useCallback(() => {
    if (!committedRef.current) {
      setEditing(false);
      onCommit(text);
    }
  }, [text, onCommit]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-testid="inline-label-input"
        type="text"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        style={{
          fontSize: 12,
          padding: "2px 6px",
          borderRadius: 4,
          border: "1px solid #3b82f6",
          outline: "none",
          minWidth: 60,
        }}
      />
    );
  }

  return (
    <span
      data-testid="inline-label-display"
      onDoubleClick={handleDoubleClick}
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      {value}
    </span>
  );
}
