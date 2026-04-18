import * as Select from "@radix-ui/react-select";
import { useTranslation } from "react-i18next";
import { Globe, ChevronDown, Check } from "lucide-react";
import { changeLocale, SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n/index";

/**
 * Locale switcher dropdown using Radix UI Select.
 *
 * - Displays the current language with a globe icon
 * - Persists the selection to localStorage via `changeLocale()`
 * - Switches i18next language immediately
 */
export function LocaleSwitcher() {
  const { t, i18n } = useTranslation();

  const handleChange = (value: string) => {
    changeLocale(value as SupportedLocale);
  };

  return (
    <Select.Root value={i18n.language} onValueChange={handleChange}>
      <Select.Trigger data-testid="locale-switcher" aria-label={t("localeSwitcher.ariaLabel")}>
        <Globe size={14} aria-hidden="true" />
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={12} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content data-testid="locale-switcher-content" position="popper">
          <Select.Viewport>
            {SUPPORTED_LOCALES.map((locale) => (
              <Select.Item key={locale} value={locale} data-testid={`locale-option-${locale}`}>
                <Select.ItemText>{t(`localeSwitcher.${locale}`)}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check size={12} aria-hidden="true" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
