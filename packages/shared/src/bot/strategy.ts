/**
 * Minebot's decisions. Pure functions over a PlayerView: the bot sees exactly what a human
 * player would (its own mines, exploded mines, the board) and NEVER the opponent's mines.
 * - easy:   random valid column, random mines
 * - normal: win > block > avoid gifting a win > keep own mines as traps > centre + connections
 */
import { COLS } from '../constants';
import { getLandingRow, isInBounds, placeToken } from '../engine/board';
import { getValidColumns } from '../engine/game';
import { randomMineCells, sameCell } from '../engine/mines';
import { findWinningLine } from '../engine/win';
import type { Board, Cell, Color } from '../types/board';
import type { Rng } from '../types/game';
import type { PlayerView } from '../types/view';

export type BotLevel = 'easy' | 'normal';
export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'normal'];

/** Cells where people tend to play early: bottom rows of the centre columns. */
const TRAP_CELLS: readonly Cell[] = [
  { col: 3, row: 5 },
  { col: 2, row: 5 },
  { col: 4, row: 5 },
  { col: 3, row: 4 },
  { col: 2, row: 4 },
  { col: 4, row: 4 },
  { col: 1, row: 5 },
  { col: 5, row: 5 },
];

const SCORE = {
  /** Our move would let the opponent win right on top of it. */
  givesWin: -1000,
  /** Our token would cover our own mine: the trap is wasted. */
  coversOwnMine: -6,
  centreWeight: 2,
  neighbourWeight: 1,
  /** Small random noise so the bot is not perfectly predictable. */
  jitter: 0.9,
} as const;

/** The bot's 2 mines. Normal hides them on cells where opponents usually play early. */
export function chooseBotMines(level: BotLevel, rng: Rng): Cell[] {
  if (level === 'easy') return randomMineCells(rng, 2);
  const pool = [...TRAP_CELLS];
  const picked: Cell[] = [];
  while (picked.length < 2) {
    const [cell] = pool.splice(Math.floor(rng() * pool.length), 1);
    if (cell) picked.push(cell);
  }
  return picked;
}

/** The column to play, or null if no column is valid (the server never asks then). */
export function chooseBotColumn(view: PlayerView, level: BotLevel, rng: Rng): number | null {
  const valid = getValidColumns(view.board, view.blockedColumns);
  if (valid.length === 0) return null;
  if (level === 'easy') return valid[Math.floor(rng() * valid.length)] ?? null;

  const me = view.players.find((p) => p.id === view.viewerId)?.color;
  const them = view.players.find((p) => p.id !== view.viewerId)?.color;
  if (!me || !them) return valid[0] ?? null;

  // 1. Win now.
  const winning = valid.find((col) => winsAt(view.board, col, me));
  if (winning !== undefined) return winning;

  // 2. Block the opponent's immediate win.
  const blocking = valid.find((col) => winsAt(view.board, col, them));
  if (blocking !== undefined) return blocking;

  // 3. Score the rest.
  let best = valid[0] ?? null;
  let bestScore = -Infinity;
  for (const col of valid) {
    const score = scoreColumn(view, col, me, them) + rng() * SCORE.jitter;
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  }
  return best;
}

/** Would `color` complete four in a row by dropping in `col`? */
function winsAt(board: Board, col: number, color: Color): boolean {
  const row = getLandingRow(board, col);
  if (row === null) return false;
  const cell = { col, row };
  return findWinningLine(placeToken(board, cell, color), cell) !== null;
}

function scoreColumn(view: PlayerView, col: number, me: Color, them: Color): number {
  const row = getLandingRow(view.board, col);
  if (row === null) return -Infinity;
  const cell = { col, row };
  const after = placeToken(view.board, cell, me);

  let score = SCORE.centreWeight * (3 - Math.abs(col - Math.floor(COLS / 2)));
  if (winsAt(after, col, them)) score += SCORE.givesWin;
  if (view.ownMines.some((m) => sameCell(m, cell))) score += SCORE.coversOwnMine;
  score += SCORE.neighbourWeight * countNeighbours(after, cell, me);
  return score;
}

function countNeighbours(board: Board, cell: Cell, color: Color): number {
  let count = 0;
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (dc === 0 && dr === 0) continue;
      const n = { col: cell.col + dc, row: cell.row + dr };
      if (isInBounds(n) && board[n.row]?.[n.col] === color) count++;
    }
  }
  return count;
}
