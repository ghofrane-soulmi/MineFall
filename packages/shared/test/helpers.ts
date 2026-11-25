import { expect } from 'vitest';
import { COLS, ROWS } from '../src/constants';
import { applyMove, createGame, placeMines } from '../src/engine/game';
import type { Board, Cell, CellContent } from '../src/types/board';
import type { EngineEvent, EngineResult } from '../src/types/engine';
import type { GameState, Rng } from '../src/types/game';

export const RED = 'alice';
export const YELLOW = 'bob';

/** Mines on row 1 (second from top): out of the way for most tests. */
export const FAR_MINES_RED: Cell[] = [
  { col: 0, row: 1 },
  { col: 1, row: 1 },
];
export const FAR_MINES_YELLOW: Cell[] = [
  { col: 5, row: 1 },
  { col: 6, row: 1 },
];

/**
 * Builds a board from a picture, top row first, so tests read like the real grid:
 *   '.' empty · 'R' red · 'Y' yellow. Missing top rows are filled with empty rows.
 */
export function boardFrom(...rows: string[]): Board {
  if (rows.length > ROWS) throw new Error(`boardFrom: max ${ROWS} rows`);
  const padded = [...Array<string>(ROWS - rows.length).fill('.'.repeat(COLS)), ...rows];
  return padded.map((line) => {
    if (line.length !== COLS) throw new Error(`boardFrom: row "${line}" must be ${COLS} chars`);
    return [...line].map(toContent);
  });
}

function toContent(char: string): CellContent {
  if (char === 'R') return 'red';
  if (char === 'Y') return 'yellow';
  if (char === '.') return null;
  throw new Error(`boardFrom: unknown char "${char}"`);
}

/** Unwraps a successful engine result, failing the test with the error code otherwise. */
export function expectOk(result: EngineResult): {
  state: GameState;
  events: readonly EngineEvent[];
} {
  if (!result.ok) expect.fail(`expected ok, got error ${result.error}`);
  return { state: result.state, events: result.events };
}

/** A game already in the playing phase, Red to move. */
export function startedGame(
  redMines: Cell[] = FAR_MINES_RED,
  yellowMines: Cell[] = FAR_MINES_YELLOW,
): GameState {
  const created = createGame(RED, YELLOW);
  const afterRed = expectOk(placeMines(created, { playerId: RED, cells: redMines })).state;
  return expectOk(placeMines(afterRed, { playerId: YELLOW, cells: yellowMines })).state;
}

/** Deterministic seeded RNG (mulberry32), for reproducible "random" tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG returning the given values in a loop. */
export function sequenceRng(...values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length] as number;
}

/**
 * A full 7x6 board with no 4-in-a-row anywhere: R when (col % 4 < 2) XOR (row is odd).
 * Used to build draw scenarios.
 */
export function fullBoardWithoutWin(): CellContent[][] {
  return Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col): CellContent =>
      col % 4 < 2 !== (row % 2 === 1) ? 'red' : 'yellow',
    ),
  );
}

/** The current player drops in `column` with the correct turnId; fails the test if refused. */
export function drop(state: GameState, column: number): GameState {
  if (state.currentPlayerId === null) expect.fail('drop: no current player');
  return expectOk(
    applyMove(state, { playerId: state.currentPlayerId, column, turnId: state.turnId }),
  ).state;
}

/** Plays a list of columns in order, alternating players. */
export function dropAll(state: GameState, columns: number[]): GameState {
  return columns.reduce(drop, state);
}

/** Replaces the board of a game (to set up mid-game scenarios). */
export function withBoard(state: GameState, board: Board): GameState {
  return { ...state, board };
}

/** Deep copy of plain data, to prove an action did not mutate its input. */
export function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
