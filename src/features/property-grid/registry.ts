import type { ControllerRenderProps } from "react-hook-form";
import type { FieldDescriptor } from "@/features/property-grid/introspect";

export type { FieldDescriptor } from "@/features/property-grid/introspect";

/** Props passed to every field component resolved from the registry. */
export interface FieldComponentProps {
  readonly descriptor: FieldDescriptor;
  readonly field: ControllerRenderProps;
  /** Validation error message for this field, if any. */
  readonly error?: string;
}

/** A React component that renders a form field for a given descriptor. */
export type FieldComponent = React.ComponentType<FieldComponentProps>;

/**
 * Interface satisfied by anything that can resolve a field descriptor to a component.
 * Useful for lightweight custom resolvers without the full `FieldRegistry` class.
 */
export interface FieldResolver {
  resolveField(descriptor: FieldDescriptor): FieldComponent;
}

/**
 * Mutable field registry.
 *
 * Resolution order (highest → lowest priority):
 * 1. **Descriptor-level override** — `registerFieldOverride(fieldName, component)`
 * 2. **Type-level** — `registerField(type, component)`
 * 3. **Fallback** — the component passed at construction (typically `StringField`)
 */
export class FieldRegistry implements FieldResolver {
  private readonly typeMap = new Map<string, FieldComponent>();

  private readonly nameOverrides = new Map<string, FieldComponent>();

  private readonly fallback: FieldComponent;

  constructor(fallback: FieldComponent) {
    this.fallback = fallback;
  }

  /** Register a component for a given field type (e.g. "string", "number"). */
  registerField(type: string, component: FieldComponent): void {
    this.typeMap.set(type, component);
  }

  /**
   * Register a descriptor-level (field-name) override.
   * Name overrides beat type-level registrations during resolution.
   */
  registerFieldOverride(fieldName: string, component: FieldComponent): void {
    this.nameOverrides.set(fieldName, component);
  }

  /**
   * Resolve a field descriptor to a component.
   *
   * Priority: name override → type registration → fallback (StringField).
   */
  resolveField(descriptor: FieldDescriptor): FieldComponent {
    const nameOverride = this.nameOverrides.get(descriptor.name);
    if (nameOverride) return nameOverride;

    const typeComponent = this.typeMap.get(descriptor.type);
    if (typeComponent) return typeComponent;

    return this.fallback;
  }
}

/**
 * Create a new FieldRegistry with the given fallback component.
 * Does not include any built-in type registrations — callers should
 * register their own field components after creation.
 */
export function createFieldRegistry(fallback: FieldComponent): FieldRegistry {
  return new FieldRegistry(fallback);
}
