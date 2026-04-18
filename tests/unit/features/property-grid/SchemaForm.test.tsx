import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { z } from "zod";
import {
  SchemaForm,
  introspectSchema,
  defaultFieldRegistry,
  type FieldResolver,
  type FieldComponentProps,
} from "@/features/property-grid/SchemaForm";

afterEach(cleanup);

describe("introspectSchema", () => {
  it("returns field descriptors for a flat object schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      active: z["boolean"](),
    });

    const fields = introspectSchema(schema);

    expect(fields).toHaveLength(3);
    expect(fields[0]).toEqual({
      name: "name",
      type: "string",
      required: true,
      defaultValue: undefined,
      enumValues: undefined,
      children: undefined,
    });
    expect(fields[1]).toEqual({
      name: "age",
      type: "number",
      required: true,
      defaultValue: undefined,
      enumValues: undefined,
      children: undefined,
    });
    expect(fields[2]).toEqual({
      name: "active",
      type: "boolean",
      required: true,
      defaultValue: undefined,
      enumValues: undefined,
      children: undefined,
    });
  });

  it("handles optional fields", () => {
    const schema = z.object({
      label: z.string().optional(),
    });

    const fields = introspectSchema(schema);
    expect(fields[0]?.required).toBe(false);
  });

  it("handles default values", () => {
    const schema = z.object({
      count: z.number()["default"](42),
    });

    const fields = introspectSchema(schema);
    expect(fields[0]?.required).toBe(false);
    expect(fields[0]?.defaultValue).toBe(42);
  });

  it("handles enum fields", () => {
    const schema = z.object({
      color: z["enum"](["red", "green", "blue"]),
    });

    const fields = introspectSchema(schema);
    expect(fields[0]?.type).toBe("enum");
    expect(fields[0]?.enumValues).toEqual(["red", "green", "blue"]);
  });

  it("returns empty array for non-object schemas", () => {
    const schema = z.string();
    const fields = introspectSchema(schema);
    expect(fields).toEqual([]);
  });

  it("recursively introspects nested object schemas", () => {
    const schema = z.object({
      name: z.string(),
      address: z.object({
        street: z.string(),
        city: z.string(),
      }),
    });

    const fields = introspectSchema(schema);

    expect(fields).toHaveLength(2);
    expect(fields[1]?.type).toBe("object");
    expect(fields[1]?.children).toHaveLength(2);
    expect(fields[1]?.children?.[0]?.name).toBe("street");
    expect(fields[1]?.children?.[0]?.type).toBe("string");
    expect(fields[1]?.children?.[1]?.name).toBe("city");
    expect(fields[1]?.children?.[1]?.type).toBe("string");
  });

  it("handles deeply nested objects", () => {
    const schema = z.object({
      level1: z.object({
        level2: z.object({
          value: z.number(),
        }),
      }),
    });

    const fields = introspectSchema(schema);
    expect(fields[0]?.children?.[0]?.children?.[0]?.name).toBe("value");
    expect(fields[0]?.children?.[0]?.children?.[0]?.type).toBe("number");
  });
});

describe("defaultFieldRegistry", () => {
  it("resolves string type to a component", () => {
    const Component = defaultFieldRegistry.resolveField({
      name: "x",
      type: "string",
      required: true,
    });
    expect(Component).toBeDefined();
  });

  it("resolves number type to a component", () => {
    const Component = defaultFieldRegistry.resolveField({
      name: "x",
      type: "number",
      required: true,
    });
    expect(Component).toBeDefined();
  });

  it("resolves boolean type to a component", () => {
    const Component = defaultFieldRegistry.resolveField({
      name: "x",
      type: "boolean",
      required: true,
    });
    expect(Component).toBeDefined();
  });

  it("resolves enum type to a component", () => {
    const Component = defaultFieldRegistry.resolveField({
      name: "x",
      type: "enum",
      required: true,
      enumValues: ["a"],
    });
    expect(Component).toBeDefined();
  });

  it("falls back to string component for unknown types", () => {
    const Component = defaultFieldRegistry.resolveField({
      name: "x",
      type: "unknown",
      required: true,
    });
    const StringComponent = defaultFieldRegistry.resolveField({
      name: "x",
      type: "string",
      required: true,
    });
    expect(Component).toBe(StringComponent);
  });
});

