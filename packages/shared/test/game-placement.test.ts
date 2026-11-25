import { describe, expect, it } from 'vitest';
import { createGame, finishPlacement, placeMines } from '../src/engine/game';
import { validateMinePlacement } from '../src/engine/mines';
import {
  FAR_MINES_RED,
  FAR_MINES_YELLOW,
  RED,
  YELLOW,
  expectOk,
  seededRng,
  snapshot,
} from './helpers';

describe('createGame', () => {
  it('starts in the placement phase with the first player as red', () => {
    const game = createGame(RED, YELLOW);
    expect(game.phase).toBe('placement');
    expect(game.players).toEqual([
      { id: RED, color: 'red' },
      { id: YELLOW, color: 'yellow' },
    ]);
    expect(game.currentPlayerId).toBeNull();
    expect(game.minesConfirmed).toEqual({ [RED]: false, [YELLOW]: false });
  });

  it('refuses two identical player ids', () => {
    expect(() => createGame(RED, RED)).toThrow();
  });
});

describe('placeMines', () => {
  it('stores the mines and confirms the player, play not started yet', () => {
    const { state, events } = expectOk(
      placeMines(createGame(RED, YELLOW), { playerId: RED, cells: FAR_MINES_RED }),
    );
    expect(state.mines[RED]).toEqual(FAR_MINES_RED);
    expect(state.minesConfirmed[RED]).toBe(true);
    expect(state.phase).toBe('placement');
    expect(events).toEqual([{ type: 'minesConfirmed', playerId: RED }]);
  });

  it('starts play with red to move once both players confirmed', () => {
    const afterRed = expectOk(
      placeMines(createGame(RED, YELLOW), { playerId: RED, cells: FAR_MINES_RED }),
    ).state;
    const { state, events } = expectOk(
      placeMines(afterRed, { playerId: YELLOW, cells: FAR_MINES_YELLOW }),
    );
    expect(state.phase).toBe('playing');
    expect(state.currentPlayerId).toBe(RED);
    expect(state.turnId).toBe(1);
    expect(events).toEqual([
      { type: 'minesConfirmed', playerId: YELLOW },
      { type: 'playStarted', currentPlayerId: RED, turnId: 1 },
    ]);
  });

  it('allows both players to mine the same cell (spec section 3)', () => {
    const afterRed = expectOk(
      placeMines(createGame(RED, YELLOW), { playerId: RED, cells: FAR_MINES_RED }),
    ).state;
    expect(placeMines(afterRed, { playerId: YELLOW, cells: FAR_MINES_RED }).ok).toBe(true);
  });

  it('does not mutate the input state', () => {
    const game = createGame(RED, YELLOW);
    const before = snapshot(game);
    placeMines(game, { playerId: RED, cells: FAR_MINES_RED });
    expect(game).toEqual(before);
  });

  it.each([
    ['an unknown player', { playerId: 'mallory', cells: FAR_MINES_RED }, 'UNKNOWN_PLAYER'],
    ['an invalid placement', { playerId: RED, cells: [{ col: 0, row: 0 }] }, 'INVALID_MINE_COUNT'],
  ])('refuses %s', (_label, input, error) => {
    expect(placeMines(createGame(RED, YELLOW), input)).toEqual({ ok: false, error });
  });

  it('refuses a second placement from the same player', () => {
    const afterRed = expectOk(
      placeMines(createGame(RED, YELLOW), { playerId: RED, cells: FAR_MINES_RED }),
    ).state;
    expect(placeMines(afterRed, { playerId: RED, cells: FAR_MINES_YELLOW })).toEqual({
      ok: false,
      error: 'MINES_ALREADY_CONFIRMED',
    });
  });

  it('refuses placement outside the placement phase', () => {
    const playing = expectOk(finishPlacement(createGame(RED, YELLOW), seededRng(1))).state;
    expect(placeMines(playing, { playerId: RED, cells: FAR_MINES_RED })).toEqual({
      ok: false,
      error: 'WRONG_PHASE',
    });
  });
});

describe('finishPlacement (placement timer ended)', () => {
  it('places random valid mines for players who did not confirm', () => {
    const { state, events } = expectOk(finishPlacement(createGame(RED, YELLOW), seededRng(42)));
    expect(validateMinePlacement(state.mines[RED] ?? [])).toBeNull();
    expect(validateMinePlacement(state.mines[YELLOW] ?? [])).toBeNull();
    expect(state.phase).toBe('playing');
    expect(events.map((e) => e.type)).toEqual(['minesConfirmed', 'minesConfirmed', 'playStarted']);
  });

  it("keeps a confirmed player's own choice", () => {
    const afterRed = expectOk(
      placeMines(createGame(RED, YELLOW), { playerId: RED, cells: FAR_MINES_RED }),
    ).state;
    const { state, events } = expectOk(finishPlacement(afterRed, seededRng(3)));
    expect(state.mines[RED]).toEqual(FAR_MINES_RED);
    expect(events[0]).toEqual({ type: 'minesConfirmed', playerId: YELLOW });
  });

  it('refuses outside the placement phase', () => {
    const playing = expectOk(finishPlacement(createGame(RED, YELLOW), seededRng(1))).state;
    expect(finishPlacement(playing, seededRng(1))).toEqual({ ok: false, error: 'WRONG_PHASE' });
  });
});
