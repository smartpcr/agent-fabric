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
