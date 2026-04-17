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
 * Handles are placed at equal-division points along the edge:
 * - 1 handle → 50%
 * - 2 handles → 33% and 67%
 * - N handles → at positions k/(N+1) for k = 1..N
 *
 * Offsets are clamped to `[padding, 1 - padding]` so handles
 * never sit flush against the node corners.
 */
export function computeHandlePositions({
  count,
  edge,
  padding = DEFAULT_PADDING,
}: ComputeHandlePositionsOptions): HandlePosition[] {
  if (count <= 0) return [];

  const clampedPadding = Math.max(0, Math.min(0.5, padding));

  const positions: HandlePosition[] = [];
  const divisions = count + 1;

  for (let i = 0; i < count; i++) {
    const rawOffset = (i + 1) / divisions;
    const offset = Math.max(clampedPadding, Math.min(1 - clampedPadding, rawOffset));
    positions.push({ index: i, offset, edge });
  }

  return positions;
}
