import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { ArrayField, reorderArray } from "@/features/property-grid/fields/ArrayField";
import {
  FieldRegistry,
  type FieldComponentProps,
  type FieldComponent,
} from "@/features/property-grid/registry";
import type { FieldDescriptor } from "@/features/property-grid/introspect";

// ─── Module-level mocks (hoisted by vitest) ─────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

const mockState = vi.hoisted(() => ({
  nanoidCounter: 0,
  capturedOnDragEnd: undefined as ((event: any) => void) | undefined,
}));

vi.mock("nanoid", () => ({
  nanoid: () => {
    const id = mockState.nanoidCounter;
    mockState.nanoidCounter += 1;
    return `test-id-${String(id)}`;
  },
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: (props: any) => {
    mockState.capturedOnDragEnd = props.onDragEnd;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return props.children;
  },
  closestCenter: () => null,
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock("@dnd-kit/sortable", () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  SortableContext: (props: any) => props.children,
  sortableKeyboardCoordinates: () => null,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
  }),
  verticalListSortingStrategy: "vertical",
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

beforeEach(() => {
  mockState.nanoidCounter = 0;
  mockState.capturedOnDragEnd = undefined;
});

afterEach(cleanup);

/** Extract the first onChange call argument as an array, or fail. */
function getOnChangeResult(onChange: ReturnType<typeof vi.fn>): unknown[] {
  const calls = onChange.mock.calls as unknown[][];
  expect(calls.length).toBeGreaterThan(0);
  return calls[0]?.[0] as unknown[];
}

function makeField(
  overrides: Partial<FieldComponentProps["field"]> = {},
): FieldComponentProps["field"] {
  return {
    value: [],
    onChange: vi.fn(),
    onBlur: vi.fn(),
    name: "tags",
    ref: vi.fn(),
    ...overrides,
  };
}

function makeDescriptor(overrides: Partial<FieldDescriptor> = {}): FieldDescriptor {
  return {
    name: "tags",
    type: "array",
    required: false,
    elementType: {
      name: "element",
      type: "string",
      required: true,
    },
    ...overrides,
  };
}

/** A custom field component for testing registry-based rendering. */
function CustomNumberField({ descriptor, field, error }: FieldComponentProps) {
  return (
    <div data-testid={`custom-number-${descriptor.name}`}>
      <input
        type="number"
        value={field.value !== null && field.value !== undefined ? String(field.value) : "0"}
        onChange={(e) => {
          field.onChange(Number(e.target.value));
        }}
        data-testid={`array-input-${descriptor.name}`}
        aria-label={descriptor.name}
      />
      {error && (
        <span data-testid={`item-error-${descriptor.name}`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** Custom string field for testing registry resolution of object children. */
function CustomStringField({ descriptor, field }: FieldComponentProps) {
  return (
    <div data-testid={`custom-string-${descriptor.name}`}>
      <input
        type="text"
        value={field.value !== null && field.value !== undefined ? String(field.value) : ""}
        onChange={(e) => {
          field.onChange(e.target.value);
        }}
        data-testid={`array-input-${descriptor.name}`}
        aria-label={descriptor.name}
      />
    </div>
  );
}

describe("ArrayField", () => {
  describe("rendering", () => {
    it("renders an empty array with no items", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: [] })} />);

      expect(screen.getByTestId("array-field-tags")).toBeInTheDocument();
      expect(screen.getByTestId("array-list-tags")).toBeInTheDocument();
      expect(screen.queryByTestId("array-item-tags-0")).not.toBeInTheDocument();
    });

    it("renders existing items from field.value", () => {
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ value: ["alpha", "beta", "gamma"] })}
        />,
      );

      expect(screen.getByTestId("array-item-tags-0")).toBeInTheDocument();
      expect(screen.getByTestId("array-item-tags-1")).toBeInTheDocument();
      expect(screen.getByTestId("array-item-tags-2")).toBeInTheDocument();
    });

    it("renders each item with a drag handle and remove button", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: ["hello"] })} />);

      expect(screen.getByTestId("drag-handle-tags-0")).toBeInTheDocument();
      expect(screen.getByTestId("remove-tags-0")).toBeInTheDocument();
    });

    it("renders the add button", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: [] })} />);

      const addBtn = screen.getByTestId("add-tags");
      expect(addBtn).toBeInTheDocument();
      expect(addBtn.textContent).toBe("+");
    });

    it("renders item values in inputs via inline field", () => {
      render(
        <ArrayField descriptor={makeDescriptor()} field={makeField({ value: ["foo", "bar"] })} />,
      );

      const input0 = screen.getByTestId("array-input-tags-0");
      const input1 = screen.getByTestId("array-input-tags-1");
      expect(input0).toHaveDisplayValue("foo");
      expect(input1).toHaveDisplayValue("bar");
    });

    it("uses role=list for the container and role=listitem for items", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: ["a"] })} />);

      expect(screen.getByRole("list")).toBeInTheDocument();
      expect(screen.getByRole("listitem")).toBeInTheDocument();
    });
  });

  describe("recursive rendering via field registry", () => {
    it("uses the registry-resolved component for element items", () => {
      const registry = new FieldRegistry(CustomNumberField as FieldComponent);
      registry.registerField("number", CustomNumberField as FieldComponent);

      render(
        <ArrayField
          descriptor={makeDescriptor({
            elementType: { name: "element", type: "number", required: true },
          })}
          field={makeField({ value: [42, 7] })}
          fieldResolver={registry}
        />,
      );

      // Custom component renders with custom-number testid
      expect(screen.getByTestId("custom-number-tags-0")).toBeInTheDocument();
      expect(screen.getByTestId("custom-number-tags-1")).toBeInTheDocument();
    });

    it("falls back to inline text input when no fieldResolver is provided", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: ["hello"] })} />);

      // Default inline field renders an input
      const input = screen.getByTestId("array-input-tags-0");
      expect(input.tagName).toBe("INPUT");
      expect(input).toHaveDisplayValue("hello");
    });

    it("delegates item onChange to the registry-resolved component", () => {
      const onChange = vi.fn();
      const registry = new FieldRegistry(CustomNumberField as FieldComponent);
      registry.registerField("number", CustomNumberField as FieldComponent);

      render(
        <ArrayField
          descriptor={makeDescriptor({
            elementType: { name: "element", type: "number", required: true },
          })}
          field={makeField({ onChange, value: [10] })}
          fieldResolver={registry}
        />,
      );

      const input = screen.getByTestId("array-input-tags-0");
      fireEvent.change(input, { target: { value: "99" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      const result = getOnChangeResult(onChange);
      expect(result).toEqual([99]);
    });

    it("recursively renders object-type items with child fields", () => {
      render(
        <ArrayField
          descriptor={makeDescriptor({
            elementType: {
              name: "element",
              type: "object",
              required: true,
              children: [
                { name: "firstName", type: "string", required: true },
                { name: "age", type: "number", required: false },
              ],
            },
          })}
          field={makeField({ value: [{ firstName: "Alice", age: 30 }] })}
        />,
      );

      // Object items should render with child fields via recursive form path
      expect(screen.getByTestId("object-fields-tags-0")).toBeInTheDocument();
      // Each child field gets a testid with the item name + child name
      expect(screen.getByTestId("array-input-tags-0-firstName")).toBeInTheDocument();
      expect(screen.getByTestId("array-input-tags-0-age")).toBeInTheDocument();
    });

    it("propagates changes from nested object child fields to onChange", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor({
            elementType: {
              name: "element",
              type: "object",
              required: true,
              children: [{ name: "name", type: "string", required: true }],
            },
          })}
          field={makeField({ onChange, value: [{ name: "Bob" }] })}
        />,
      );

      const input = screen.getByTestId("array-input-tags-0-name");
      fireEvent.change(input, { target: { value: "Charlie" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      const result = getOnChangeResult(onChange);
      expect(result).toEqual([{ name: "Charlie" }]);
    });

    it("resolves object child fields via the field registry (mirrors SchemaForm FieldTree)", () => {
      const registry = new FieldRegistry(CustomStringField as FieldComponent);
      registry.registerField("string", CustomStringField as FieldComponent);
      registry.registerField("number", CustomNumberField as FieldComponent);

      render(
        <ArrayField
          descriptor={makeDescriptor({
            elementType: {
              name: "element",
              type: "object",
              required: true,
              children: [
                { name: "name", type: "string", required: true },
                { name: "score", type: "number", required: false },
              ],
            },
          })}
          field={makeField({ value: [{ name: "Alice", score: 95 }] })}
          fieldResolver={registry}
        />,
      );

      // String child resolved via registry to CustomStringField
      expect(screen.getByTestId("custom-string-tags-0-name")).toBeInTheDocument();

      // Number child resolved via registry to CustomNumberField
      expect(screen.getByTestId("custom-number-tags-0-score")).toBeInTheDocument();
    });

    it("propagates changes from registry-resolved object child fields", () => {
      const onChange = vi.fn();
      const registry = new FieldRegistry(CustomStringField as FieldComponent);
      registry.registerField("string", CustomStringField as FieldComponent);
      registry.registerField("number", CustomNumberField as FieldComponent);

      render(
        <ArrayField
          descriptor={makeDescriptor({
            elementType: {
              name: "element",
              type: "object",
              required: true,
              children: [
                { name: "name", type: "string", required: true },
                { name: "score", type: "number", required: false },
              ],
            },
          })}
          field={makeField({ onChange, value: [{ name: "Alice", score: 95 }] })}
          fieldResolver={registry}
        />,
      );

      // Change the number field via registry-resolved CustomNumberField
      const scoreInput = screen.getByTestId("array-input-tags-0-score");
      fireEvent.change(scoreInput, { target: { value: "100" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      const result = getOnChangeResult(onChange);
      expect(result).toEqual([{ name: "Alice", score: 100 }]);
    });
  });

  describe("add", () => {
    it("appends a default string item when + is clicked", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: ["existing"] })}
        />,
      );

      fireEvent.click(screen.getByTestId("add-tags"));

      expect(onChange).toHaveBeenCalledTimes(1);
      const newArr = getOnChangeResult(onChange);
      expect(newArr).toHaveLength(2);
      expect(newArr[0]).toBe("existing");
      expect(newArr[1]).toBe("");
    });

    it("appends a default number item when elementType is number", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor({
            elementType: { name: "element", type: "number", required: true },
          })}
          field={makeField({ onChange, value: [1, 2] })}
        />,
      );

      fireEvent.click(screen.getByTestId("add-tags"));

      const newArr = getOnChangeResult(onChange);
      expect(newArr).toHaveLength(3);
      expect(newArr[2]).toBe(0);
    });

    it("appends a default boolean item", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor({
            elementType: { name: "element", type: "boolean", required: true },
          })}
          field={makeField({ onChange, value: [] })}
        />,
      );

      fireEvent.click(screen.getByTestId("add-tags"));

      const newArr = getOnChangeResult(onChange);
      expect(newArr[0]).toBe(false);
    });

    it("appends to an empty array", () => {
      const onChange = vi.fn();
      render(
        <ArrayField descriptor={makeDescriptor()} field={makeField({ onChange, value: [] })} />,
      );

      fireEvent.click(screen.getByTestId("add-tags"));

      const newArr = getOnChangeResult(onChange);
      expect(newArr).toHaveLength(1);
    });

    it("renders the new item after adding", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: [] })} />);

      expect(screen.queryByTestId("array-item-tags-0")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("add-tags"));

      expect(screen.getByTestId("array-item-tags-0")).toBeInTheDocument();
    });
  });

  describe("remove", () => {
    it("removes an item by index when × is clicked", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: ["a", "b", "c"] })}
        />,
      );

      // Remove middle item (index 1)
      fireEvent.click(screen.getByTestId("remove-tags-1"));

      expect(onChange).toHaveBeenCalledTimes(1);
      const newArr = getOnChangeResult(onChange);
      expect(newArr).toEqual(["a", "c"]);
    });

    it("removes the first item", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: ["x", "y"] })}
        />,
      );

      fireEvent.click(screen.getByTestId("remove-tags-0"));

      const newArr = getOnChangeResult(onChange);
      expect(newArr).toEqual(["y"]);
    });

    it("removes the last item", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: ["x", "y"] })}
        />,
      );

      fireEvent.click(screen.getByTestId("remove-tags-1"));

      const newArr = getOnChangeResult(onChange);
      expect(newArr).toEqual(["x"]);
    });

    it("removes the only item leaving empty array", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: ["solo"] })}
        />,
      );

      fireEvent.click(screen.getByTestId("remove-tags-0"));

      const newArr = getOnChangeResult(onChange);
      expect(newArr).toEqual([]);
    });

    it("updates the rendered item list after removal", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: ["a", "b"] })} />);

      expect(screen.getByTestId("array-item-tags-0")).toBeInTheDocument();
      expect(screen.getByTestId("array-item-tags-1")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("remove-tags-0"));

      // After removal only one item remains
      expect(screen.getByTestId("array-item-tags-0")).toBeInTheDocument();
      expect(screen.queryByTestId("array-item-tags-1")).not.toBeInTheDocument();

      // The remaining item should have value "b"
      const input = screen.getByTestId("array-input-tags-0");
      expect(input).toHaveDisplayValue("b");
    });
  });

  describe("item editing", () => {
    it("updates item value via onChange when input changes", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: ["original"] })}
        />,
      );

      const input = screen.getByTestId("array-input-tags-0");
      fireEvent.change(input, { target: { value: "updated" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      const newArr = getOnChangeResult(onChange);
      expect(newArr).toEqual(["updated"]);
    });
  });

  describe("reorder (reorderArray utility)", () => {
    it("moves an item forward in the array", () => {
      expect(reorderArray(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    });

    it("moves an item backward in the array", () => {
      expect(reorderArray(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    });

    it("returns identical array when fromIndex equals toIndex", () => {
      expect(reorderArray(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
    });

    it("handles single-element array", () => {
      expect(reorderArray(["a"], 0, 0)).toEqual(["a"]);
    });

    it("handles adjacent swap", () => {
      expect(reorderArray(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    });

    it("preserves object identity in reordered items", () => {
      const items = [
        { id: "1", value: "first" },
        { id: "2", value: "second" },
        { id: "3", value: "third" },
      ];
      const result = reorderArray(items, 0, 2);
      expect(result.map((i) => i.value)).toEqual(["second", "third", "first"]);
      expect(result[2]).toBe(items[0]); // same reference
    });

    it("renders drag handles for each item", () => {
      render(
        <ArrayField descriptor={makeDescriptor()} field={makeField({ value: ["a", "b", "c"] })} />,
      );

      expect(screen.getByTestId("drag-handle-tags-0")).toBeInTheDocument();
      expect(screen.getByTestId("drag-handle-tags-1")).toBeInTheDocument();
      expect(screen.getByTestId("drag-handle-tags-2")).toBeInTheDocument();
    });

    it("drag handles have accessible labels", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: ["alpha"] })} />);

      const handle = screen.getByTestId("drag-handle-tags-0");
      expect(handle.getAttribute("aria-label")).toContain("Drag");
    });

    it("uses dnd-kit with sortable context for items", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: ["a", "b"] })} />);

      const list = screen.getByTestId("array-list-tags");
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(2);
    });

    it("reorderArray produces correct onChange values for field.onChange", () => {
      // This tests the exact data path: reorderArray produces the values
      // that handleDragEnd passes to field.onChange
      const items = [
        { id: "id-a", value: "alpha" },
        { id: "id-b", value: "beta" },
        { id: "id-c", value: "gamma" },
      ];
      const reordered = reorderArray(items, 2, 0);
      const onChangePayload = reordered.map((i) => i.value);
      expect(onChangePayload).toEqual(["gamma", "alpha", "beta"]);
    });

    it("reorders items via component-level onDragEnd handler", () => {
      const onChange = vi.fn();
      // nanoid counter starts at 0 → items get IDs: test-id-0, test-id-1, test-id-2
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: ["alpha", "beta", "gamma"] })}
        />,
      );

      // The mocked DndContext captured the onDragEnd handler
      expect(mockState.capturedOnDragEnd).toBeDefined();

      // Simulate drag end: move first item (test-id-0) after last (test-id-2)
      mockState.capturedOnDragEnd({
        active: { id: "test-id-0" },
        over: { id: "test-id-2" },
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      const result = getOnChangeResult(onChange);
      expect(result).toEqual(["beta", "gamma", "alpha"]);
    });

    it("reorder via onDragEnd: swaps adjacent items", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: ["first", "second"] })}
        />,
      );

      mockState.capturedOnDragEnd({
        active: { id: "test-id-0" },
        over: { id: "test-id-1" },
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(getOnChangeResult(onChange)).toEqual(["second", "first"]);
    });

    it("onDragEnd is a no-op when active === over", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: ["a", "b"] })}
        />,
      );

      mockState.capturedOnDragEnd({
        active: { id: "test-id-0" },
        over: { id: "test-id-0" },
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("onDragEnd is a no-op when over is null", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ onChange, value: ["a", "b"] })}
        />,
      );

      mockState.capturedOnDragEnd({
        active: { id: "test-id-0" },
        over: null,
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("error display and aggregation", () => {
    it("does not render error element when no error", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: [] })} />);

      expect(screen.queryByTestId("error-tags")).not.toBeInTheDocument();
    });

    it("renders error message when error is provided", () => {
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ value: [] })}
          error="At least one tag required"
        />,
      );

      const errorEl = screen.getByTestId("error-tags");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl.textContent).toBe("At least one tag required");
    });

    it("renders error with role=alert", () => {
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ value: [] })}
          error="Required"
        />,
      );

      const errorEl = screen.getByTestId("error-tags");
      expect(errorEl.getAttribute("role")).toBe("alert");
    });

    it("aggregates single item error into array-level message", () => {
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ value: ["a", "b"] })}
          itemErrors={["Too short", undefined]}
        />,
      );

      const errorEl = screen.getByTestId("error-tags");
      expect(errorEl.textContent).toBe("1 item with errors");
    });

    it("aggregates multiple item errors into array-level message", () => {
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ value: ["a", "b", "c"] })}
          itemErrors={["Too short", "Invalid", undefined]}
        />,
      );

      const errorEl = screen.getByTestId("error-tags");
      expect(errorEl.textContent).toBe("2 items with errors");
    });

    it("prefers explicit error over aggregated itemErrors", () => {
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ value: ["a"] })}
          error="Array-level error"
          itemErrors={["Item error"]}
        />,
      );

      const errorEl = screen.getByTestId("error-tags");
      expect(errorEl.textContent).toBe("Array-level error");
    });

    it("does not show aggregated error when all itemErrors are undefined", () => {
      render(
        <ArrayField
          descriptor={makeDescriptor()}
          field={makeField({ value: ["a", "b"] })}
          itemErrors={[undefined, undefined]}
        />,
      );

      expect(screen.queryByTestId("error-tags")).not.toBeInTheDocument();
    });

    it("passes per-item errors to resolved components via fieldResolver", () => {
      const registry = new FieldRegistry(CustomNumberField as FieldComponent);
      registry.registerField("number", CustomNumberField as FieldComponent);

      render(
        <ArrayField
          descriptor={makeDescriptor({
            elementType: { name: "element", type: "number", required: true },
          })}
          field={makeField({ value: [1, 2] })}
          fieldResolver={registry}
          itemErrors={["Too small", undefined]}
        />,
      );

      // First item should show its error
      expect(screen.getByTestId("item-error-tags-0")).toBeInTheDocument();
      expect(screen.getByTestId("item-error-tags-0").textContent).toBe("Too small");

      // Second item should not show an error
      expect(screen.queryByTestId("item-error-tags-1")).not.toBeInTheDocument();
    });

    it("item errors flow through registry-resolved components and aggregate to array level", () => {
      const registry = new FieldRegistry(CustomNumberField as FieldComponent);
      registry.registerField("number", CustomNumberField as FieldComponent);

      render(
        <ArrayField
          descriptor={makeDescriptor({
            elementType: { name: "element", type: "number", required: true },
          })}
          field={makeField({ value: [1, 2, 3] })}
          fieldResolver={registry}
          itemErrors={["Min is 5", undefined, "Max is 2"]}
        />,
      );

      // Per-item errors render inside registry-resolved CustomNumberField
      expect(screen.getByTestId("item-error-tags-0").textContent).toBe("Min is 5");
      expect(screen.queryByTestId("item-error-tags-1")).not.toBeInTheDocument();
      expect(screen.getByTestId("item-error-tags-2").textContent).toBe("Max is 2");

      // Array-level aggregated error
      const arrayError = screen.getByTestId("error-tags");
      expect(arrayError.textContent).toBe("2 items with errors");
      expect(arrayError.getAttribute("role")).toBe("alert");
    });
  });

  describe("external value sync", () => {
    it("updates items when field.value changes externally", () => {
      const field = makeField({ value: ["a", "b"] });
      const { rerender } = render(<ArrayField descriptor={makeDescriptor()} field={field} />);

      expect(screen.getByTestId("array-input-tags-0")).toHaveDisplayValue("a");
      expect(screen.getByTestId("array-input-tags-1")).toHaveDisplayValue("b");

      // Simulate external value change (e.g. undo/redo)
      const newField = { ...field, value: ["x", "y", "z"] };
      rerender(<ArrayField descriptor={makeDescriptor()} field={newField} />);

      expect(screen.getByTestId("array-input-tags-0")).toHaveDisplayValue("x");
      expect(screen.getByTestId("array-input-tags-1")).toHaveDisplayValue("y");
      expect(screen.getByTestId("array-input-tags-2")).toHaveDisplayValue("z");
    });

    it("handles external value reset to empty array", () => {
      const field = makeField({ value: ["a"] });
      const { rerender } = render(<ArrayField descriptor={makeDescriptor()} field={field} />);

      expect(screen.getByTestId("array-item-tags-0")).toBeInTheDocument();

      const newField = { ...field, value: [] };
      rerender(<ArrayField descriptor={makeDescriptor()} field={newField} />);

      expect(screen.queryByTestId("array-item-tags-0")).not.toBeInTheDocument();
    });

    it("does not reset items when field.value is the same reference", () => {
      const sameArray = ["a", "b"];
      const field = makeField({ value: sameArray });
      const { rerender } = render(<ArrayField descriptor={makeDescriptor()} field={field} />);

      // Modify an item internally
      const input = screen.getByTestId("array-input-tags-0");
      fireEvent.change(input, { target: { value: "modified" } });

      // Re-render with the same field.value reference — should NOT reset
      rerender(<ArrayField descriptor={makeDescriptor()} field={field} />);

      // Internal modification should persist since value reference didn't change
      expect(screen.getByTestId("array-input-tags-0")).toHaveDisplayValue("modified");
    });
  });

  describe("accessibility", () => {
    it("add button has aria-label", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: [] })} />);

      const addBtn = screen.getByTestId("add-tags");
      expect(addBtn.getAttribute("aria-label")).toBe("Add tags item");
    });

    it("remove buttons have aria-labels", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: ["a"] })} />);

      const removeBtn = screen.getByTestId("remove-tags-0");
      expect(removeBtn.getAttribute("aria-label")).toContain("Remove");
    });
  });

  describe("stable keys", () => {
    it("preserves item identity after adding", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: ["a"] })} />);

      // Get initial input value
      const input0Before = screen.getByTestId("array-input-tags-0");
      expect(input0Before).toHaveDisplayValue("a");

      // Add new item
      fireEvent.click(screen.getByTestId("add-tags"));

      // First item should still be "a"
      const input0After = screen.getByTestId("array-input-tags-0");
      expect(input0After).toHaveDisplayValue("a");
    });
  });

  describe("edge cases", () => {
    it("handles non-array field.value gracefully", () => {
      render(
        <ArrayField descriptor={makeDescriptor()} field={makeField({ value: "not-an-array" })} />,
      );

      // Should render with no items
      expect(screen.queryByTestId("array-item-tags-0")).not.toBeInTheDocument();
      // Add button should still work
      expect(screen.getByTestId("add-tags")).toBeInTheDocument();
    });

    it("handles null field.value gracefully", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: null })} />);

      expect(screen.queryByTestId("array-item-tags-0")).not.toBeInTheDocument();
    });

    it("handles undefined elementType with string default", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          descriptor={makeDescriptor({ elementType: undefined })}
          field={makeField({ onChange, value: [] })}
        />,
      );

      fireEvent.click(screen.getByTestId("add-tags"));

      const newArr = getOnChangeResult(onChange);
      expect(newArr[0]).toBe("");
    });
  });
});
