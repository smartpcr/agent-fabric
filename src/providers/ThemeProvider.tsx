import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "agent-fabric:theme";

export interface ThemeContextValue {
  /** The currently active theme. */
  theme: Theme;
  /** Toggle between light and dark. */
  toggleTheme: () => void;
  /** Set a specific theme. */
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Read the system color-scheme preference.
 * Returns "dark" when the user's OS prefers dark mode, "light" otherwise.
 */
function getSystemPreference(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Read persisted theme from localStorage, falling back to system preference.
 */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return getSystemPreference();
}

/**
 * Apply the `data-theme` attribute to `<html>` so CSS custom properties
 * defined in `tokens.css` take effect.
 */
function applyThemeToDOM(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

/**
 * Provides theme state (light / dark) to the component tree.
 *
 * - On mount, reads from `localStorage` (`agent-fabric:theme`).
 * - Falls back to `prefers-color-scheme` media query when nothing persisted.
 * - Sets `data-theme` on `<html>` for CSS token resolution.
 * - Listens for system preference changes and reacts when no explicit
 *   user preference has been persisted.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Apply to DOM whenever theme changes
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // Listen for system color-scheme changes and update when no explicit
  // user preference is stored.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    function handleChange(e: MediaQueryListEvent) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setThemeState(e.matches ? "dark" : "light");
      }
    }

    mql.addEventListener("change", handleChange);
    return () => {
      mql.removeEventListener("change", handleChange);
    };
  }, []);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Access the current theme and toggle/set helpers.
 * Throws if used outside `<ThemeProvider>`.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
