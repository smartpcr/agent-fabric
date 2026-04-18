import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { LocaleSwitcher } from "@/features/editor/LocaleSwitcher";
import { changeLocale } from "@/i18n/index";

const LOCALE_STORAGE_KEY = "agent-fabric:locale";

// Polyfill pointer-capture APIs that Radix Select needs in jsdom
beforeEach(() => {
  localStorage.clear();
  void i18n.changeLanguage("en");

  /* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unnecessary-condition */
  HTMLElement.prototype.hasPointerCapture ??= vi.fn(() => false) as never;
  HTMLElement.prototype.setPointerCapture ??= vi.fn() as never;
  HTMLElement.prototype.releasePointerCapture ??= vi.fn() as never;
  HTMLElement.prototype.scrollIntoView ??= vi.fn() as never;
  /* eslint-enable @typescript-eslint/unbound-method, @typescript-eslint/no-unnecessary-condition */
});

afterEach(cleanup);

describe("LocaleSwitcher", () => {
  it("renders with the trigger and correct aria-label", () => {
    render(<LocaleSwitcher />);
    const trigger = screen.getByTestId("locale-switcher");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-label", "Change language");
  });

  it("shows English as the displayed value initially", () => {
    render(<LocaleSwitcher />);
    const trigger = screen.getByTestId("locale-switcher");
    expect(trigger.textContent).toContain("English");
  });

  it("switches language to French when French is selected", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    await user.click(screen.getByTestId("locale-switcher"));
    await user.click(screen.getByTestId("locale-option-fr"));

    expect(i18n.language).toBe("fr");
  });

  it("persists locale to localStorage on change", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    await user.click(screen.getByTestId("locale-switcher"));
    await user.click(screen.getByTestId("locale-option-fr"));

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("fr");
  });

  it("switches back to English after being in French", async () => {
    const user = userEvent.setup();
    void i18n.changeLanguage("fr");

    render(<LocaleSwitcher />);

    await user.click(screen.getByTestId("locale-switcher"));
    await user.click(screen.getByTestId("locale-option-en"));

    expect(i18n.language).toBe("en");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
  });

  it("updates rendered strings when language changes", () => {
    render(<LocaleSwitcher />);
    const trigger = screen.getByTestId("locale-switcher");

    expect(trigger).toHaveAttribute("aria-label", "Change language");

    // Switch to French programmatically
    act(() => {
      changeLocale("fr");
    });

    // The aria-label should now show the French translation
    expect(trigger).toHaveAttribute("aria-label", "Changer de langue");
  });

  it("renders both locale options in the dropdown", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    await user.click(screen.getByTestId("locale-switcher"));

    expect(screen.getByTestId("locale-option-en")).toBeInTheDocument();
    expect(screen.getByTestId("locale-option-fr")).toBeInTheDocument();
  });

  it("changeLocale persists and changes language", () => {
    changeLocale("fr");
    expect(i18n.language).toBe("fr");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("fr");

    changeLocale("en");
    expect(i18n.language).toBe("en");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
  });
});
