import { describe, expect, it } from 'vitest';
import { applyMove, applyTimeoutMove, forfeit } from '../src/engine/game';
import type { CellContent } from '../src/types/board';
import type { GameState } from '../src/types/game';
import {
  FAR_MINES_RED,
  RED,
  YELLOW,
  boardFrom,
  drop,
  dropAll,
  expectOk,
  fullBoardWithoutWin,
  sequenceRng,
  startedGame,
  withBoard,
} from './helpers';

describe('win', () => {
  it('ends the game with the winning line when 4 align (horizontal)', () => {
    const before = dropAll(startedGame(), [0, 0, 1, 1, 2, 2]);
    const state = drop(before, 3); // Red completes columns 0-1-2-3 on the bottom row
    expect(state.phase).toBe('finished');
    expect(state.currentPlayerId).toBeNull();
    expect(state.result).toEqual({
      type: 'win',
      winnerId: RED,
      winningLine: [0, 1, 2, 3].map((col) => ({ col, row: 5 })),
    });
  });

  it('works for a vertical line and emits gameOver after the move', () => {
    const before = dropAll(startedGame(), [4, 5, 4, 5, 4, 5]);
    const { events } = expectOk(
      applyMove(before, { playerId: RED, column: 4, turnId: before.turnId }),
    );
    expect(events.map((e) => e.type)).toEqual(['moveApplied', 'gameOver']);
    expect(events[0]).toMatchObject({ nextPlayerId: null });
  });

  it('lets Yellow win too', () => {
    const state = dropAll(startedGame(), [0, 6, 0, 6, 1, 6, 1, 6]);
    expect(state.result).toMatchObject({ type: 'win', winnerId: YELLOW });
  });

  it('refuses any move after the game is over', () => {
    const won = dropAll(startedGame(), [0, 0, 1, 1, 2, 2, 3]);
    expect(applyTimeoutMove(won, () => 0)).toEqual({ ok: false, error: 'WRONG_PHASE' });
    expect(applyMove(won, { playerId: YELLOW, column: 0, turnId: won.turnId })).toEqual({
      ok: false,
      error: 'WRONG_PHASE',
    });
  });
});

describe('draw', () => {
  it('when the board becomes full without a winner', () => {
    const board = fullBoardWithoutWin();
    (board[0] as CellContent[])[6] = null; // one empty cell left, top of column 6
    const game: GameState = { ...withBoard(startedGame(), board), currentPlayerId: YELLOW };
    const state = drop(game, 6);
    expect(state.result).toEqual({ type: 'draw' });
    expect(state.phase).toBe('finished');
  });

  it('when the next player has no valid column (last free column blocked by an explosion)', () => {
    const board = fullBoardWithoutWin();
    (board[0] as CellContent[])[6] = null;
    (board[1] as CellContent[])[6] = null;
    const game = withBoard(
      startedGame(FAR_MINES_RED, [
        { col: 6, row: 1 },
        { col: 0, row: 1 },
      ]),
      board,
    );
    const state = drop(game, 6); // Red lands on Yellow's mine at (6,1): column 6 blocked
    expect(state.explodedMines).toHaveLength(1);
    expect(state.result).toEqual({ type: 'draw' });
  });

  it('not when another column is still free', () => {
    const board = fullBoardWithoutWin();
    (board[0] as CellContent[])[6] = null;
    (board[1] as CellContent[])[6] = null;
    (board[0] as CellContent[])[0] = null;
    const game = withBoard(
      startedGame(FAR_MINES_RED, [
        { col: 6, row: 1 },
        { col: 2, row: 1 },
      ]),
      board,
    );
    const state = drop(game, 6);
    expect(state.phase).toBe('playing');
    expect(state.currentPlayerId).toBe(YELLOW);
  });
});

describe('applyTimeoutMove (turn timer ended)', () => {
  it('plays a random valid column for the current player, flagged as timeout', () => {
    const { state } = expectOk(applyTimeoutMove(startedGame(), () => 0.5)); // index 3 of 0..6
    expect(state.moveHistory[0]).toMatchObject({ playerId: RED, column: 3, timeout: true });
    expect(state.currentPlayerId).toBe(YELLOW);
  });

  it('never picks a full or blocked column', () => {
    const board = boardFrom('Y......', 'R......', 'Y......', 'R......', 'Y......', 'R......');
    const game = { ...withBoard(startedGame(), board), blockedColumns: { 3: 1 } };
    // valid = [1, 2, 4, 5, 6]; rng 0.5 -> index 2 -> column 4; rng 0 -> column 1
    expect(expectOk(applyTimeoutMove(game, sequenceRng(0.5))).state.moveHistory[0]?.column).toBe(4);
    expect(expectOk(applyTimeoutMove(game, sequenceRng(0))).state.moveHistory[0]?.column).toBe(1);
  });

  it('refuses outside the playing phase', () => {
    const placement = { ...startedGame(), phase: 'placement' as const };
    expect(applyTimeoutMove(placement, () => 0)).toEqual({ ok: false, error: 'WRONG_PHASE' });
  });

  it('defends against an impossible state with no valid column', () => {
    const full = withBoard(startedGame(), fullBoardWithoutWin());
    expect(applyTimeoutMove(full, () => 0)).toEqual({ ok: false, error: 'INVALID_COLUMN' });
  });
});

describe('forfeit', () => {
  it('makes the opponent win', () => {
    const { state, events } = expectOk(forfeit(startedGame(), RED));
    expect(state.result).toEqual({ type: 'forfeit', winnerId: YELLOW });
    expect(state.phase).toBe('finished');
    expect(events).toEqual([{ type: 'gameOver', result: { type: 'forfeit', winnerId: YELLOW } }]);
  });

  it('refuses an unknown player or a finished game', () => {
    expect(forfeit(startedGame(), 'mallory')).toEqual({ ok: false, error: 'UNKNOWN_PLAYER' });
    const finished = expectOk(forfeit(startedGame(), RED)).state;
    expect(forfeit(finished, YELLOW)).toEqual({ ok: false, error: 'WRONG_PHASE' });
  });
});
