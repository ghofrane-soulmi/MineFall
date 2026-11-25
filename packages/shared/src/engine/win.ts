/**
 * Win detection. Only lines passing through the last placed token can be new wins,
 * so we scan the 4 axes (horizontal, vertical, "/" and "\") through that cell.
 */
import { WIN_LENGTH } from '../constants';
import type { Board, Cell, Color } from '../types/board';
import { getCell, isInBounds } from './board';

/** Direction vectors for the 4 axes: — | / \ (row 0 is the top, so "/" goes up-right). */
const AXES: readonly (readonly [dCol: number, dRow: number])[] = [
  [1, 0], // horizontal
  [0, 1], // vertical
  [1, -1], // diagonal "/"
  [1, 1], // diagonal "\"
];

/**
 * Returns the full winning line through `last` (4 or more cells, ordered along the axis),
 * or `null` if that token did not complete a line.
 */
export function findWinningLine(board: Board, last: Cell): Cell[] | null {
  const color = getCell(board, last);
  if (color === null) return null;

  for (const [dCol, dRow] of AXES) {
    const backward = walk(board, last, -dCol, -dRow, color).reverse();
    const forward = walk(board, last, dCol, dRow, color);
    const line = [...backward, last, ...forward];
    if (line.length >= WIN_LENGTH) return line;
  }
  return null;
}

/** Collects consecutive same-colour cells from `start` (exclusive) in one direction. */
function walk(board: Board, start: Cell, dCol: number, dRow: number, color: Color): Cell[] {
  const cells: Cell[] = [];
  let cell: Cell = { col: start.col + dCol, row: start.row + dRow };
  while (isInBounds(cell) && getCell(board, cell) === color) {
    cells.push(cell);
    cell = { col: cell.col + dCol, row: cell.row + dRow };
  }
  return cells;
}
