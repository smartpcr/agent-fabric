import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/i18n/locales/en.json";
import fr from "@/i18n/locales/fr.json";

/** localStorage key for persisted locale. */
const LOCALE_STORAGE_KEY = "agent-fabric:locale";

/** Supported locales. */
export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Initialise i18next with:
 *  - English as the default / fallback language
 *  - French as an additional language
 *  - In-memory resources (no async loading)
 *  - React integration via react-i18next
 *  - Persisted locale from localStorage (if available)
 *
 * Call this once at application startup (e.g. in main.tsx).
 * For tests, import and call `initI18n()` directly.
 */
export function initI18n(): typeof i18n {
  if (i18n.isInitialized) return i18n;

  const persisted =
    typeof localStorage !== "undefined" ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
  const lng =
    persisted && (SUPPORTED_LOCALES as readonly string[]).includes(persisted) ? persisted : "en";

  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already escapes
    },
    // Return the key itself when a translation is missing so the UI
    // degrades gracefully and the missing key is visible.
    returnNull: false,
    missingKeyHandler: false,
  });

  return i18n;
}

/**
 * Change the active locale and persist it to localStorage.
 */
export function changeLocale(locale: SupportedLocale): void {
  void i18n.changeLanguage(locale);
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage may be unavailable in some environments
  }
}

export default i18n;
