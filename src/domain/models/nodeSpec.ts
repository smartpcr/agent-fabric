import type { z } from "zod";
import type { PortSpec } from "@/domain/models/port";

export interface NodeSpec<TData = unknown> {
  readonly kind: string;
  readonly category: string;
  readonly label: string;
  readonly icon: string;
  readonly ports: readonly PortSpec[];
  readonly propertySchema: z.ZodType<TData>;
  readonly defaultData: TData;
  readonly capabilities: readonly string[];
}

export function validateSpec<TData>(spec: NodeSpec<TData>): void {
  // Validate port id uniqueness
  const portIds = new Set<string>();
  for (const port of spec.ports) {
    if (portIds.has(port.id)) {
      throw new Error(`Duplicate port id "${port.id}" in NodeSpec "${spec.kind}"`);
    }
    portIds.add(port.id);
  }

  // Validate defaultData conforms to propertySchema
  const result = spec.propertySchema.safeParse(spec.defaultData);
  if (!result.success) {
    throw new Error(
      `defaultData does not conform to propertySchema in NodeSpec "${spec.kind}": ${result.error.message}`,
    );
  }
}
