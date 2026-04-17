export interface Position {
  readonly x: number;
  readonly y: number;
}

const DEFAULT_GRID_SIZE = 16;

/**
 * Rounds a position to the nearest grid multiple.
 */
export function snapToGrid(pos: Position, size: number = DEFAULT_GRID_SIZE): Position {
  return {
    x: Math.round(pos.x / size) * size,
    y: Math.round(pos.y / size) * size,
  };
}
