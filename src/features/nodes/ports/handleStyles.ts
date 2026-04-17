/**
 * Maps port dataType values to CSS custom property names for handle colors.
 * Unknown types fall back to --color-port-neutral.
 */

export interface PortColorMapping {
  readonly dataType: string;
  readonly cssVariable: string;
  readonly label: string;
}

const PORT_COLOR_MAP: Readonly<Record<string, string>> = {
  string: "--color-port-string",
  json: "--color-port-json",
  number: "--color-port-number",
  boolean: "--color-port-boolean",
  any: "--color-port-any",
};

const FALLBACK_CSS_VARIABLE = "--color-port-neutral";

/**
 * Returns the CSS variable name for a given dataType.
 * Unknown types fall back to `--color-port-neutral`.
 */
export function getPortColorVariable(dataType: string): string {
  return PORT_COLOR_MAP[dataType] ?? FALLBACK_CSS_VARIABLE;
}

/**
 * Returns the full list of known port color mappings for legend/documentation use.
 */
export function getPortColorLegend(): readonly PortColorMapping[] {
  return Object.entries(PORT_COLOR_MAP).map(([dataType, cssVariable]) => ({
    dataType,
    cssVariable,
    label: dataType.charAt(0).toUpperCase() + dataType.slice(1),
  }));
}

/**
 * Returns the set of all known data types that have explicit color mappings.
 */
export function getKnownDataTypes(): readonly string[] {
  return Object.keys(PORT_COLOR_MAP);
}
