/**
 * Board primitives: creating the grid, gravity (where a token lands) and placing tokens.
 * Every function is pure: inputs are never mutated, a new board is returned instead.
 */
import { COLS, ROWS } from '../constants';
import type { Board, Cell, CellContent, Color } from '../types/board';

export function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<CellContent>(COLS).fill(null));
}

export function isInBounds(cell: Cell): boolean {
  return (
    Number.isInteger(cell.col) &&
    Number.isInteger(cell.row) &&
    cell.col >= 0 &&
    cell.col < COLS &&
    cell.row >= 0 &&
    cell.row < ROWS
  );
}

export function isValidColumnIndex(col: number): boolean {
  return Number.isInteger(col) && col >= 0 && col < COLS;
}

export function getCell(board: Board, cell: Cell): CellContent {
  return board[cell.row]?.[cell.col] ?? null;
}

/**
 * Gravity: returns the lowest empty row in `col`, or `null` if the column is full.
 * Scans from the bottom so a gap left by an explosion is filled first.
 */
export function getLandingRow(board: Board, col: number): number | null {
  if (!isValidColumnIndex(col)) return null;
  for (let row = ROWS - 1; row >= 0; row--) {
    if (getCell(board, { col, row }) === null) return row;
  }
  return null;
}

export function isColumnFull(board: Board, col: number): boolean {
  return getLandingRow(board, col) === null;
}

export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((content) => content !== null));
}

/** Returns a copy of `board` with `color` written at `cell`. */
export function placeToken(board: Board, cell: Cell, color: Color): Board {
  return board.map((row, r) =>
    r === cell.row ? row.map((content, c) => (c === cell.col ? color : content)) : row,
  );
}
