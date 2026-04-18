import type { LayoutOptions } from "elkjs/lib/elk-api";

export type LayoutStrategy = "layered" | "force" | "radial";

export const DEFAULT_STRATEGY: LayoutStrategy = "layered";

const COMMON_OPTIONS: LayoutOptions = {
  "org.eclipse.elk.spacing.nodeNode": "40",
  "org.eclipse.elk.spacing.edgeNode": "20",
};

const LAYERED_OPTIONS: LayoutOptions = {
  ...COMMON_OPTIONS,
  "org.eclipse.elk.algorithm": "org.eclipse.elk.layered",
  "org.eclipse.elk.direction": "RIGHT",
  "org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers": "60",
};

const FORCE_OPTIONS: LayoutOptions = {
  ...COMMON_OPTIONS,
  "org.eclipse.elk.algorithm": "org.eclipse.elk.force",
};

const RADIAL_OPTIONS: LayoutOptions = {
  ...COMMON_OPTIONS,
  "org.eclipse.elk.algorithm": "org.eclipse.elk.radial",
};

const STRATEGY_MAP: Record<LayoutStrategy, LayoutOptions> = {
  layered: LAYERED_OPTIONS,
  force: FORCE_OPTIONS,
  radial: RADIAL_OPTIONS,
};

/**
 * ELK options for graphs containing loop-back (cyclic) edges.
 * Orthogonal routing keeps back-edges visually distinct;
 * greedy cycle breaking preserves model order during layering.
 */
const LOOP_BACK_OPTIONS: LayoutOptions = {
  "org.eclipse.elk.edgeRouting": "ORTHOGONAL",
  "org.eclipse.elk.layered.cycleBreaking.strategy": "GREEDY",
  "org.eclipse.elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
};

/**
 * Return the ELK layout options for a given strategy.
 * Defaults to `layered` when no strategy is specified.
 */
export function getLayoutOptions(strategy: LayoutStrategy = DEFAULT_STRATEGY): LayoutOptions {
  return STRATEGY_MAP[strategy];
}

/**
 * Return the loop-back routing options (cycle-aware ELK settings).
 */
export function getLoopBackOptions(): LayoutOptions {
  return { ...LOOP_BACK_OPTIONS };
}

/**
 * Return layout options for a strategy merged with loop-back routing overrides.
 * Loop-back keys take precedence over strategy defaults.
 */
export function getLayoutOptionsWithLoopBack(
  strategy: LayoutStrategy = DEFAULT_STRATEGY,
): LayoutOptions {
  return { ...STRATEGY_MAP[strategy], ...LOOP_BACK_OPTIONS };
}
