import { createContext, useCallback, useRef, useState, type ReactNode } from "react";

/** Time (ms) before the announcement is cleared from the live region. */
const CLEAR_DELAY = 3_000;

export interface AnnouncerContextValue {
  /** Push a message into the polite aria-live region. Cleared after 3 s. */
  announce: (message: string) => void;
}

export const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

/**
 * Mounts an `aria-live="polite"` region at the app root and provides an
 * `announce(msg)` callback via context so any descendant can push
 * screen-reader-visible messages.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((msg: string) => {
    // Clear any pending timer so rapid announcements reset the 3 s window
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    // Briefly clear, then set — forces screen readers to re-announce even
    // if the text is identical to the previous announcement.
    setMessage("");
    // Use a microtask-level delay (0 ms setTimeout) so the DOM update
    // that clears the region is flushed before the new text is set.
    setTimeout(() => {
      setMessage(msg);
      timerRef.current = setTimeout(() => {
        setMessage("");
        timerRef.current = null;
      }, CLEAR_DELAY);
    }, 0);
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        data-testid="announcer-live-region"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}
