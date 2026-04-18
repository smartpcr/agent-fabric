import { useState, useCallback, useMemo } from "react";
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
import type { FieldComponentProps } from "@/features/property-grid/registry";

/** Internal representation of an array item with a stable key. */
interface ArrayItem {
  readonly id: string;
  readonly value: unknown;
}

/** Build a default item value based on the element type descriptor. */
function makeDefaultItem(elementType: FieldComponentProps["descriptor"]["elementType"]): unknown {
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

// ─── Sortable item wrapper ──────────────────────────────────────────

interface SortableItemProps {
  readonly id: string;
  readonly index: number;
  readonly value: unknown;
  readonly fieldName: string;
  readonly onRemove: (index: number) => void;
  readonly onItemChange: (index: number, newValue: unknown) => void;
}

function SortableItem({ id, index, value, fieldName, onRemove, onItemChange }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const indexStr = String(index);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  };

  const displayValue =
    value !== null && value !== undefined && typeof value !== "object"
      ? String(value as string | number | boolean)
      : "";

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

      <input
        type="text"
        value={displayValue}
        onChange={(e) => {
          onItemChange(index, e.target.value);
        }}
        data-testid={`array-input-${fieldName}-${indexStr}`}
        aria-label={`${fieldName} item ${indexStr}`}
      />

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

// ─── ArrayField ─────────────────────────────────────────────────────

/**
 * Array field with add/remove/reorder support.
 *
 * - Each item rendered with a text input, drag handle, and remove button
 * - "+" button appends a default item
 * - "×" button removes by index
 * - Drag handles reorder via dnd-kit
 * - Stable item keys via nanoid
 */
export function ArrayField({ descriptor, field, error }: FieldComponentProps) {
  const errorId = `error-${descriptor.name}`;

  // Initialize items from field.value with stable ids
  const [items, setItems] = useState<ArrayItem[]>(() => {
    const arr = Array.isArray(field.value) ? (field.value as unknown[]) : [];
    return arr.map((v) => ({ id: nanoid(), value: v }));
  });

  // Sync items → field.onChange
  const syncToField = useCallback(
    (updated: ArrayItem[]) => {
      setItems(updated);
      field.onChange(updated.map((item) => item.value));
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
                onRemove={handleRemove}
                onItemChange={handleItemChange}
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

      {error && (
        <span id={errorId} role="alert" data-testid={`error-${descriptor.name}`}>
          {error}
        </span>
      )}
    </div>
  );
}
