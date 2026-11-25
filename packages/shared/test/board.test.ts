import { describe, expect, it } from 'vitest';
import { COLS, ROWS } from '../src/constants';
import {
  createEmptyBoard,
  getLandingRow,
  isBoardFull,
  isColumnFull,
  isInBounds,
  isValidColumnIndex,
  placeToken,
} from '../src/engine/board';
import { boardFrom } from './helpers';

describe('createEmptyBoard', () => {
  it('creates a ROWS x COLS grid of empty cells', () => {
    const board = createEmptyBoard();
    expect(board).toHaveLength(ROWS);
    board.forEach((row) => expect(row).toEqual(Array(COLS).fill(null)));
  });
});

describe('gravity (getLandingRow)', () => {
  it('lands on the bottom row of an empty column', () => {
    expect(getLandingRow(createEmptyBoard(), 3)).toBe(ROWS - 1);
  });

  it('stacks on top of existing tokens', () => {
    const board = boardFrom('...R...', '...Y...');
    expect(getLandingRow(board, 3)).toBe(ROWS - 3);
  });

  it('fills a gap left lower in the column first (e.g. after an explosion)', () => {
    const board = boardFrom('...R...', '.......');
    expect(getLandingRow(board, 3)).toBe(ROWS - 1);
  });

  it('returns null for a full column', () => {
    const board = boardFrom('R......', 'Y......', 'R......', 'Y......', 'R......', 'Y......');
    expect(getLandingRow(board, 0)).toBeNull();
    expect(isColumnFull(board, 0)).toBe(true);
    expect(isColumnFull(board, 1)).toBe(false);
  });

  it.each([-1, COLS, 1.5, Number.NaN])('returns null for invalid column %s', (col) => {
    expect(getLandingRow(createEmptyBoard(), col)).toBeNull();
  });
});

describe('bounds helpers', () => {
  it('validates cells', () => {
    expect(isInBounds({ col: 0, row: 0 })).toBe(true);
    expect(isInBounds({ col: COLS - 1, row: ROWS - 1 })).toBe(true);
    expect(isInBounds({ col: COLS, row: 0 })).toBe(false);
    expect(isInBounds({ col: 0, row: -1 })).toBe(false);
    expect(isInBounds({ col: 0.5, row: 0 })).toBe(false);
  });

  it('validates column indexes', () => {
    expect(isValidColumnIndex(0)).toBe(true);
    expect(isValidColumnIndex(COLS)).toBe(false);
  });
});

describe('placeToken', () => {
  it('returns a new board and leaves the original untouched', () => {
    const before = createEmptyBoard();
    const after = placeToken(before, { col: 2, row: 5 }, 'red');
    expect(after[5]?.[2]).toBe('red');
    expect(before[5]?.[2]).toBeNull();
  });
});

describe('isBoardFull', () => {
  it('is false for an empty board and true for a full one', () => {
    expect(isBoardFull(createEmptyBoard())).toBe(false);
    const full = boardFrom(...Array<string>(ROWS).fill('RYRYRYR'));
    expect(isBoardFull(full)).toBe(true);
  });
});
