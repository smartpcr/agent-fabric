import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NumberField } from "@/features/property-grid/fields/NumberField";
import type { FieldComponentProps } from "@/features/property-grid/registry";
import type { FieldDescriptor } from "@/features/property-grid/introspect";

afterEach(cleanup);

function makeField(
  overrides: Partial<FieldComponentProps["field"]> = {},
): FieldComponentProps["field"] {
  return {
    value: 0,
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
    type: "number",
    required: true,
    ...overrides,
  };
}

describe("NumberField", () => {
  describe("rendering", () => {
    it("renders an input of type number", () => {
      render(<NumberField descriptor={makeDescriptor()} field={makeField({ value: 42 })} />);

      const input = screen.getByTestId("field-testField");
      expect(input.tagName).toBe("INPUT");
      expect(input.getAttribute("type")).toBe("number");
    });

    it("renders with the correct numeric value", () => {
      render(<NumberField descriptor={makeDescriptor()} field={makeField({ value: 42 })} />);

      const input = screen.getByTestId("field-testField");
      expect(input.value).toBe("42");
    });

    it("renders empty string for undefined value", () => {
      render(<NumberField descriptor={makeDescriptor()} field={makeField({ value: undefined })} />);

      const input = screen.getByTestId("field-testField");
      expect(input.value).toBe("");
    });

    it("renders empty string for null value", () => {
      render(<NumberField descriptor={makeDescriptor()} field={makeField({ value: null })} />);

      const input = screen.getByTestId("field-testField");
      expect(input.value).toBe("");
    });

    it("has aria-label matching descriptor name", () => {
      render(<NumberField descriptor={makeDescriptor({ name: "age" })} field={makeField()} />);

      const input = screen.getByTestId("field-age");
      expect(input.getAttribute("aria-label")).toBe("age");
    });
  });

  describe("min/max/step from schema", () => {
    it("sets min attribute from descriptor.min", () => {
      render(<NumberField descriptor={makeDescriptor({ min: 0 })} field={makeField()} />);

      const input = screen.getByTestId("field-testField");
      expect(input.getAttribute("min")).toBe("0");
    });

    it("sets max attribute from descriptor.max", () => {
      render(<NumberField descriptor={makeDescriptor({ max: 100 })} field={makeField()} />);

      const input = screen.getByTestId("field-testField");
      expect(input.getAttribute("max")).toBe("100");
    });

    it("sets step attribute from descriptor.step", () => {
      render(<NumberField descriptor={makeDescriptor({ step: 5 })} field={makeField()} />);

      const input = screen.getByTestId("field-testField");
      expect(input.getAttribute("step")).toBe("5");
    });

    it("sets all three attributes when present", () => {
      render(
        <NumberField
          descriptor={makeDescriptor({ min: -10, max: 10, step: 0.5 })}
          field={makeField()}
        />,
      );

      const input = screen.getByTestId("field-testField");
      expect(input.getAttribute("min")).toBe("-10");
      expect(input.getAttribute("max")).toBe("10");
      expect(input.getAttribute("step")).toBe("0.5");
    });

    it("does not set min/max/step when not in descriptor", () => {
      render(<NumberField descriptor={makeDescriptor()} field={makeField()} />);

      const input = screen.getByTestId("field-testField");
      expect(input.getAttribute("min")).toBeNull();
      expect(input.getAttribute("max")).toBeNull();
      expect(input.getAttribute("step")).toBeNull();
    });
  });

  describe("onChange", () => {
    it("calls field.onChange with parsed number on valid input", () => {
      const onChange = vi.fn();
      render(
        <NumberField descriptor={makeDescriptor()} field={makeField({ onChange, value: 0 })} />,
      );

      const input = screen.getByTestId("field-testField");
      fireEvent.change(input, { target: { value: "42" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(42);
    });

    it("calls field.onChange with undefined for empty input", () => {
      const onChange = vi.fn();
      render(
        <NumberField descriptor={makeDescriptor()} field={makeField({ onChange, value: 42 })} />,
      );

      const input = screen.getByTestId("field-testField");
      fireEvent.change(input, { target: { value: "" } });

      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it("handles decimal values", () => {
      const onChange = vi.fn();
      render(
        <NumberField descriptor={makeDescriptor()} field={makeField({ onChange, value: 0 })} />,
      );

      fireEvent.change(screen.getByTestId("field-testField"), { target: { value: "3.14" } });
      expect(onChange).toHaveBeenCalledWith(3.14);
    });

    it("handles negative values", () => {
      const onChange = vi.fn();
      render(
        <NumberField descriptor={makeDescriptor()} field={makeField({ onChange, value: 0 })} />,
      );

      fireEvent.change(screen.getByTestId("field-testField"), { target: { value: "-5" } });
      expect(onChange).toHaveBeenCalledWith(-5);
    });

    it("calls field.onBlur when input loses focus", () => {
      const onBlur = vi.fn();
      render(<NumberField descriptor={makeDescriptor()} field={makeField({ onBlur })} />);

      fireEvent.blur(screen.getByTestId("field-testField"));
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe("keyboard step increments", () => {
    it("increments value by step on ArrowUp", () => {
      const onChange = vi.fn();
      render(
        <NumberField
          descriptor={makeDescriptor({ step: 0.5 })}
          field={makeField({ onChange, value: 3 })}
        />,
      );

      fireEvent.keyDown(screen.getByTestId("field-testField"), { key: "ArrowUp" });
      expect(onChange).toHaveBeenCalledWith(3.5);
    });

    it("decrements value by step on ArrowDown", () => {
      const onChange = vi.fn();
      render(
        <NumberField
          descriptor={makeDescriptor({ step: 0.5 })}
          field={makeField({ onChange, value: 3 })}
        />,
      );

      fireEvent.keyDown(screen.getByTestId("field-testField"), { key: "ArrowDown" });
      expect(onChange).toHaveBeenCalledWith(2.5);
    });

    it("uses step=1 as default when step is not defined", () => {
      const onChange = vi.fn();
      render(
        <NumberField descriptor={makeDescriptor()} field={makeField({ onChange, value: 10 })} />,
      );

      fireEvent.keyDown(screen.getByTestId("field-testField"), { key: "ArrowUp" });
      expect(onChange).toHaveBeenCalledWith(11);
    });

    it("clamps to max when ArrowUp would exceed it", () => {
      const onChange = vi.fn();
      render(
        <NumberField
          descriptor={makeDescriptor({ max: 10, step: 5 })}
          field={makeField({ onChange, value: 8 })}
        />,
      );

      fireEvent.keyDown(screen.getByTestId("field-testField"), { key: "ArrowUp" });
      expect(onChange).toHaveBeenCalledWith(10);
    });

    it("clamps to min when ArrowDown would go below it", () => {
      const onChange = vi.fn();
      render(
        <NumberField
          descriptor={makeDescriptor({ min: 0, step: 5 })}
          field={makeField({ onChange, value: 3 })}
        />,
      );

      fireEvent.keyDown(screen.getByTestId("field-testField"), { key: "ArrowDown" });
      expect(onChange).toHaveBeenCalledWith(0);
    });

    it("starts from 0 when current value is undefined", () => {
      const onChange = vi.fn();
      render(
        <NumberField
          descriptor={makeDescriptor({ step: 2 })}
          field={makeField({ onChange, value: undefined })}
        />,
      );

      fireEvent.keyDown(screen.getByTestId("field-testField"), { key: "ArrowUp" });
      expect(onChange).toHaveBeenCalledWith(2);
    });

    it("does not fire onChange for non-arrow keys", () => {
      const onChange = vi.fn();
      render(
        <NumberField descriptor={makeDescriptor()} field={makeField({ onChange, value: 5 })} />,
      );

      fireEvent.keyDown(screen.getByTestId("field-testField"), { key: "Enter" });
      fireEvent.keyDown(screen.getByTestId("field-testField"), { key: "a" });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("clamping non-numeric input", () => {
    it("clamps to previous valid value when browser signals badInput", () => {
      const onChange = vi.fn();
      render(
        <NumberField descriptor={makeDescriptor()} field={makeField({ onChange, value: 42 })} />,
      );

      const input = screen.getByTestId("field-testField");
      // Simulate what a real browser does: value becomes "" with validity.badInput = true
      Object.defineProperty(input, "validity", {
        value: { badInput: true },
        writable: true,
      });
      fireEvent.change(input, { target: { value: "" } });
      expect(onChange).toHaveBeenCalledWith(42);
    });

    it("does not call onChange when badInput and no previous valid value", () => {
      const onChange = vi.fn();
      render(
        <NumberField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: undefined })}
        />,
      );

      const input = screen.getByTestId("field-testField");
      Object.defineProperty(input, "validity", {
        value: { badInput: true },
        writable: true,
      });
      fireEvent.change(input, { target: { value: "" } });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("clamps NaN parsed value to previous valid", () => {
      const onChange = vi.fn();
      render(
        <NumberField descriptor={makeDescriptor()} field={makeField({ onChange, value: 10 })} />,
      );

      // jsdom sanitises invalid numeric values to "".
      // Simulate a non-empty NaN scenario (e.g. pasted garbage in a real browser)
      const input = screen.getByTestId("field-testField");
      Object.defineProperty(input, "validity", {
        value: { badInput: true },
        writable: true,
      });
      fireEvent.change(input, { target: { value: "" } });
      expect(onChange).toHaveBeenCalledWith(10);
    });
  });

  describe("error display", () => {
    it("does not render error element when no error is provided", () => {
      render(<NumberField descriptor={makeDescriptor()} field={makeField()} />);

      expect(screen.queryByTestId("error-testField")).not.toBeInTheDocument();
    });

    it("renders error message when error is provided", () => {
      render(
        <NumberField descriptor={makeDescriptor()} field={makeField()} error="Must be a number" />,
      );

      const errorEl = screen.getByTestId("error-testField");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl.textContent).toBe("Must be a number");
    });

    it("renders error with role=alert for accessibility", () => {
      render(<NumberField descriptor={makeDescriptor()} field={makeField()} error="Invalid" />);

      const errorEl = screen.getByTestId("error-testField");
      expect(errorEl.getAttribute("role")).toBe("alert");
    });

    it("sets aria-invalid=true when error is present", () => {
      render(<NumberField descriptor={makeDescriptor()} field={makeField()} error="Required" />);

      const input = screen.getByTestId("field-testField");
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });

    it("sets aria-invalid=false when no error", () => {
      render(<NumberField descriptor={makeDescriptor()} field={makeField()} />);

      const input = screen.getByTestId("field-testField");
      expect(input.getAttribute("aria-invalid")).toBe("false");
    });
  });

  describe("aria-describedby", () => {
    it("sets aria-describedby pointing to error element when error exists", () => {
      render(
        <NumberField
          descriptor={makeDescriptor({ name: "count" })}
          field={makeField()}
          error="Too large"
        />,
      );

      const input = screen.getByTestId("field-count");
      expect(input.getAttribute("aria-describedby")).toBe("error-count");

      const errorEl = screen.getByTestId("error-count");
      expect(errorEl.id).toBe("error-count");
    });

    it("does not set aria-describedby when there is no error", () => {
      render(<NumberField descriptor={makeDescriptor({ name: "count" })} field={makeField()} />);

      const input = screen.getByTestId("field-count");
      expect(input.getAttribute("aria-describedby")).toBeNull();
    });
  });

  describe("placeholder", () => {
    it("renders placeholder from descriptor.description", () => {
      render(
        <NumberField
          descriptor={makeDescriptor({ description: "Enter amount" })}
          field={makeField()}
        />,
      );

      const input = screen.getByTestId("field-testField");
      expect(input.placeholder).toBe("Enter amount");
    });
  });

  describe("edge cases", () => {
    it("handles zero value correctly", () => {
      render(<NumberField descriptor={makeDescriptor()} field={makeField({ value: 0 })} />);

      const input = screen.getByTestId("field-testField");
      expect(input.value).toBe("0");
    });

    it("sets the input name from field.name", () => {
      render(<NumberField descriptor={makeDescriptor()} field={makeField({ name: "myNumber" })} />);

      const input = screen.getByTestId("field-testField");
      expect(input.name).toBe("myNumber");
    });

    it("clamps to previous valid value on badInput (non-numeric rejected by browser)", () => {
      const onChange = vi.fn();
      render(
        <NumberField descriptor={makeDescriptor()} field={makeField({ onChange, value: 7 })} />,
      );

      const input = screen.getByTestId("field-testField");
      // Simulate browser rejecting non-numeric input: value is "" and validity.badInput is true
      Object.defineProperty(input, "validity", {
        value: { badInput: true },
        configurable: true,
      });
      fireEvent.change(input, { target: { value: "" } });
      // Should clamp to previous valid (7) because badInput is true
      expect(onChange).toHaveBeenCalledWith(7);
    });

    it("does not call onChange when empty input and no previous valid value", () => {
      const onChange = vi.fn();
      render(
        <NumberField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: undefined })}
        />,
      );

      const input = screen.getByTestId("field-testField");
      Object.defineProperty(input, "validity", {
        value: { badInput: true },
        configurable: true,
      });
      fireEvent.change(input, { target: { value: "" } });
      // No previous valid value and badInput=true, so onChange should not be called
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
