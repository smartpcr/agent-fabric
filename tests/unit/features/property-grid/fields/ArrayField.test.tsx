import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { ArrayField } from "@/features/property-grid/fields/ArrayField";
import type { FieldComponentProps } from "@/features/property-grid/registry";
import type { FieldDescriptor } from "@/features/property-grid/introspect";

/* eslint-disable @typescript-eslint/no-unnecessary-condition, no-empty-function */
beforeAll(() => {
  // dnd-kit uses pointer events that jsdom doesn't support
  if (typeof globalThis.PointerEvent === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    globalThis.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});
/* eslint-enable @typescript-eslint/no-unnecessary-condition, no-empty-function */

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

    it("renders each item with an input, drag handle, and remove button", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: ["hello"] })} />);

      expect(screen.getByTestId("array-input-tags-0")).toBeInTheDocument();
      expect(screen.getByTestId("drag-handle-tags-0")).toBeInTheDocument();
      expect(screen.getByTestId("remove-tags-0")).toBeInTheDocument();
    });

    it("renders the add button", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: [] })} />);

      const addBtn = screen.getByTestId("add-tags");
      expect(addBtn).toBeInTheDocument();
      expect(addBtn.textContent).toBe("+");
    });

    it("renders item values in inputs", () => {
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

  describe("reorder", () => {
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

      // Each item is wrapped in a sortable container — verify the list structure
      const list = screen.getByTestId("array-list-tags");
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(2);
    });
  });

  describe("error display", () => {
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

    it("item inputs have aria-labels", () => {
      render(<ArrayField descriptor={makeDescriptor()} field={makeField({ value: ["a"] })} />);

      const input = screen.getByTestId("array-input-tags-0");
      expect(input.getAttribute("aria-label")).toContain("tags");
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
