import { describe, expect, it } from 'vitest';
import { ROWS } from '../src/constants';
import { applyMove, createGame, getValidColumns } from '../src/engine/game';
import {
  RED,
  YELLOW,
  boardFrom,
  drop,
  dropAll,
  expectOk,
  startedGame,
  withBoard,
  snapshot,
} from './helpers';

describe('applyMove: gravity and turns', () => {
  it('drops the token to the bottom row and passes the turn', () => {
    const game = startedGame();
    const { state, events } = expectOk(applyMove(game, { playerId: RED, column: 3, turnId: 1 }));
    expect(state.board[ROWS - 1]?.[3]).toBe('red');
    expect(state.currentPlayerId).toBe(YELLOW);
    expect(state.turnId).toBe(2);
    expect(events).toEqual([
      {
        type: 'moveApplied',
        move: {
          moveNumber: 1,
          playerId: RED,
          column: 3,
          landedRow: 5,
          outcome: 'placed',
          timeout: false,
        },
        explodedMine: null,
        blockedColumn: null,
        nextPlayerId: YELLOW,
        turnId: 2,
      },
    ]);
  });

  it('stacks tokens and alternates colours', () => {
    const state = dropAll(startedGame(), [3, 3, 3]);
    expect(state.board.map((row) => row[3])).toEqual([null, null, null, 'red', 'yellow', 'red']);
    expect(state.moveHistory.map((m) => m.playerId)).toEqual([RED, YELLOW, RED]);
  });

  it('does not mutate the input state', () => {
    const game = startedGame();
    const before = snapshot(game);
    drop(game, 0);
    expect(game).toEqual(before);
  });
});

describe('applyMove: validation (invalid moves change nothing)', () => {
  const game = startedGame();

  it.each([
    ['an unknown player', { playerId: 'mallory', column: 0, turnId: 1 }, 'UNKNOWN_PLAYER'],
    ['the wrong player', { playerId: YELLOW, column: 0, turnId: 1 }, 'NOT_YOUR_TURN'],
    ['a stale turnId (double click)', { playerId: RED, column: 0, turnId: 0 }, 'STALE_TURN'],
    ['a negative column', { playerId: RED, column: -1, turnId: 1 }, 'INVALID_COLUMN'],
    ['a column past the edge', { playerId: RED, column: 7, turnId: 1 }, 'INVALID_COLUMN'],
    ['a non-integer column', { playerId: RED, column: 1.5, turnId: 1 }, 'INVALID_COLUMN'],
  ])('refuses %s', (_label, input, error) => {
    expect(applyMove(game, input)).toEqual({ ok: false, error });
  });

  it('refuses a full column', () => {
    const full = withBoard(
      game,
      boardFrom('Y......', 'R......', 'Y......', 'R......', 'Y......', 'R......'),
    );
    expect(applyMove(full, { playerId: RED, column: 0, turnId: 1 })).toEqual({
      ok: false,
      error: 'COLUMN_FULL',
    });
  });

  it('refuses moves during placement', () => {
    expect(applyMove(createGame(RED, YELLOW), { playerId: RED, column: 0, turnId: 0 })).toEqual({
      ok: false,
      error: 'WRONG_PHASE',
    });
  });

  it('refuses the same click twice (second one has a stale turnId)', () => {
    const input = { playerId: RED, column: 0, turnId: 1 };
    const after = expectOk(applyMove(game, input)).state;
    expect(applyMove(after, input)).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(applyMove(after, { ...input, playerId: YELLOW })).toEqual({
      ok: false,
      error: 'STALE_TURN',
    });
  });
});

describe('getValidColumns', () => {
  it('excludes full and blocked columns', () => {
    const board = boardFrom('Y......', 'R......', 'Y......', 'R......', 'Y......', 'R......');
    expect(getValidColumns(board, { 3: 1 })).toEqual([1, 2, 4, 5, 6]);
  });
});
