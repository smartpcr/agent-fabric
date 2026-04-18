import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { StringField } from "@/features/property-grid/fields/StringField";
import type { FieldComponentProps } from "@/features/property-grid/registry";
import type { FieldDescriptor } from "@/features/property-grid/introspect";

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
    type: "string",
    required: true,
    ...overrides,
  };
}

describe("StringField", () => {
  describe("rendering", () => {
    it("renders an input of type text", () => {
      render(<StringField descriptor={makeDescriptor()} field={makeField({ value: "" })} />);

      const input = screen.getByTestId("field-testField");
      expect(input.tagName).toBe("INPUT");
      expect(input.getAttribute("type")).toBe("text");
    });

    it("renders with the correct value", () => {
      render(
        <StringField descriptor={makeDescriptor()} field={makeField({ value: "Hello World" })} />,
      );

      const input = screen.getByTestId("field-testField");
      expect(input.value).toBe("Hello World");
    });

    it("renders empty string for null value", () => {
      render(<StringField descriptor={makeDescriptor()} field={makeField({ value: null })} />);

      const input = screen.getByTestId("field-testField");
      expect(input.value).toBe("");
    });

    it("renders empty string for undefined value", () => {
      render(<StringField descriptor={makeDescriptor()} field={makeField({ value: undefined })} />);

      const input = screen.getByTestId("field-testField");
      expect(input.value).toBe("");
    });

    it("has aria-label matching descriptor name", () => {
      render(<StringField descriptor={makeDescriptor({ name: "email" })} field={makeField()} />);

      const input = screen.getByTestId("field-email");
      expect(input.getAttribute("aria-label")).toBe("email");
    });

    it("has data-testid based on descriptor name", () => {
      render(<StringField descriptor={makeDescriptor({ name: "userName" })} field={makeField()} />);

      expect(screen.getByTestId("field-userName")).toBeInTheDocument();
    });
  });

  describe("placeholder from schema description", () => {
    it("renders placeholder from descriptor.description", () => {
      render(
        <StringField
          descriptor={makeDescriptor({ description: "Enter your name" })}
          field={makeField()}
        />,
      );

      const input = screen.getByTestId("field-testField");
      expect(input.placeholder).toBe("Enter your name");
    });

    it("renders no placeholder when description is absent", () => {
      render(<StringField descriptor={makeDescriptor()} field={makeField()} />);

      const input = screen.getByTestId("field-testField");
      expect(input.placeholder).toBe("");
    });
  });

  describe("onChange", () => {
    it("calls field.onChange when text is entered", () => {
      const onChange = vi.fn();
      render(<StringField descriptor={makeDescriptor()} field={makeField({ onChange })} />);

      const input = screen.getByTestId("field-testField");
      fireEvent.change(input, { target: { value: "new value" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("new value");
    });

    it("calls field.onBlur when input loses focus", () => {
      const onBlur = vi.fn();
      render(<StringField descriptor={makeDescriptor()} field={makeField({ onBlur })} />);

      const input = screen.getByTestId("field-testField");
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe("error display", () => {
    it("does not render error element when no error is provided", () => {
      render(<StringField descriptor={makeDescriptor()} field={makeField()} />);

      expect(screen.queryByTestId("error-testField")).not.toBeInTheDocument();
    });

    it("renders error message when error is provided", () => {
      render(
        <StringField
          descriptor={makeDescriptor()}
          field={makeField()}
          error="This field is required"
        />,
      );

      const errorEl = screen.getByTestId("error-testField");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl.textContent).toBe("This field is required");
    });

    it("renders error with role=alert for accessibility", () => {
      render(<StringField descriptor={makeDescriptor()} field={makeField()} error="Required" />);

      const errorEl = screen.getByTestId("error-testField");
      expect(errorEl.getAttribute("role")).toBe("alert");
    });

    it("sets aria-invalid=true when error is present", () => {
      render(<StringField descriptor={makeDescriptor()} field={makeField()} error="Required" />);

      const input = screen.getByTestId("field-testField");
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });

    it("sets aria-invalid=false when no error", () => {
      render(<StringField descriptor={makeDescriptor()} field={makeField()} />);

      const input = screen.getByTestId("field-testField");
      expect(input.getAttribute("aria-invalid")).toBe("false");
    });
  });

  describe("aria-describedby", () => {
    it("sets aria-describedby pointing to error element when error exists", () => {
      render(
        <StringField
          descriptor={makeDescriptor({ name: "username" })}
          field={makeField()}
          error="Too short"
        />,
      );

      const input = screen.getByTestId("field-username");
      expect(input.getAttribute("aria-describedby")).toBe("error-username");

      // Verify the referenced element exists with matching id
      const errorEl = screen.getByTestId("error-username");
      expect(errorEl.id).toBe("error-username");
    });

    it("does not set aria-describedby when there is no error", () => {
      render(<StringField descriptor={makeDescriptor({ name: "username" })} field={makeField()} />);

      const input = screen.getByTestId("field-username");
      expect(input.getAttribute("aria-describedby")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("coerces numeric value to string", () => {
      render(<StringField descriptor={makeDescriptor()} field={makeField({ value: 42 })} />);

      const input = screen.getByTestId("field-testField");
      expect(input.value).toBe("42");
    });

    it("sets the input name from field.name", () => {
      render(<StringField descriptor={makeDescriptor()} field={makeField({ name: "myField" })} />);

      const input = screen.getByTestId("field-testField");
      expect(input.name).toBe("myField");
    });
  });
});
