export type HandleEdge = "top" | "bottom" | "left" | "right";

export interface ComputeHandlePositionsOptions {
  readonly count: number;
  readonly edge: HandleEdge;
  readonly padding?: number;
}

export interface HandlePosition {
  readonly index: number;
  readonly offset: number;
  readonly edge: HandleEdge;
}

const DEFAULT_PADDING = 0.1;

/**
 * Distributes `count` handles evenly along a node edge, returning
 * percentage offsets clamped to `[padding, 1 - padding]`.
 *
 * - 1 handle → centered at 50%
 * - 2 handles → ~33% and ~67%
 * - N handles → evenly spaced within the padded range
 */
export function computeHandlePositions({
  count,
  edge,
  padding = DEFAULT_PADDING,
}: ComputeHandlePositionsOptions): HandlePosition[] {
  if (count <= 0) return [];

  const clampedPadding = Math.max(0, Math.min(0.5, padding));

  if (count === 1) {
    return [{ index: 0, offset: 0.5, edge }];
  }

  const positions: HandlePosition[] = [];
  const start = clampedPadding;
  const end = 1 - clampedPadding;
  const step = (end - start) / (count - 1);

  for (let i = 0; i < count; i++) {
    const rawOffset = start + step * i;
    const offset = Math.max(clampedPadding, Math.min(1 - clampedPadding, rawOffset));
    positions.push({ index: i, offset, edge });
  }

  return positions;
}
