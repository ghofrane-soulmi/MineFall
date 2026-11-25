import { describe, expect, it } from 'vitest';
import { COLS, ROWS } from '../src/constants';
import { allowedMineCells, randomMineCells, validateMinePlacement } from '../src/engine/mines';
import { seededRng } from './helpers';

describe('validateMinePlacement', () => {
  it('accepts 2 distinct cells below the top row', () => {
    expect(
      validateMinePlacement([
        { col: 0, row: 1 },
        { col: 6, row: 5 },
      ]),
    ).toBeNull();
  });

  it.each([
    ['too few', [{ col: 0, row: 1 }], 'INVALID_MINE_COUNT'],
    [
      'too many',
      [
        { col: 0, row: 1 },
        { col: 1, row: 1 },
        { col: 2, row: 1 },
      ],
      'INVALID_MINE_COUNT',
    ],
    [
      'out of bounds',
      [
        { col: 7, row: 1 },
        { col: 1, row: 1 },
      ],
      'MINE_OUT_OF_BOUNDS',
    ],
    [
      'top row',
      [
        { col: 3, row: 0 },
        { col: 1, row: 1 },
      ],
      'MINE_ON_TOP_ROW',
    ],
    [
      'duplicate',
      [
        { col: 2, row: 3 },
        { col: 2, row: 3 },
      ],
      'DUPLICATE_MINE',
    ],
  ])('rejects %s', (_label, cells, error) => {
    expect(validateMinePlacement(cells)).toBe(error);
  });
});

describe('allowedMineCells', () => {
  it('contains every cell except the top row', () => {
    const cells = allowedMineCells();
    expect(cells).toHaveLength(COLS * (ROWS - 1));
    expect(cells.some((c) => c.row === 0)).toBe(false);
  });
});

describe('randomMineCells', () => {
  it('returns distinct valid cells', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(validateMinePlacement(randomMineCells(seededRng(seed), 2))).toBeNull();
    }
  });

  it('never picks an excluded cell', () => {
    const exclude = allowedMineCells().slice(1); // only the first cell remains
    expect(randomMineCells(seededRng(7), 2, exclude)).toEqual([allowedMineCells()[0]]);
  });
});
