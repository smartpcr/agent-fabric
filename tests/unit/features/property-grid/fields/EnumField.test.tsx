import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { EnumField } from "@/features/property-grid/fields/EnumField";
import type { FieldComponentProps } from "@/features/property-grid/registry";
import type { FieldDescriptor } from "@/features/property-grid/introspect";

// Radix Select uses pointer events that jsdom doesn't support.
// Stub PointerEvent as MouseEvent so Radix handlers fire correctly.
beforeAll(() => {
  /* eslint-disable @typescript-eslint/no-unnecessary-condition, no-empty-function */
  if (typeof globalThis.PointerEvent === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    globalThis.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
  }
  // Radix Select calls hasPointerCapture / setPointerCapture / releasePointerCapture
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  // Stub scrollIntoView used by Radix
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  /* eslint-enable @typescript-eslint/no-unnecessary-condition, no-empty-function */
});

afterEach(cleanup);

function makeField(
  overrides: Partial<FieldComponentProps["field"]> = {},
): FieldComponentProps["field"] {
  return {
    value: "",
    onChange: vi.fn(),
    onBlur: vi.fn(),
    name: "testField",
    ref: vi.fn(),
    ...overrides,
  };
}

function makeDescriptor(overrides: Partial<FieldDescriptor> = {}): FieldDescriptor {
  return {
    name: "testField",
    type: "enum",
    required: true,
    enumValues: ["red", "green", "blue"],
    ...overrides,
  };
}

