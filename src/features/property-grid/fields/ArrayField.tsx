import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { nanoid } from "nanoid";
import type {
  FieldComponentProps,
  FieldComponent,
  FieldResolver,
} from "@/features/property-grid/registry";
import type { FieldDescriptor } from "@/features/property-grid/introspect";

/** Internal representation of an array item with a stable key. */
interface ArrayItem {
  readonly id: string;
  readonly value: unknown;
}

/** Build a default item value based on the element type descriptor. */
function makeDefaultItem(elementType: FieldDescriptor | undefined): unknown {
  if (!elementType) return "";
  switch (elementType.type) {
    case "string":
      return elementType.defaultValue ?? "";
    case "number":
      return elementType.defaultValue ?? 0;
    case "boolean":
      return elementType.defaultValue ?? false;
    case "object":
      return elementType.defaultValue ?? {};
    case "array":
      return elementType.defaultValue ?? [];
    default:
      return elementType.defaultValue ?? "";
  }
}

/** Produce a display label for an item value. */
function itemLabel(value: unknown, index: number): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return `Item ${String(index + 1)}`;
}

/** Convert field.value to ArrayItem[] with stable ids. */
function valueToItems(value: unknown): ArrayItem[] {
  const arr = Array.isArray(value) ? (value as unknown[]) : [];
  return arr.map((v) => ({ id: nanoid(), value: v }));
}

// ─── Default inline field for primitive items ───────────────────────

function InlineStringField({ descriptor, field }: FieldComponentProps) {
  const displayValue =
    field.value !== null && field.value !== undefined && typeof field.value !== "object"
      ? String(field.value as string | number | boolean)
      : "";

  return (
    <input
      type="text"
      value={displayValue}
      onChange={(e) => {
        field.onChange(e.target.value);
      }}
      data-testid={`array-input-${descriptor.name}`}
      aria-label={descriptor.name}
    />
  );
}

// ─── Sortable item wrapper ──────────────────────────────────────────

interface SortableItemProps {
  readonly id: string;
  readonly index: number;
  readonly value: unknown;
  readonly fieldName: string;
  readonly elementDescriptor: FieldDescriptor;
  readonly onRemove: (index: number) => void;
  readonly onItemChange: (index: number, newValue: unknown) => void;
  readonly resolvedComponent: FieldComponent;
  readonly itemError?: string;
}

function SortableItem({
  id,
  index,
  value,
  fieldName,
  elementDescriptor,
  onRemove,
  onItemChange,
  resolvedComponent: ResolvedComponent,
  itemError,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const indexStr = String(index);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  };

  // Build a synthetic field object for the resolved component
  const itemField = useMemo(
    () => ({
      value,
      onChange: (newVal: unknown) => {
        onItemChange(index, newVal);
      },
      onBlur: () => {
        /* no-op for array items */
      },
      name: `${fieldName}.${indexStr}`,
      ref: () => {
        /* no-op ref */
      },
    }),
    [value, onItemChange, index, fieldName, indexStr],
  );

  // Build an item-level descriptor
  const itemDescriptor = useMemo(
    () => ({
      ...elementDescriptor,
      name: `${fieldName}-${indexStr}`,
    }),
    [elementDescriptor, fieldName, indexStr],
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`array-item-${fieldName}-${indexStr}`}
      role="listitem"
    >
      <button
        type="button"
        data-testid={`drag-handle-${fieldName}-${indexStr}`}
        aria-label={`Drag ${itemLabel(value, index)}`}
        {...attributes}
        {...listeners}
      >
        ☰
      </button>

      <ResolvedComponent descriptor={itemDescriptor} field={itemField} error={itemError} />

      <button
        type="button"
        onClick={() => {
          onRemove(index);
        }}
        data-testid={`remove-${fieldName}-${indexStr}`}
        aria-label={`Remove item ${indexStr}`}
      >
        ×
      </button>
    </div>
  );
}

// ─── ArrayField props ───────────────────────────────────────────────

