import { describe, expect, it } from 'vitest';
import { findWinningLine } from '../src/engine/win';
import { boardFrom } from './helpers';

// Reminder: boardFrom pads missing top rows, so the LAST string is row 5 (bottom).

describe('findWinningLine', () => {
  it('detects a horizontal line', () => {
    const board = boardFrom('.RRRR..');
    expect(findWinningLine(board, { col: 4, row: 5 })).toEqual([
      { col: 1, row: 5 },
      { col: 2, row: 5 },
      { col: 3, row: 5 },
      { col: 4, row: 5 },
    ]);
  });

  it('detects a vertical line', () => {
    const board = boardFrom('Y......', 'Y......', 'Y......', 'Y......');
    expect(findWinningLine(board, { col: 0, row: 2 })).toHaveLength(4);
  });

  it('detects a "/" diagonal', () => {
    const board = boardFrom(
      '...R...', //
      '..RY...',
      '.RYY...',
      'RYYY...',
    );
    expect(findWinningLine(board, { col: 3, row: 2 })).toEqual([
      { col: 0, row: 5 },
      { col: 1, row: 4 },
      { col: 2, row: 3 },
      { col: 3, row: 2 },
    ]);
  });

  it('detects a "\\" diagonal', () => {
    const board = boardFrom(
      '...Y...', //
      '...RY..',
      '...RRY.',
      '...RRRY',
    );
    expect(findWinningLine(board, { col: 3, row: 2 })).toHaveLength(4);
  });

  it('detects a line when the last token is in the middle of it', () => {
    const board = boardFrom('RRRRR..');
    expect(findWinningLine(board, { col: 2, row: 5 })).toHaveLength(5);
  });

  it('works at the board edges (right column, top row)', () => {
    const board = boardFrom(
      '...RRRR', //
      '...YYYR',
      '...RYYY',
      '...YRRR',
      '...RYYY',
      '...YRRR',
    );
    expect(findWinningLine(board, { col: 6, row: 0 })).toHaveLength(4);
  });

  it('returns null for 3 in a row', () => {
    expect(findWinningLine(boardFrom('RRR....'), { col: 2, row: 5 })).toBeNull();
  });

  it('does not mix colours', () => {
    expect(findWinningLine(boardFrom('RRYR...'), { col: 3, row: 5 })).toBeNull();
  });

  it('does not count a line broken by an empty gap', () => {
    expect(findWinningLine(boardFrom('RR.RR..'), { col: 1, row: 5 })).toBeNull();
  });

  it('returns null when the given cell is empty', () => {
    expect(findWinningLine(boardFrom('RRRR...'), { col: 5, row: 5 })).toBeNull();
  });
});