describe("SchemaForm", () => {
  it("renders a form element with data-testid", () => {
    const schema = z.object({ name: z.string() });
    render(<SchemaForm schema={schema} value={{ name: "" }} onChange={vi.fn()} />);

    expect(screen.getByTestId("schema-form")).toBeInTheDocument();
  });

  it("renders fields for each property in the schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      active: z["boolean"](),
    });

    render(
      <SchemaForm
        schema={schema}
        value={{ name: "Alice", age: 30, active: true }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("field-name")).toBeInTheDocument();
    expect(screen.getByTestId("field-age")).toBeInTheDocument();
    expect(screen.getByTestId("field-active")).toBeInTheDocument();
  });

  it("renders string fields as text inputs", () => {
    const schema = z.object({ name: z.string() });
    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={vi.fn()} />);

    const input = screen.getByTestId("field-name");
    expect(input.type).toBe("text");
    expect(input.value).toBe("Alice");
  });

  it("renders number fields as number inputs", () => {
    const schema = z.object({ age: z.number() });
    render(<SchemaForm schema={schema} value={{ age: 30 }} onChange={vi.fn()} />);

    const input = screen.getByTestId("field-age");
    expect(input.type).toBe("number");
    expect(input.value).toBe("30");
  });

  it("renders boolean fields as checkboxes", () => {
    const schema = z.object({ active: z["boolean"]() });
    render(<SchemaForm schema={schema} value={{ active: true }} onChange={vi.fn()} />);

    const input = screen.getByTestId("field-active");
    expect(input.type).toBe("checkbox");
    expect(input.checked).toBe(true);
  });

  it("renders enum fields as select elements", () => {
    const schema = z.object({ color: z["enum"](["red", "green", "blue"]) });
    render(<SchemaForm schema={schema} value={{ color: "green" }} onChange={vi.fn()} />);

    const select = screen.getByTestId("field-color");
    expect(select.tagName).toBe("SELECT");
    expect(select.value).toBe("green");
    expect(select.options).toHaveLength(3);
  });

  it("renders labels for each field", () => {
    const schema = z.object({ name: z.string() });
    render(<SchemaForm schema={schema} value={{ name: "" }} onChange={vi.fn()} />);

    expect(screen.getByText("name")).toBeInTheDocument();
  });

  it("fires onChange when a string field is edited", async () => {
    const schema = z.object({ name: z.string() });
    const onChange = vi.fn();
    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={onChange} />);

    const input = screen.getByTestId("field-name");
    fireEvent.change(input, { target: { value: "Bob" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Bob" }));
    });
  });

  it("fires onChange when a number field is edited", async () => {
    const schema = z.object({ age: z.number() });
    const onChange = vi.fn();
    render(<SchemaForm schema={schema} value={{ age: 30 }} onChange={onChange} />);

    const input = screen.getByTestId("field-age");
    fireEvent.change(input, { target: { value: "25" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ age: 25 }));
    });
  });

  it("fires onChange when a boolean field is toggled", async () => {
    const schema = z.object({ active: z["boolean"]() });
    const onChange = vi.fn();
    render(<SchemaForm schema={schema} value={{ active: false }} onChange={onChange} />);

    const input = screen.getByTestId("field-active");
    fireEvent.click(input);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
    });
  });

  it("fires onChange when an enum field is changed", async () => {
    const schema = z.object({ color: z["enum"](["red", "green", "blue"]) });
    const onChange = vi.fn();
    render(<SchemaForm schema={schema} value={{ color: "red" }} onChange={onChange} />);

    const select = screen.getByTestId("field-color");
    fireEvent.change(select, { target: { value: "blue" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ color: "blue" }));
    });
  });

  it("renders wrapper divs with field-wrapper testids", () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    render(<SchemaForm schema={schema} value={{ name: "", age: 0 }} onChange={vi.fn()} />);

    expect(screen.getByTestId("field-wrapper-name")).toBeInTheDocument();
    expect(screen.getByTestId("field-wrapper-age")).toBeInTheDocument();
  });

  it("renders nothing for an empty schema", () => {
    const schema = z.object({});
    render(<SchemaForm schema={schema} value={{}} onChange={vi.fn()} />);

    const form = screen.getByTestId("schema-form");
    // Only the validation live region (visually hidden) should be present
    expect(form.querySelectorAll("[data-testid^='field-wrapper-']")).toHaveLength(0);
  });

  it("updates form values when external value changes", () => {
    const schema = z.object({ name: z.string() });
    const onChange = vi.fn();

    const { rerender } = render(
      <SchemaForm schema={schema} value={{ name: "Alice" }} onChange={onChange} />,
    );

    expect(screen.getByTestId("field-name").value).toBe("Alice");

    rerender(<SchemaForm schema={schema} value={{ name: "Bob" }} onChange={onChange} />);

    expect(screen.getByTestId("field-name").value).toBe("Bob");
  });

  it("handles a mixed schema with multiple field types", async () => {
    const schema = z.object({
      title: z.string(),
      count: z.number(),
      enabled: z["boolean"](),
      priority: z["enum"](["low", "medium", "high"]),
    });

    const onChange = vi.fn();
    render(
      <SchemaForm
        schema={schema}
        value={{ title: "Test", count: 5, enabled: false, priority: "low" }}
        onChange={onChange}
      />,
    );

    expect(screen.getByTestId("field-title")).toBeInTheDocument();
    expect(screen.getByTestId("field-count")).toBeInTheDocument();
    expect(screen.getByTestId("field-enabled")).toBeInTheDocument();
    expect(screen.getByTestId("field-priority")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("field-title"), { target: { value: "Updated" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: "Updated" }));
    });
  });

  it("renders nested object fields as a recursive fieldset tree", () => {
    const schema = z.object({
      name: z.string(),
      address: z.object({
        street: z.string(),
        city: z.string(),
      }),
    });

    render(
      <SchemaForm
        schema={schema}
        value={{ name: "Alice", address: { street: "123 Main St", city: "Springfield" } }}
        onChange={vi.fn()}
      />,
    );

    // Top-level string field
    expect(screen.getByTestId("field-name")).toBeInTheDocument();

    // Nested object rendered as fieldset
    const addressFieldset = screen.getByTestId("field-wrapper-address");
    expect(addressFieldset.tagName).toBe("FIELDSET");

    // Children rendered inside
    expect(screen.getByTestId("field-street")).toBeInTheDocument();
    expect(screen.getByTestId("field-city")).toBeInTheDocument();
  });

  it("fires onChange for nested object field edits", async () => {
    const schema = z.object({
      address: z.object({
        city: z.string(),
      }),
    });

    const onChange = vi.fn();
    render(
      <SchemaForm
        schema={schema}
        value={{ address: { city: "Springfield" } }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId("field-city"), { target: { value: "Shelbyville" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          address: expect.objectContaining({ city: "Shelbyville" }) as Record<string, unknown>,
        }),
      );
    });
  });

  it("accepts a custom field registry", () => {
    function CustomString({ descriptor }: FieldComponentProps) {
      return <span data-testid={`custom-${descriptor.name}`}>custom</span>;
    }

    const customRegistry: FieldResolver = {
      resolveField: () => CustomString,
    };

    const schema = z.object({ name: z.string() });
    render(
      <SchemaForm
        schema={schema}
        value={{ name: "test" }}
        onChange={vi.fn()}
        fieldRegistry={customRegistry}
      />,
    );

    expect(screen.getByTestId("custom-name")).toBeInTheDocument();
    expect(screen.getByTestId("custom-name").textContent).toBe("custom");
  });

  it("uses default registry when no custom registry provided", () => {
    const schema = z.object({ name: z.string() });
    render(<SchemaForm schema={schema} value={{ name: "test" }} onChange={vi.fn()} />);

    // Default registry renders an input
    const input = screen.getByTestId("field-name");
    expect(input.tagName).toBe("INPUT");
  });
});
