import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/engine/game';
import {
  FAR_MINES_RED,
  FAR_MINES_YELLOW,
  RED,
  YELLOW,
  drop,
  dropAll,
  expectOk,
  startedGame,
} from './helpers';

const BOTTOM_OF_COL_3 = { col: 3, row: 5 };

describe('own mines', () => {
  it('never hurt their owner: the token stays and the mine stays hidden', () => {
    const game = startedGame([BOTTOM_OF_COL_3, { col: 0, row: 1 }], FAR_MINES_YELLOW);
    const { state, events } = expectOk(applyMove(game, { playerId: RED, column: 3, turnId: 1 }));
    expect(state.board[5]?.[3]).toBe('red');
    expect(state.mines[RED]).toContainEqual(BOTTOM_OF_COL_3);
    expect(state.explodedMines).toEqual([]);
    expect(events[0]).toMatchObject({ explodedMine: null, blockedColumn: null });
  });
});

describe('opponent mines (explosion)', () => {
  const game = startedGame(FAR_MINES_RED, [BOTTOM_OF_COL_3, { col: 6, row: 1 }]);
  const { state, events } = expectOk(applyMove(game, { playerId: RED, column: 3, turnId: 1 }));

  it('destroys the token and leaves the cell empty', () => {
    expect(state.board[5]?.[3]).toBeNull();
  });

  it('removes the mine and reveals it publicly', () => {
    expect(state.mines[YELLOW]).toEqual([{ col: 6, row: 1 }]);
    expect(state.explodedMines).toEqual([{ ...BOTTOM_OF_COL_3, ownerId: YELLOW, moveNumber: 1 }]);
  });

  it('records the move as exploded and still passes the turn', () => {
    expect(state.moveHistory[0]).toMatchObject({ outcome: 'exploded', landedRow: 5 });
    expect(state.currentPlayerId).toBe(YELLOW);
    expect(events[0]).toMatchObject({
      type: 'moveApplied',
      explodedMine: { ...BOTTOM_OF_COL_3, ownerId: YELLOW },
      blockedColumn: 3,
      nextPlayerId: YELLOW,
    });
  });

  it('blocks the column for the next move only (decided: 1 move)', () => {
    expect(state.blockedColumns).toEqual({ 3: 1 });
    expect(applyMove(state, { playerId: YELLOW, column: 3, turnId: state.turnId })).toEqual({
      ok: false,
      error: 'COLUMN_BLOCKED',
    });
    const afterYellow = drop(state, 0);
    expect(afterYellow.blockedColumns).toEqual({});
    const afterRed = drop(afterYellow, 3);
    // The emptied cell is filled normally: the mine is gone.
    expect(afterRed.board[5]?.[3]).toBe('red');
  });

  it('cannot produce a win (the token is destroyed)', () => {
    // Red has 3 in a row at the bottom; the 4th lands on Yellow's mine.
    const setup = startedGame(FAR_MINES_RED, [BOTTOM_OF_COL_3, { col: 6, row: 1 }]);
    const ready = dropAll(setup, [0, 0, 1, 1, 2, 2]);
    const after = drop(ready, 3);
    expect(after.phase).toBe('playing');
    expect(after.result).toBeNull();
  });

  it('also explodes on a mine higher up the column', () => {
    const setup = startedGame(FAR_MINES_RED, [
      { col: 2, row: 4 },
      { col: 6, row: 1 },
    ]);
    const after = dropAll(setup, [2, 2]); // red lands row 5, yellow row 4: own mine, safe
    expect(after.explodedMines).toEqual([]);
    const redOnYellow = startedGame(FAR_MINES_RED, [
      { col: 2, row: 4 },
      { col: 6, row: 1 },
    ]);
    const exploded = dropAll(redOnYellow, [2, 0, 2]); // red's second token lands on row 4
    expect(exploded.explodedMines).toHaveLength(1);
    expect(exploded.board[4]?.[2]).toBeNull();
  });
});

describe('both players mined the same cell (decided: it explodes)', () => {
  it('explodes and clears both mines', () => {
    const game = startedGame(
      [BOTTOM_OF_COL_3, { col: 0, row: 1 }],
      [BOTTOM_OF_COL_3, { col: 6, row: 1 }],
    );
    const state = drop(game, 3);
    expect(state.board[5]?.[3]).toBeNull();
    expect(state.mines[RED]).toEqual([{ col: 0, row: 1 }]);
    expect(state.mines[YELLOW]).toEqual([{ col: 6, row: 1 }]);
    expect(state.explodedMines.map((m) => m.ownerId)).toEqual([YELLOW, RED]);
  });
});
