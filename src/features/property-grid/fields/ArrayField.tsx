import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
import type { z } from "zod";
import type {
  FieldComponentProps,
  FieldComponent,
  FieldResolver,
} from "@/features/property-grid/registry";
import type { FieldDescriptor } from "@/features/property-grid/introspect";
import { SchemaFormFields } from "@/features/property-grid/SchemaForm";

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

/**
 * Reorder an array by moving an item from one index to another.
 * Pure utility — exported for direct testing of the reorder logic.
 */
export function reorderArray<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const result = [...items];
  const [removed] = result.splice(fromIndex, 1);
  if (removed !== undefined) {
    result.splice(toIndex, 0, removed);
  }
  return result;
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

/** Default field resolver that always returns InlineStringField. */
const defaultFieldResolver: FieldResolver = {
  resolveField: () => InlineStringField,
};

// ─── Recursive child field renderer (shared with SchemaForm) ────────

/**
 * Renders a single child field of an object-type array item.
 * Resolves the component via the field registry — the same resolution
 * path used by SchemaForm's FieldTree — so child fields of all types
 * (string, number, boolean, nested objects) are handled consistently.
 */
function ChildFieldRenderer({
  childDescriptor,
  parentDescriptorName,
  parentFieldName,
  parentValue,
  onParentChange,
  parentOnBlur,
  fieldResolver,
}: {
  readonly childDescriptor: FieldDescriptor;
  readonly parentDescriptorName: string;
  readonly parentFieldName: string;
  readonly parentValue: Record<string, unknown>;
  readonly onParentChange: (newObj: Record<string, unknown>) => void;
  readonly parentOnBlur: () => void;
  readonly fieldResolver: FieldResolver;
}) {
  // Nested object with children: recurse (mirrors SchemaForm FieldTree recursion)
  if (childDescriptor.type === "object" && childDescriptor.children) {
    const nestedValue =
      typeof parentValue[childDescriptor.name] === "object" &&
      parentValue[childDescriptor.name] !== null
        ? (parentValue[childDescriptor.name] as Record<string, unknown>)
        : {};
    return (
      <fieldset data-testid={`field-wrapper-${childDescriptor.name}`}>
        <legend>{childDescriptor.name}</legend>
        {childDescriptor.children.map((grandchild) => (
          <ChildFieldRenderer
            key={grandchild.name}
            childDescriptor={grandchild}
            parentDescriptorName={`${parentDescriptorName}-${childDescriptor.name}`}
            parentFieldName={`${parentFieldName}.${childDescriptor.name}`}
            parentValue={nestedValue}
            onParentChange={(newNested) => {
              onParentChange({ ...parentValue, [childDescriptor.name]: newNested });
            }}
            parentOnBlur={parentOnBlur}
            fieldResolver={fieldResolver}
          />
        ))}
      </fieldset>
    );
  }

  // Resolve leaf child via the field registry (same path as SchemaForm FieldTree)
  /* eslint-disable react-hooks/static-components -- resolveField returns a stable reference from the registry, not a new component */
  const Component = fieldResolver.resolveField(childDescriptor);
  const childName = `${parentDescriptorName}-${childDescriptor.name}`;

  return (
    <Component
      descriptor={{ ...childDescriptor, name: childName }}
      field={{
        value: parentValue[childDescriptor.name],
        onChange: (newVal: unknown) => {
          onParentChange({ ...parentValue, [childDescriptor.name]: newVal });
        },
        onBlur: parentOnBlur,
        name: `${parentFieldName}.${childDescriptor.name}`,
        // eslint-disable-next-line no-empty-function
        ref: () => {},
      }}
    />
  );
  /* eslint-enable react-hooks/static-components */
}

// ─── Recursive item renderer (shared form engine path) ──────────────

/**
 * Renders a single array item recursively via SchemaForm's form engine:
 *
 * - When `elementSchema` is provided: renders the item through
 *   `SchemaFormFields` — the same recursive form engine used by `SchemaForm`
 *   (introspection → FieldTree → Controller → registry-resolved components).
 * - For object-type items without a schema: falls back to ChildFieldRenderer
 *   which resolves child fields through the field registry.
 * - For primitive items: renders via the pre-resolved component.
 */
