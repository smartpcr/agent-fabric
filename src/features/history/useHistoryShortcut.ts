import { useEffect } from "react";
import { useWorkflowStore } from "@/store/hooks";

/**
 * Returns true if the currently focused element is an interactive text
 * input (input, textarea, or contenteditable) where Ctrl+Z should be
 * handled natively by the browser rather than triggering undo/redo.
 */
function isFocusInsideInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;

  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") return true;

  const htmlEl = el as HTMLElement;
  if (htmlEl.isContentEditable || htmlEl.contentEditable === "true") return true;

  return false;
}

/**
 * Registers global keyboard shortcuts for undo/redo:
 * - **Ctrl+Z** (or Cmd+Z on Mac): Undo
 * - **Ctrl+Shift+Z** (or Cmd+Shift+Z on Mac): Redo
 * - **Ctrl+Y**: Redo (Windows convention)
 *
 * Shortcuts are suppressed when focus is inside an input, textarea, or
 * contenteditable element so native text editing behaviour is preserved.
 */
export function useHistoryShortcut(): void {
  const temporal = useWorkflowStore.temporal;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (isFocusInsideInput()) return;

      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      const key = e.key.toLowerCase();

      // Ctrl+Shift+Z → Redo
      if (key === "z" && e.shiftKey) {
        e.preventDefault();
        temporal.getState().redo();
        return;
      }

      // Ctrl+Z → Undo
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        temporal.getState().undo();
        return;
      }

      // Ctrl+Y → Redo (Windows convention)
      if (key === "y" && !e.shiftKey) {
        e.preventDefault();
        temporal.getState().redo();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [temporal]);
}
