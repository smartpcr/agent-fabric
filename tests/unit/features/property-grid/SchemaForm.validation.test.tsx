import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { z } from "zod";
import { SchemaForm } from "@/features/property-grid/SchemaForm";

afterEach(cleanup);

describe("SchemaForm validation (zodResolver + mode: onChange)", () => {
  it("shows an error when a required string field is cleared", async () => {
    const schema = z.object({
      name: z.string().min(1, "Name is required"),
    });

    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={vi.fn()} />);

    const input = screen.getByTestId("field-name");
    fireEvent.change(input, { target: { value: "" } });

    await waitFor(() => {
      expect(screen.getByTestId("error-name")).toBeInTheDocument();
      expect(screen.getByTestId("error-name").textContent).toBe("Name is required");
    });
  });

  it("clears the error when a valid value is entered after an invalid one", async () => {
    const schema = z.object({
      name: z.string().min(1, "Name is required"),
    });

    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={vi.fn()} />);

    const input = screen.getByTestId("field-name");

    // Make invalid
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => {
      expect(screen.getByTestId("error-name")).toBeInTheDocument();
    });

    // Fix it
    fireEvent.change(input, { target: { value: "Bob" } });
    await waitFor(() => {
      expect(screen.queryByTestId("error-name")).not.toBeInTheDocument();
    });
  });

  it("shows a custom error message from the Zod schema", async () => {
    const schema = z.object({
      email: z.string().regex(/^[^@]+@[^@]+\.[^@]+$/, "Invalid email address"),
    });

    render(<SchemaForm schema={schema} value={{ email: "valid@test.com" }} onChange={vi.fn()} />);

    const input = screen.getByTestId("field-email");
    fireEvent.change(input, { target: { value: "not-an-email" } });

    await waitFor(() => {
      expect(screen.getByTestId("error-email")).toBeInTheDocument();
      expect(screen.getByTestId("error-email").textContent).toBe("Invalid email address");
    });
  });

  it("does not show errors for initially valid values", () => {
    const schema = z.object({
      name: z.string().min(1, "Required"),
    });

    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={vi.fn()} />);

    expect(screen.queryByTestId("error-name")).not.toBeInTheDocument();
  });

  it("sets aria-invalid on the input when there is an error", async () => {
    const schema = z.object({
      name: z.string().min(1, "Required"),
    });

    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={vi.fn()} />);

    const input = screen.getByTestId("field-name");
    expect(input.getAttribute("aria-invalid")).toBe("false");

    fireEvent.change(input, { target: { value: "" } });

    await waitFor(() => {
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });
  });

  it("clears aria-invalid when the error is resolved", async () => {
    const schema = z.object({
      name: z.string().min(1, "Required"),
    });

    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={vi.fn()} />);

    const input = screen.getByTestId("field-name");

    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => {
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });

    fireEvent.change(input, { target: { value: "Bob" } });
    await waitFor(() => {
      expect(input.getAttribute("aria-invalid")).toBe("false");
    });
  });

  it("shows errors on multiple fields simultaneously", async () => {
    const schema = z.object({
      firstName: z.string().min(1, "First name required"),
      lastName: z.string().min(1, "Last name required"),
    });

    render(
      <SchemaForm schema={schema} value={{ firstName: "A", lastName: "B" }} onChange={vi.fn()} />,
    );

    fireEvent.change(screen.getByTestId("field-firstName"), { target: { value: "" } });
    fireEvent.change(screen.getByTestId("field-lastName"), { target: { value: "" } });

    await waitFor(() => {
      expect(screen.getByTestId("error-firstName")).toBeInTheDocument();
      expect(screen.getByTestId("error-firstName").textContent).toBe("First name required");
      expect(screen.getByTestId("error-lastName")).toBeInTheDocument();
      expect(screen.getByTestId("error-lastName").textContent).toBe("Last name required");
    });
  });

  it("renders error spans with role=alert for accessibility", async () => {
    const schema = z.object({
      name: z.string().min(1, "Required"),
    });

    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={vi.fn()} />);

    fireEvent.change(screen.getByTestId("field-name"), { target: { value: "" } });

    await waitFor(() => {
      const errorEl = screen.getByTestId("error-name");
      expect(errorEl.getAttribute("role")).toBe("alert");
    });
  });

  it("still fires onChange even when validation fails", async () => {
    const schema = z.object({
      name: z.string().min(3, "Too short"),
    });

    const onChange = vi.fn();
    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={onChange} />);

    fireEvent.change(screen.getByTestId("field-name"), { target: { value: "AB" } });

    await waitFor(() => {
      // Error should show
      expect(screen.getByTestId("error-name")).toBeInTheDocument();
      // onChange should still have fired with the invalid value
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "AB" }));
    });
  });

  it("validates number fields via Zod constraints", async () => {
    const schema = z.object({
      age: z.number().min(0, "Must be non-negative").max(150, "Too large"),
    });

    render(<SchemaForm schema={schema} value={{ age: 25 }} onChange={vi.fn()} />);

    const input = screen.getByTestId("field-age");

    // Clear to trigger required/type error
    fireEvent.change(input, { target: { value: "" } });

    await waitFor(() => {
      expect(screen.getByTestId("error-age")).toBeInTheDocument();
    });
  });

  it("validates nested object fields", async () => {
    const schema = z.object({
      address: z.object({
        city: z.string().min(1, "City is required"),
      }),
    });

    render(
      <SchemaForm
        schema={schema}
        value={{ address: { city: "Springfield" } }}
        onChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("field-city"), { target: { value: "" } });

    await waitFor(() => {
      expect(screen.getByTestId("error-city")).toBeInTheDocument();
      expect(screen.getByTestId("error-city").textContent).toBe("City is required");
    });
  });

  it("clears nested object field errors when corrected", async () => {
    const schema = z.object({
      address: z.object({
        city: z.string().min(1, "City is required"),
      }),
    });

    render(
      <SchemaForm
        schema={schema}
        value={{ address: { city: "Springfield" } }}
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByTestId("field-city");

    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => {
      expect(screen.getByTestId("error-city")).toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: "Shelbyville" } });
    await waitFor(() => {
      expect(screen.queryByTestId("error-city")).not.toBeInTheDocument();
    });
  });

  it("validates string length constraints", async () => {
    const schema = z.object({
      code: z.string().length(4, "Must be exactly 4 characters"),
    });

    render(<SchemaForm schema={schema} value={{ code: "ABCD" }} onChange={vi.fn()} />);

    fireEvent.change(screen.getByTestId("field-code"), { target: { value: "AB" } });

    await waitFor(() => {
      expect(screen.getByTestId("error-code")).toBeInTheDocument();
      expect(screen.getByTestId("error-code").textContent).toBe("Must be exactly 4 characters");
    });
  });
});

