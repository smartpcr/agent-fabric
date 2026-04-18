import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/i18n/locales/en.json";

/**
 * Initialise i18next with:
 *  - English as the default / fallback language
 *  - In-memory resources (no async loading)
 *  - React integration via react-i18next
 *
 * Call this once at application startup (e.g. in main.tsx).
 * For tests, import and call `initI18n()` directly.
 */
export function initI18n(): typeof i18n {
  if (i18n.isInitialized) return i18n;

  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
    },
    lng: "en",
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

export default i18n;
