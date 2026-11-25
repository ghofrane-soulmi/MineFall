/**
 * Mine rules for the placement phase: validating a player's chosen cells and filling
 * missing mines at random when the placement timer ends.
 */
import { COLS, MINES_PER_PLAYER, ROWS } from '../constants';
import type { Cell } from '../types/board';
import type { EngineErrorCode } from '../types/engine';
import type { Rng } from '../types/game';
import { isInBounds } from './board';

export function sameCell(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row;
}

/** Returns an error code, or null when the cells are a valid placement. */
export function validateMinePlacement(cells: readonly Cell[]): EngineErrorCode | null {
  if (cells.length !== MINES_PER_PLAYER) return 'INVALID_MINE_COUNT';
  if (!cells.every(isInBounds)) return 'MINE_OUT_OF_BOUNDS';
  if (cells.some((cell) => cell.row === 0)) return 'MINE_ON_TOP_ROW';
  const distinct = cells.every((cell, i) => cells.findIndex((c) => sameCell(c, cell)) === i);
  if (!distinct) return 'DUPLICATE_MINE';
  return null;
}

/** All cells where a mine may be placed: every row except the top one. */
export function allowedMineCells(): Cell[] {
  const cells: Cell[] = [];
  for (let row = 1; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) cells.push({ col, row });
  }
  return cells;
}

/** Picks `count` distinct random allowed cells, avoiding `exclude`. */
export function randomMineCells(rng: Rng, count: number, exclude: readonly Cell[] = []): Cell[] {
  const pool = allowedMineCells().filter((cell) => !exclude.some((e) => sameCell(e, cell)));
  const picked: Cell[] = [];
  while (picked.length < count && pool.length > 0) {
    const [cell] = pool.splice(Math.floor(rng() * pool.length), 1);
    if (cell) picked.push(cell);
  }
  return picked;
}
