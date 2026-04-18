import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import { z } from "zod";
import { ObjectField } from "@/features/property-grid/fields/ObjectField";
import type { FieldComponentProps } from "@/features/property-grid/registry";
import type { FieldDescriptor } from "@/features/property-grid/introspect";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function makeField(
  overrides: Partial<FieldComponentProps["field"]> = {},
): FieldComponentProps["field"] {
  return {
    value: {},
    onChange: vi.fn(),
    onBlur: vi.fn(),
    name: "address",
    ref: vi.fn(),
    ...overrides,
  };
}

function makeDescriptor(overrides: Partial<FieldDescriptor> = {}): FieldDescriptor {
  return {
    name: "address",
    type: "object",
    required: true,
    children: [
      { name: "street", type: "string", required: true },
      { name: "city", type: "string", required: true },
    ],
    ...overrides,
  };
}

const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
});

describe("ObjectField", () => {
  describe("rendering", () => {
    it("renders the object field container", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      expect(screen.getByTestId("object-field-address")).toBeInTheDocument();
    });

    it("renders the header with field name", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      const header = screen.getByTestId("object-header-address");
      expect(header).toBeInTheDocument();
      expect(header.textContent).toContain("address");
    });

    it("renders the toggle button", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      const toggle = screen.getByTestId("object-toggle-address");
      expect(toggle).toBeInTheDocument();
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
    });

    it("renders nested fields via SchemaFormFields when expanded", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField({ value: { street: "123 Main", city: "Springfield" } })}
          objectSchema={addressSchema}
        />,
      );

      const content = screen.getByTestId("object-content-address");
      expect(content).toBeInTheDocument();

      // SchemaFormFields renders field inputs with data-testid="field-{name}"
      expect(within(content).getByTestId("field-street")).toBeInTheDocument();
      expect(within(content).getByTestId("field-city")).toBeInTheDocument();
    });

    it("renders field values from the object", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField({ value: { street: "123 Main", city: "Springfield" } })}
          objectSchema={addressSchema}
        />,
      );

      expect(screen.getByTestId("field-street")).toHaveDisplayValue("123 Main");
      expect(screen.getByTestId("field-city")).toHaveDisplayValue("Springfield");
    });

    it("renders content area with role=group", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      const content = screen.getByTestId("object-content-address");
      expect(content.getAttribute("role")).toBe("group");
      expect(content.getAttribute("aria-label")).toBe("address fields");
    });

    it("renders no-schema message when objectSchema is not provided", () => {
      render(<ObjectField descriptor={makeDescriptor()} field={makeField()} />);

      expect(screen.getByTestId("object-no-schema-address")).toBeInTheDocument();
    });
  });

  describe("collapse/expand", () => {
    it("starts expanded by default", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      expect(screen.getByTestId("object-content-address")).toBeInTheDocument();
      expect(screen.getByTestId("object-toggle-address").getAttribute("aria-expanded")).toBe(
        "true",
      );
    });

    it("collapses when toggle is clicked", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      fireEvent.click(screen.getByTestId("object-toggle-address"));

      expect(screen.queryByTestId("object-content-address")).not.toBeInTheDocument();
      expect(screen.getByTestId("object-toggle-address").getAttribute("aria-expanded")).toBe(
        "false",
      );
    });

    it("re-expands when toggle is clicked twice", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      fireEvent.click(screen.getByTestId("object-toggle-address"));
      expect(screen.queryByTestId("object-content-address")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("object-toggle-address"));
      expect(screen.getByTestId("object-content-address")).toBeInTheDocument();
    });

    it("shows collapse indicator (▶) when collapsed", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      fireEvent.click(screen.getByTestId("object-toggle-address"));

      const toggle = screen.getByTestId("object-toggle-address");
      expect(toggle.textContent).toContain("▶");
    });

    it("shows expand indicator (▼) when expanded", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      const toggle = screen.getByTestId("object-toggle-address");
      expect(toggle.textContent).toContain("▼");
    });

    it("has correct aria-label for collapse state", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      const toggle = screen.getByTestId("object-toggle-address");
      expect(toggle.getAttribute("aria-label")).toBe("Collapse address");

      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-label")).toBe("Expand address");
    });

    it("toggle has aria-controls pointing to content", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      const toggle = screen.getByTestId("object-toggle-address");
      expect(toggle.getAttribute("aria-controls")).toBe("object-content-address");
    });
  });

  describe("session-storage persistence", () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    it("persists collapsed state to sessionStorage", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      fireEvent.click(screen.getByTestId("object-toggle-address"));

      expect(sessionStorage.getItem("object-field-collapsed:address")).toBe("true");
    });

    it("persists expanded state to sessionStorage", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      // Collapse then expand
      fireEvent.click(screen.getByTestId("object-toggle-address"));
      fireEvent.click(screen.getByTestId("object-toggle-address"));

      expect(sessionStorage.getItem("object-field-collapsed:address")).toBe("false");
    });

    it("restores collapsed state from sessionStorage on mount", () => {
      sessionStorage.setItem("object-field-collapsed:address", "true");

      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      // Should start collapsed
      expect(screen.queryByTestId("object-content-address")).not.toBeInTheDocument();
      expect(screen.getByTestId("object-toggle-address").getAttribute("aria-expanded")).toBe(
        "false",
      );
    });

    it("restores expanded state from sessionStorage on mount", () => {
      sessionStorage.setItem("object-field-collapsed:address", "false");

      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      expect(screen.getByTestId("object-content-address")).toBeInTheDocument();
      expect(screen.getByTestId("object-toggle-address").getAttribute("aria-expanded")).toBe(
        "true",
      );
    });

    it("uses field-specific storage keys", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor({ name: "settings" })}
          field={makeField({ name: "settings" })}
          objectSchema={addressSchema}
        />,
      );

      fireEvent.click(screen.getByTestId("object-toggle-settings"));

      expect(sessionStorage.getItem("object-field-collapsed:settings")).toBe("true");
      expect(sessionStorage.getItem("object-field-collapsed:address")).toBeNull();
    });
  });

  describe("nested SchemaForm rendering", () => {
    it("renders nested fields through SchemaFormFields", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField({ value: { street: "Elm St", city: "NY" } })}
          objectSchema={addressSchema}
        />,
      );

      expect(screen.getByTestId("field-street")).toHaveDisplayValue("Elm St");
      expect(screen.getByTestId("field-city")).toHaveDisplayValue("NY");
    });

    it("propagates changes from nested fields to field.onChange", async () => {
      const onChange = vi.fn();

      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: { street: "Elm St", city: "NY" } })}
          objectSchema={addressSchema}
        />,
      );

      const streetInput = screen.getByTestId("field-street");
      fireEvent.change(streetInput, { target: { value: "Oak Ave" } });

      // SchemaFormFields uses react-hook-form watch which fires async
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });

      // The last onChange call should contain the updated object
      const calls = onChange.mock.calls as unknown[][];
      const lastCall = calls[calls.length - 1] as unknown[];
      const result = lastCall[0] as Record<string, unknown>;
      expect(result.street).toBe("Oak Ave");
    });

    it("renders with empty object when field.value is null", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField({ value: null })}
          objectSchema={addressSchema}
        />,
      );

      // Should render without crashing
      expect(screen.getByTestId("object-content-address")).toBeInTheDocument();
      expect(screen.getByTestId("field-street")).toBeInTheDocument();
    });

    it("renders with empty object when field.value is undefined", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField({ value: undefined })}
          objectSchema={addressSchema}
        />,
      );

      expect(screen.getByTestId("object-content-address")).toBeInTheDocument();
    });

    it("renders nested fields for multi-field schemas", () => {
      const schema = z.object({
        firstName: z.string(),
        lastName: z.string(),
        age: z.number(),
      });

      render(
        <ObjectField
          descriptor={makeDescriptor({
            name: "person",
            children: [
              { name: "firstName", type: "string", required: true },
              { name: "lastName", type: "string", required: true },
              { name: "age", type: "number", required: true },
            ],
          })}
          field={makeField({
            name: "person",
            value: { firstName: "Alice", lastName: "Smith", age: 30 },
          })}
          objectSchema={schema}
        />,
      );

      expect(screen.getByTestId("field-firstName")).toHaveDisplayValue("Alice");
      expect(screen.getByTestId("field-lastName")).toHaveDisplayValue("Smith");
      expect(screen.getByTestId("field-age")).toHaveDisplayValue("30");
    });
  });

  describe("error display and aggregation", () => {
    it("does not render error when no error", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      expect(screen.queryByTestId("error-address")).not.toBeInTheDocument();
    });

    it("renders explicit error message", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
          error="Address is required"
        />,
      );

      const errorEl = screen.getByTestId("error-address");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl.textContent).toBe("Address is required");
      expect(errorEl.getAttribute("role")).toBe("alert");
    });

    it("aggregates single nested error into count", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
          childErrors={{ street: "Street is required", city: undefined }}
        />,
      );

      const errorEl = screen.getByTestId("error-address");
      expect(errorEl.textContent).toBe("1 nested error");
    });

    it("aggregates multiple nested errors into count", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
          childErrors={{ street: "Required", city: "Required" }}
        />,
      );

      const errorEl = screen.getByTestId("error-address");
      expect(errorEl.textContent).toBe("2 nested errors");
    });

    it("renders error count badge for nested errors", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
          childErrors={{ street: "Required", city: "Required" }}
        />,
      );

      const countBadge = screen.getByTestId("error-count-address");
      expect(countBadge).toBeInTheDocument();
      expect(countBadge.textContent).toBe("2");
      expect(countBadge.getAttribute("aria-label")).toBe("2 errors");
    });

    it("does not render count badge when no nested errors", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
          childErrors={{ street: undefined, city: undefined }}
        />,
      );

      expect(screen.queryByTestId("error-count-address")).not.toBeInTheDocument();
    });

    it("prefers explicit error over aggregated nested errors", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
          error="Explicit error"
          childErrors={{ street: "Required", city: "Required" }}
        />,
      );

      const errorEl = screen.getByTestId("error-address");
      expect(errorEl.textContent).toBe("Explicit error");

      // Count badge should not appear when explicit error is shown
      expect(screen.queryByTestId("error-count-address")).not.toBeInTheDocument();
    });

    it("renders error with role=alert", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
          error="Required"
        />,
      );

      const errorEl = screen.getByTestId("error-address");
      expect(errorEl.getAttribute("role")).toBe("alert");
    });

    it("renders aggregated error with role=alert", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
          childErrors={{ street: "Bad" }}
        />,
      );

      const errorEl = screen.getByTestId("error-address");
      expect(errorEl.getAttribute("role")).toBe("alert");
    });

    it("error count badge has singular label for 1 error", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
          childErrors={{ street: "Required", city: undefined }}
        />,
      );

      const countBadge = screen.getByTestId("error-count-address");
      expect(countBadge.getAttribute("aria-label")).toBe("1 error");
    });
  });

  describe("accessibility", () => {
    it("toggle button has aria-expanded", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      const toggle = screen.getByTestId("object-toggle-address");
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
    });

    it("toggle button is type=button", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      const toggle = screen.getByTestId("object-toggle-address");
      expect(toggle.getAttribute("type")).toBe("button");
    });

    it("collapse indicator is aria-hidden", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
        />,
      );

      const toggle = screen.getByTestId("object-toggle-address");
      const indicator = toggle.querySelector("[aria-hidden]");
      expect(indicator).toBeInTheDocument();
      expect(indicator?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("edge cases", () => {
    it("handles non-object field.value gracefully", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField({ value: "not-an-object" })}
          objectSchema={addressSchema}
        />,
      );

      // Should render without crashing, treating as empty object
      expect(screen.getByTestId("object-content-address")).toBeInTheDocument();
    });

    it("handles empty childErrors object", () => {
      render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField()}
          objectSchema={addressSchema}
          childErrors={{}}
        />,
      );

      expect(screen.queryByTestId("error-address")).not.toBeInTheDocument();
      expect(screen.queryByTestId("error-count-address")).not.toBeInTheDocument();
    });

    it("preserves collapse state across renders", () => {
      const { rerender } = render(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField({ value: { street: "Elm" } })}
          objectSchema={addressSchema}
        />,
      );

      // Collapse
      fireEvent.click(screen.getByTestId("object-toggle-address"));
      expect(screen.queryByTestId("object-content-address")).not.toBeInTheDocument();

      // Re-render with new value — should remain collapsed
      rerender(
        <ObjectField
          descriptor={makeDescriptor()}
          field={makeField({ value: { street: "Oak" } })}
          objectSchema={addressSchema}
        />,
      );

      expect(screen.queryByTestId("object-content-address")).not.toBeInTheDocument();
    });
  });
});
