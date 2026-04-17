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
 * Inline text input that replaces an edge label on double-click.
 * - Enter commits the new value
 * - Escape cancels and reverts
 * - Blur commits the current value
 * - Auto-focuses and selects text on mount
 */
export function InlineLabelEditor({ value, onCommit, onCancel }: InlineLabelEditorProps) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onCommit(text);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      // Stop propagation so canvas keyboard shortcuts don't fire
      e.stopPropagation();
    },
    [text, onCommit, onCancel],
  );

  const handleBlur = useCallback(() => {
    onCommit(text);
  }, [text, onCommit]);

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