describe("SchemaForm accessibility — aria-describedby and live region", () => {
  it("links input to error via aria-describedby when invalid", async () => {
    const schema = z.object({
      name: z.string().min(1, "Name is required"),
    });

    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={vi.fn()} />);

    const input = screen.getByTestId("field-name");
    expect(input.getAttribute("aria-describedby")).toBeNull();

    fireEvent.change(input, { target: { value: "" } });

    await waitFor(() => {
      expect(input.getAttribute("aria-describedby")).toBe("error-name");
      const errorSpan = screen.getByTestId("error-name");
      expect(errorSpan.getAttribute("id")).toBe("error-name");
    });
  });

  it("clears aria-describedby when error is resolved", async () => {
    const schema = z.object({
      name: z.string().min(1, "Required"),
    });

    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={vi.fn()} />);

    const input = screen.getByTestId("field-name");
    fireEvent.change(input, { target: { value: "" } });

    await waitFor(() => {
      expect(input.getAttribute("aria-describedby")).toBe("error-name");
    });

    fireEvent.change(input, { target: { value: "Bob" } });

    await waitFor(() => {
      expect(input.getAttribute("aria-describedby")).toBeNull();
    });
  });

  it("inputs have id matching their label htmlFor", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    render(<SchemaForm schema={schema} value={{ name: "Alice", age: 30 }} onChange={vi.fn()} />);

    const nameInput = screen.getByTestId("field-name");
    const ageInput = screen.getByTestId("field-age");

    expect(nameInput.getAttribute("id")).toBe("field-name");
    expect(ageInput.getAttribute("id")).toBe("field-age");
  });

  it("renders object fields in fieldset with legend", () => {
    const schema = z.object({
      address: z.object({
        city: z.string(),
      }),
    });

    render(<SchemaForm schema={schema} value={{ address: { city: "NYC" } }} onChange={vi.fn()} />);

    const fieldset = screen.getByTestId("field-wrapper-address");
    expect(fieldset.tagName).toBe("FIELDSET");
    expect(fieldset.querySelector("legend")?.textContent).toBe("address");
  });

  it("shows validation live region with error summary", async () => {
    const schema = z.object({
      name: z.string().min(1, "Name is required"),
    });

    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={vi.fn()} />);

    const liveRegion = screen.getByTestId("validation-live-region");
    expect(liveRegion.getAttribute("aria-live")).toBe("polite");
    expect(liveRegion.textContent).toBe("");

    fireEvent.change(screen.getByTestId("field-name"), { target: { value: "" } });

    await waitFor(() => {
      expect(liveRegion.textContent).toContain("validation error");
      expect(liveRegion.textContent).toContain("Name is required");
    });
  });

  it("clears validation live region when errors are resolved", async () => {
    const schema = z.object({
      name: z.string().min(1, "Required"),
    });

    render(<SchemaForm schema={schema} value={{ name: "Alice" }} onChange={vi.fn()} />);

    const liveRegion = screen.getByTestId("validation-live-region");

    fireEvent.change(screen.getByTestId("field-name"), { target: { value: "" } });
    await waitFor(() => {
      expect(liveRegion.textContent).toContain("validation error");
    });

    fireEvent.change(screen.getByTestId("field-name"), { target: { value: "Bob" } });
    await waitFor(
      () => {
        expect(liveRegion.textContent).toBe("");
      },
      { timeout: 3000 },
    );
  });
});
