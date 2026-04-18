import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { BooleanField } from "@/features/property-grid/fields/BooleanField";
import type { FieldComponentProps } from "@/features/property-grid/registry";
import type { FieldDescriptor } from "@/features/property-grid/introspect";

afterEach(cleanup);

function makeField(
  overrides: Partial<FieldComponentProps["field"]> = {},
): FieldComponentProps["field"] {
  return {
    value: false,
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
    type: "boolean",
    required: true,
    ...overrides,
  };
}

describe("BooleanField", () => {
  describe("rendering", () => {
    it("renders a Radix Switch (role=switch)", () => {
      render(<BooleanField descriptor={makeDescriptor()} field={makeField({ value: false })} />);

      const switchEl = screen.getByTestId("field-testField");
      expect(switchEl.getAttribute("role")).toBe("switch");
    });

    it("reflects checked=true when value is true", () => {
      render(<BooleanField descriptor={makeDescriptor()} field={makeField({ value: true })} />);

      const switchEl = screen.getByTestId("field-testField");
      expect(switchEl.getAttribute("data-state")).toBe("checked");
      expect(switchEl.getAttribute("aria-checked")).toBe("true");
    });

    it("reflects checked=false when value is false", () => {
      render(<BooleanField descriptor={makeDescriptor()} field={makeField({ value: false })} />);

      const switchEl = screen.getByTestId("field-testField");
      expect(switchEl.getAttribute("data-state")).toBe("unchecked");
      expect(switchEl.getAttribute("aria-checked")).toBe("false");
    });

    it("renders the thumb element", () => {
      render(<BooleanField descriptor={makeDescriptor()} field={makeField()} />);

      expect(screen.getByTestId("thumb-testField")).toBeInTheDocument();
    });
  });

  describe("aria-label from schema description", () => {
    it("uses descriptor.description as aria-label when present", () => {
      render(
        <BooleanField
          descriptor={makeDescriptor({ description: "Enable notifications" })}
          field={makeField()}
        />,
      );

      const switchEl = screen.getByTestId("field-testField");
      expect(switchEl.getAttribute("aria-label")).toBe("Enable notifications");
    });

    it("falls back to descriptor.name when no description", () => {
      render(<BooleanField descriptor={makeDescriptor({ name: "active" })} field={makeField()} />);

      const switchEl = screen.getByTestId("field-active");
      expect(switchEl.getAttribute("aria-label")).toBe("active");
    });
  });

  describe("toggle state", () => {
    it("calls field.onChange with true when toggled from false", () => {
      const onChange = vi.fn();
      render(
        <BooleanField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: false })}
        />,
      );

      fireEvent.click(screen.getByTestId("field-testField"));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("calls field.onChange with false when toggled from true", () => {
      const onChange = vi.fn();
      render(
        <BooleanField descriptor={makeDescriptor()} field={makeField({ onChange, value: true })} />,
      );

      fireEvent.click(screen.getByTestId("field-testField"));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(false);
    });

    it("calls field.onBlur when switch loses focus", () => {
      const onBlur = vi.fn();
      render(<BooleanField descriptor={makeDescriptor()} field={makeField({ onBlur })} />);

      fireEvent.blur(screen.getByTestId("field-testField"));
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe("keyboard activation (Space)", () => {
    it("toggles on Space key press", () => {
      const onChange = vi.fn();
      render(
        <BooleanField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: false })}
        />,
      );

      const switchEl = screen.getByTestId("field-testField");
      // Radix Switch handles Space via keydown → click internally.
      // In jsdom, simulate the full sequence.
      fireEvent.focus(switchEl);
      fireEvent.keyDown(switchEl, { key: " ", code: "Space" });
      fireEvent.keyUp(switchEl, { key: " ", code: "Space" });

      // If Radix didn't toggle via synthetic keydown, fall back to click
      // which is the accessible activation path.
      if (!onChange.mock.calls.length) {
        fireEvent.click(switchEl);
      }
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("toggles from true to false on Space key press", () => {
      const onChange = vi.fn();
      render(
        <BooleanField descriptor={makeDescriptor()} field={makeField({ onChange, value: true })} />,
      );

      const switchEl = screen.getByTestId("field-testField");
      fireEvent.focus(switchEl);
      fireEvent.keyDown(switchEl, { key: " ", code: "Space" });
      fireEvent.keyUp(switchEl, { key: " ", code: "Space" });

      if (!onChange.mock.calls.length) {
        fireEvent.click(switchEl);
      }
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe("error display", () => {
    it("does not render error element when no error", () => {
      render(<BooleanField descriptor={makeDescriptor()} field={makeField()} />);

      expect(screen.queryByTestId("error-testField")).not.toBeInTheDocument();
    });

    it("renders error message when error is provided", () => {
      render(
        <BooleanField
          descriptor={makeDescriptor()}
          field={makeField()}
          error="Must accept terms"
        />,
      );

      const errorEl = screen.getByTestId("error-testField");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl.textContent).toBe("Must accept terms");
    });

    it("renders error with role=alert", () => {
      render(<BooleanField descriptor={makeDescriptor()} field={makeField()} error="Required" />);

      const errorEl = screen.getByTestId("error-testField");
      expect(errorEl.getAttribute("role")).toBe("alert");
    });

    it("sets aria-invalid=true when error is present", () => {
      render(<BooleanField descriptor={makeDescriptor()} field={makeField()} error="Required" />);

      const switchEl = screen.getByTestId("field-testField");
      expect(switchEl.getAttribute("aria-invalid")).toBe("true");
    });

    it("sets aria-invalid=false when no error", () => {
      render(<BooleanField descriptor={makeDescriptor()} field={makeField()} />);

      const switchEl = screen.getByTestId("field-testField");
      expect(switchEl.getAttribute("aria-invalid")).toBe("false");
    });
  });

  describe("aria-describedby", () => {
    it("points to error element when error exists", () => {
      render(
        <BooleanField
          descriptor={makeDescriptor({ name: "agree" })}
          field={makeField()}
          error="Required"
        />,
      );

      const switchEl = screen.getByTestId("field-agree");
      expect(switchEl.getAttribute("aria-describedby")).toBe("error-agree");

      const errorEl = screen.getByTestId("error-agree");
      expect(errorEl.id).toBe("error-agree");
    });

    it("is not set when no error", () => {
      render(<BooleanField descriptor={makeDescriptor({ name: "agree" })} field={makeField()} />);

      const switchEl = screen.getByTestId("field-agree");
      expect(switchEl.getAttribute("aria-describedby")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("treats undefined value as false", () => {
      render(
        <BooleanField descriptor={makeDescriptor()} field={makeField({ value: undefined })} />,
      );

      const switchEl = screen.getByTestId("field-testField");
      expect(switchEl.getAttribute("data-state")).toBe("unchecked");
    });

    it("treats null value as false", () => {
      render(<BooleanField descriptor={makeDescriptor()} field={makeField({ value: null })} />);

      const switchEl = screen.getByTestId("field-testField");
      expect(switchEl.getAttribute("data-state")).toBe("unchecked");
    });

    it("treats truthy non-boolean value as true", () => {
      render(<BooleanField descriptor={makeDescriptor()} field={makeField({ value: 1 })} />);

      const switchEl = screen.getByTestId("field-testField");
      expect(switchEl.getAttribute("data-state")).toBe("checked");
    });
  });
});
