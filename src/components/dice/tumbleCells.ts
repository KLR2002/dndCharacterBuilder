/** A cell of the Tumble row is this many dp across; a solid die is drawn at 36% of it as its circumradius. */
export const CELL = 72;
export const DIE_RADIUS = CELL * 0.36;

/** The gap between cells, in both directions, and the room above the top row for its lift. */
const CELL_GAP = 6;
export const ROW_TOP = 12;

export type CellOrigin = { x: number; y: number };

/**
 * The top-left corner of each cell of a Tumble row `width` dp wide, in Roll order: a wrapping row of
 * cells, filling each row from the left as a flex row does. An unmeasured row (width 0) has one column.
 */
export function tumbleCells(count: number, width: number): CellOrigin[] {
  const columns = Math.max(1, Math.floor((width + CELL_GAP) / (CELL + CELL_GAP)));
  return Array.from({ length: count }, (_, index) => ({
    x: (index % columns) * (CELL + CELL_GAP),
    y: ROW_TOP + Math.floor(index / columns) * (CELL + CELL_GAP),
  }));
}

/** The height of the row that holds `count` cells `width` dp wide, with the room above the top row. */
export function tumbleHeight(count: number, width: number): number {
  if (count === 0) return 0;
  const cells = tumbleCells(count, width);
  return cells[cells.length - 1].y + CELL;
}