function ArrayItemForm({
  descriptor,
  field,
  error,
  resolvedComponent: ResolvedComponent,
  fieldResolver,
  elementSchema,
}: FieldComponentProps & {
  readonly resolvedComponent: FieldComponent;
  readonly fieldResolver?: FieldResolver;
  readonly elementSchema?: z.ZodType;
}) {
  // Primary path: render recursively via SchemaFormFields (the SchemaForm engine)
  if (elementSchema && descriptor.type === "object") {
    const objValue =
      typeof field.value === "object" && field.value !== null
        ? (field.value as Record<string, unknown>)
        : {};

    return (
      <div data-testid={`schema-form-item-${descriptor.name}`}>
        <SchemaFormFields
          schema={elementSchema}
          value={objValue}
          onChange={(newVal) => {
            field.onChange(newVal);
          }}
          fieldRegistry={fieldResolver}
        />
        {error && (
          <span role="alert" data-testid={`item-error-${descriptor.name}`}>
            {error}
          </span>
        )}
      </div>
    );
  }

  // Fallback: object-type with children but no schema — ChildFieldRenderer
  if (descriptor.type === "object" && descriptor.children) {
    const objValue =
      typeof field.value === "object" && field.value !== null
        ? (field.value as Record<string, unknown>)
        : {};

    return (
      <div data-testid={`object-fields-${descriptor.name}`}>
        {descriptor.children.map((childDesc) => (
          <ChildFieldRenderer
            key={childDesc.name}
            childDescriptor={childDesc}
            parentDescriptorName={descriptor.name}
            parentFieldName={field.name}
            parentValue={objValue}
            onParentChange={(newObj) => {
              field.onChange(newObj);
            }}
            parentOnBlur={field.onBlur}
            fieldResolver={fieldResolver ?? defaultFieldResolver}
          />
        ))}
        {error && (
          <span role="alert" data-testid={`item-error-${descriptor.name}`}>
            {error}
          </span>
        )}
      </div>
    );
  }

  // Primitive type: render via pre-resolved component (same path as SchemaForm leaf rendering)
  return <ResolvedComponent descriptor={descriptor} field={field} error={error} />;
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
  readonly fieldResolver?: FieldResolver;
  readonly elementSchema?: z.ZodType;
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
  resolvedComponent,
  fieldResolver,
  elementSchema,
  itemError,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const { t } = useTranslation();
  const indexStr = String(index);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  };

  // Build a synthetic field object for the form engine
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
        aria-label={t("propertyGrid.dragItem", { label: itemLabel(value, index) })}
        {...attributes}
        {...listeners}
      >
        ☰
      </button>

      <ArrayItemForm
        descriptor={itemDescriptor}
        field={itemField}
        error={itemError}
        resolvedComponent={resolvedComponent}
        fieldResolver={fieldResolver}
        elementSchema={elementSchema}
      />

      <button
        type="button"
        onClick={() => {
          onRemove(index);
        }}
        data-testid={`remove-${fieldName}-${indexStr}`}
        aria-label={t("propertyGrid.removeItem", { index: indexStr })}
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
  /**
   * Optional Zod schema for the element type. When provided, each object item
   * is rendered recursively through `SchemaFormFields` — the same form engine
   * used by `SchemaForm`.
   */
  readonly elementSchema?: z.ZodType;
  /** Per-item error messages, keyed by index. */
  readonly itemErrors?: readonly (string | undefined)[];
}

// ─── ArrayField ─────────────────────────────────────────────────────

/**
 * Array field with add/remove/reorder support.
 *
 * - Each item rendered recursively via `SchemaFormFields` (the SchemaForm engine)
 *   when `elementSchema` is provided; falls back to field registry resolution
 * - "+" button appends a default item
 * - "×" button removes by index
 * - Drag handles reorder via dnd-kit (uses exported `reorderArray` utility)
 * - Stable item keys via nanoid
 * - Aggregates per-item errors into array-level display
 */
export function ArrayField({
  descriptor,
  field,
  error,
  fieldResolver,
  elementSchema,
  itemErrors,
}: ArrayFieldProps) {
  const { t } = useTranslation();
  const errorId = `error-${descriptor.name}`;

  // Resolve the element descriptor for rendering
  const elementDescriptor: FieldDescriptor = descriptor.elementType ?? {
    name: "element",
    type: "string",
    required: true,
  };

  // Resolve the component for element items (same resolution as SchemaForm's FieldTree)
  const resolvedComponent: FieldComponent = fieldResolver
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

      syncToField(reorderArray(items, oldIndex, newIndex));
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
    return t("propertyGrid.itemsWithErrors", { count: errorCount });
  }, [error, itemErrors, t]);

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
                resolvedComponent={resolvedComponent}
                fieldResolver={fieldResolver}
                elementSchema={elementSchema}
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
        aria-label={t("propertyGrid.addItem", { name: descriptor.name })}
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