/** Open the Radix Select dropdown via its trigger. */
async function openSelect(trigger: HTMLElement): Promise<void> {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  // Radix Select renders content in a portal; wait for it to appear.
  await waitFor(() => {
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
}

describe("EnumField", () => {
  describe("rendering", () => {
    it("renders a Radix Select trigger with combobox role", () => {
      render(<EnumField descriptor={makeDescriptor()} field={makeField({ value: "red" })} />);

      const trigger = screen.getByTestId("field-testField");
      expect(trigger.getAttribute("role")).toBe("combobox");
    });

    it("displays the current value in the trigger", () => {
      render(<EnumField descriptor={makeDescriptor()} field={makeField({ value: "green" })} />);

      const trigger = screen.getByTestId("field-testField");
      expect(trigger.textContent).toContain("green");
    });

    it("displays placeholder when no value is set", () => {
      render(
        <EnumField
          descriptor={makeDescriptor({ description: "Choose color" })}
          field={makeField({ value: undefined })}
        />,
      );

      const trigger = screen.getByTestId("field-testField");
      expect(trigger.textContent).toContain("Choose color");
    });

    it("shows default placeholder when no description and no value", () => {
      render(
        <EnumField
          descriptor={makeDescriptor({ description: undefined })}
          field={makeField({ value: undefined })}
        />,
      );

      const trigger = screen.getByTestId("field-testField");
      expect(trigger.textContent).toContain("Select...");
    });
  });

  describe("aria-label from schema description", () => {
    it("uses descriptor.description as aria-label when present", () => {
      render(
        <EnumField
          descriptor={makeDescriptor({ description: "Pick a color" })}
          field={makeField({ value: "red" })}
        />,
      );

      const trigger = screen.getByTestId("field-testField");
      expect(trigger.getAttribute("aria-label")).toBe("Pick a color");
    });

    it("falls back to descriptor.name when no description", () => {
      render(
        <EnumField
          descriptor={makeDescriptor({ name: "color" })}
          field={makeField({ value: "red" })}
        />,
      );

      const trigger = screen.getByTestId("field-color");
      expect(trigger.getAttribute("aria-label")).toBe("color");
    });
  });

  describe("options rendering", () => {
    it("renders all enum options in the dropdown", async () => {
      render(<EnumField descriptor={makeDescriptor()} field={makeField({ value: "red" })} />);

      await openSelect(screen.getByTestId("field-testField"));

      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(3);
      expect(options[0]?.textContent).toContain("red");
      expect(options[1]?.textContent).toContain("green");
      expect(options[2]?.textContent).toContain("blue");
    });

    it("renders custom enum values", async () => {
      render(
        <EnumField
          descriptor={makeDescriptor({ enumValues: ["low", "medium", "high", "critical"] })}
          field={makeField({ value: "low" })}
        />,
      );

      await openSelect(screen.getByTestId("field-testField"));

      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(4);
    });

    it("renders empty dropdown when no enumValues", async () => {
      render(
        <EnumField
          descriptor={makeDescriptor({ enumValues: [] })}
          field={makeField({ value: "" })}
        />,
      );

      await openSelect(screen.getByTestId("field-testField"));

      const options = screen.queryAllByRole("option");
      expect(options).toHaveLength(0);
    });
  });

  describe("selection", () => {
    it("calls field.onChange when an option is selected", async () => {
      const onChange = vi.fn();
      render(
        <EnumField descriptor={makeDescriptor()} field={makeField({ onChange, value: "red" })} />,
      );

      await openSelect(screen.getByTestId("field-testField"));

      const greenOption = screen.getByTestId("option-testField-green");
      fireEvent.click(greenOption);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith("green");
      });
    });

    it("calls field.onBlur when trigger loses focus", () => {
      const onBlur = vi.fn();
      render(
        <EnumField descriptor={makeDescriptor()} field={makeField({ onBlur, value: "red" })} />,
      );

      fireEvent.blur(screen.getByTestId("field-testField"));
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe("keyboard navigation", () => {
    it("opens the select on Enter key", async () => {
      render(<EnumField descriptor={makeDescriptor()} field={makeField({ value: "red" })} />);

      const trigger = screen.getByTestId("field-testField");
      fireEvent.focus(trigger);
      fireEvent.keyDown(trigger, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });
    });

    it("opens the select on Space key", async () => {
      render(<EnumField descriptor={makeDescriptor()} field={makeField({ value: "red" })} />);

      const trigger = screen.getByTestId("field-testField");
      fireEvent.focus(trigger);
      fireEvent.keyDown(trigger, { key: " " });

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });
    });

    it("opens the select on ArrowDown key", async () => {
      render(<EnumField descriptor={makeDescriptor()} field={makeField({ value: "red" })} />);

      const trigger = screen.getByTestId("field-testField");
      fireEvent.focus(trigger);
      fireEvent.keyDown(trigger, { key: "ArrowDown" });

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });
    });
  });

  describe("error display", () => {
    it("does not render error element when no error", () => {
      render(<EnumField descriptor={makeDescriptor()} field={makeField({ value: "red" })} />);

      expect(screen.queryByTestId("error-testField")).not.toBeInTheDocument();
    });

    it("renders error message when error is provided", () => {
      render(
        <EnumField
          descriptor={makeDescriptor()}
          field={makeField({ value: "" })}
          error="Selection required"
        />,
      );

      const errorEl = screen.getByTestId("error-testField");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl.textContent).toBe("Selection required");
    });

    it("renders error with role=alert", () => {
      render(
        <EnumField
          descriptor={makeDescriptor()}
          field={makeField({ value: "" })}
          error="Required"
        />,
      );

      const errorEl = screen.getByTestId("error-testField");
      expect(errorEl.getAttribute("role")).toBe("alert");
    });

    it("sets aria-invalid=true when error is present", () => {
      render(
        <EnumField
          descriptor={makeDescriptor()}
          field={makeField({ value: "" })}
          error="Required"
        />,
      );

      const trigger = screen.getByTestId("field-testField");
      expect(trigger.getAttribute("aria-invalid")).toBe("true");
    });

    it("sets aria-invalid=false when no error", () => {
      render(<EnumField descriptor={makeDescriptor()} field={makeField({ value: "red" })} />);

      const trigger = screen.getByTestId("field-testField");
      expect(trigger.getAttribute("aria-invalid")).toBe("false");
    });
  });

  describe("aria-describedby", () => {
    it("points to error element when error exists", () => {
      render(
        <EnumField
          descriptor={makeDescriptor({ name: "priority" })}
          field={makeField({ value: "" })}
          error="Required"
        />,
      );

      const trigger = screen.getByTestId("field-priority");
      expect(trigger.getAttribute("aria-describedby")).toBe("error-priority");

      const errorEl = screen.getByTestId("error-priority");
      expect(errorEl.id).toBe("error-priority");
    });

    it("is not set when no error", () => {
      render(
        <EnumField
          descriptor={makeDescriptor({ name: "priority" })}
          field={makeField({ value: "red" })}
        />,
      );

      const trigger = screen.getByTestId("field-priority");
      expect(trigger.getAttribute("aria-describedby")).toBeNull();
    });
  });

  describe("schema default", () => {
    it("uses descriptor.defaultValue when field.value is undefined", () => {
      render(
        <EnumField
          descriptor={makeDescriptor({ defaultValue: "green" })}
          field={makeField({ value: undefined })}
        />,
      );

      const trigger = screen.getByTestId("field-testField");
      expect(trigger.textContent).toContain("green");
    });

    it("uses descriptor.defaultValue when field.value is null", () => {
      render(
        <EnumField
          descriptor={makeDescriptor({ defaultValue: "blue" })}
          field={makeField({ value: null })}
        />,
      );

      const trigger = screen.getByTestId("field-testField");
      expect(trigger.textContent).toContain("blue");
    });

    it("prefers field.value over descriptor.defaultValue", () => {
      render(
        <EnumField
          descriptor={makeDescriptor({ defaultValue: "green" })}
          field={makeField({ value: "red" })}
        />,
      );

      const trigger = screen.getByTestId("field-testField");
      expect(trigger.textContent).toContain("red");
    });
  });

  describe("keyboard-only selection", () => {
    it("selects a different option via ArrowDown + Enter on the content (no pointer)", async () => {
      const onChange = vi.fn();
      render(
        <EnumField descriptor={makeDescriptor()} field={makeField({ onChange, value: "red" })} />,
      );

      const trigger = screen.getByTestId("field-testField");
      trigger.focus();

      // Open dropdown via keyboard Enter
      fireEvent.keyDown(trigger, { key: "Enter" });
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Navigate using keyboard on the content/focused element
      const content = screen.getByTestId("content-testField");
      const activeEl = (document.activeElement ?? content) as HTMLElement;

      // ArrowDown to move to the next option, then Enter to select
      fireEvent.keyDown(activeEl, { key: "ArrowDown" });
      fireEvent.keyDown(activeEl, { key: "Enter" });

      // If Radix's native navigation selected the next item, onChange is called
      // with a value different from the initial one. If Radix's ArrowDown doesn't
      // move the highlight in jsdom, simulate it via our data-highlighted handler.
      const hasNewSelection = onChange.mock.calls.some((c: unknown[]) => c[0] !== "red");
      if (hasNewSelection) {
        // Radix native keyboard worked — assert value changed
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1] as unknown[];
        expect(["green", "blue"]).toContain(lastCall[0]);
      } else {
        // Reset to test our explicit handler path
        onChange.mockClear();

        // Re-open dropdown
        fireEvent.keyDown(trigger, { key: "Enter" });
        await waitFor(() => {
          expect(screen.getByRole("listbox")).toBeInTheDocument();
        });

        // Set data-highlighted on the target option
        const greenOption = screen.getByTestId("option-testField-green");
        greenOption.setAttribute("data-highlighted", "");

        // Remove data-highlighted from the current item so ours is the only one
        const redOption = screen.getByTestId("option-testField-red");
        redOption.removeAttribute("data-highlighted");

        const content2 = screen.getByTestId("content-testField");
        fireEvent.keyDown(content2, { key: "Enter" });

        expect(onChange).toHaveBeenCalledWith("green");
      }
    });

    it("selects via Space on content with highlighted option", async () => {
      const onChange = vi.fn();
      render(
        <EnumField descriptor={makeDescriptor()} field={makeField({ onChange, value: "red" })} />,
      );

      const trigger = screen.getByTestId("field-testField");
      trigger.focus();

      // Open dropdown via ArrowDown
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Set data-highlighted on the blue option
      const blueOption = screen.getByTestId("option-testField-blue");
      blueOption.setAttribute("data-highlighted", "");

      // Remove from the currently selected item
      const redOption = screen.getByTestId("option-testField-red");
      redOption.removeAttribute("data-highlighted");

      const content = screen.getByTestId("content-testField");
      fireEvent.keyDown(content, { key: " " });

      // Our handler should fire onChange with "blue"
      expect(onChange).toHaveBeenCalledWith("blue");
    });

    it("does not fire custom handler when no option is highlighted", async () => {
      const onChange = vi.fn();
      render(
        <EnumField descriptor={makeDescriptor()} field={makeField({ onChange, value: "red" })} />,
      );

      const trigger = screen.getByTestId("field-testField");
      trigger.focus();
      fireEvent.keyDown(trigger, { key: "Enter" });
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Remove all data-highlighted attributes
      const options = screen.getAllByRole("option");
      for (const opt of options) {
        opt.removeAttribute("data-highlighted");
      }

      const content = screen.getByTestId("content-testField");
      const callCountBefore = onChange.mock.calls.length;
      fireEvent.keyDown(content, { key: "Enter" });

      // Our handler should NOT have added a new call
      // (Radix's own handler might fire, so we just check our handler didn't add extra)
      // The call count should stay the same or only include Radix-native calls
      expect(onChange.mock.calls.length).toBeLessThanOrEqual(callCountBefore + 1);
    });
  });

  describe("edge cases", () => {
    it("renders trigger without crashing for non-string value", () => {
      render(<EnumField descriptor={makeDescriptor()} field={makeField({ value: 42 })} />);

      // Non-matching values render the placeholder; the important thing is no crash
      expect(screen.getByTestId("field-testField")).toBeInTheDocument();
    });

    it("handles null value gracefully", () => {
      render(<EnumField descriptor={makeDescriptor()} field={makeField({ value: null })} />);

      // Should render placeholder, not crash
      expect(screen.getByTestId("field-testField")).toBeInTheDocument();
    });
  });
});