export interface ArrayFieldProps extends FieldComponentProps {
  /** Optional field resolver for rendering element items via the registry. */
  readonly fieldResolver?: FieldResolver;
  /** Per-item error messages, keyed by index. */
  readonly itemErrors?: readonly (string | undefined)[];
}

// ─── ArrayField ─────────────────────────────────────────────────────

/**
 * Array field with add/remove/reorder support.
 *
 * - Each item rendered recursively via the field registry (falls back to inline text input)
 * - "+" button appends a default item
 * - "×" button removes by index
 * - Drag handles reorder via dnd-kit
 * - Stable item keys via nanoid
 * - Aggregates per-item errors into array-level display
 */
export function ArrayField({
  descriptor,
  field,
  error,
  fieldResolver,
  itemErrors,
}: ArrayFieldProps) {
  const errorId = `error-${descriptor.name}`;

  // Resolve the component for element rendering
  const elementDescriptor: FieldDescriptor = descriptor.elementType ?? {
    name: "element",
    type: "string",
    required: true,
  };
  const ResolvedComponent: FieldComponent = fieldResolver
    ? fieldResolver.resolveField(elementDescriptor)
    : InlineStringField;

  // Initialize items from field.value with stable ids
  const [items, setItems] = useState<ArrayItem[]>(() => valueToItems(field.value));

  // Track the last field.value we saw to detect external changes
  const lastExternalValue = useRef<unknown>(field.value);

  // Sync items from external field.value changes (e.g. undo/redo, form reset)
  useEffect(() => {
    if (field.value !== lastExternalValue.current) {
      lastExternalValue.current = field.value;
      setItems(valueToItems(field.value));
    }
  }, [field.value]);

  // Sync items → field.onChange
  const syncToField = useCallback(
    (updated: ArrayItem[]) => {
      const values = updated.map((item) => item.value);
      lastExternalValue.current = values;
      setItems(updated);
      field.onChange(values);
    },
    [field],
  );

  const handleAdd = useCallback(() => {
    const defaultVal = makeDefaultItem(descriptor.elementType);
    const newItem: ArrayItem = { id: nanoid(), value: defaultVal };
    syncToField([...items, newItem]);
  }, [items, descriptor.elementType, syncToField]);

  const handleRemove = useCallback(
    (index: number) => {
      const updated = items.filter((_, i) => i !== index);
      syncToField(updated);
    },
    [items, syncToField],
  );

  const handleItemChange = useCallback(
    (index: number, newValue: unknown) => {
      const updated = items.map((item, i) => (i === index ? { ...item, value: newValue } : item));
      syncToField(updated);
    },
    [items, syncToField],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const updated = [...items];
      const [removed] = updated.splice(oldIndex, 1);
      if (removed) {
        updated.splice(newIndex, 0, removed);
      }
      syncToField(updated);
    },
    [items, syncToField],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  // Aggregate per-item errors for array-level display
  const aggregatedError = useMemo(() => {
    if (error) return error;
    if (!itemErrors) return undefined;
    const errorCount = itemErrors.filter(Boolean).length;
    if (errorCount === 0) return undefined;
    return `${String(errorCount)} item${errorCount > 1 ? "s" : ""} with errors`;
  }, [error, itemErrors]);

  return (
    <div data-testid={`array-field-${descriptor.name}`}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div role="list" data-testid={`array-list-${descriptor.name}`}>
            {items.map((item, index) => (
              <SortableItem
                key={item.id}
                id={item.id}
                index={index}
                value={item.value}
                fieldName={descriptor.name}
                elementDescriptor={elementDescriptor}
                onRemove={handleRemove}
                onItemChange={handleItemChange}
                resolvedComponent={ResolvedComponent}
                itemError={itemErrors?.[index]}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={handleAdd}
        data-testid={`add-${descriptor.name}`}
        aria-label={`Add ${descriptor.name} item`}
      >
        +
      </button>

      {aggregatedError && (
        <span id={errorId} role="alert" data-testid={`error-${descriptor.name}`}>
          {aggregatedError}
        </span>
      )}
    </div>
  );
}
