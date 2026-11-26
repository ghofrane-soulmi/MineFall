import {
  applyMove,
  createGame,
  forfeit,
  placeMines,
  type EngineResult,
  type GameState,
} from '@minefall/shared';
import { describe, expect, it } from 'vitest';
import { ALICE, BOB } from '../../test/fakes';
import { toFinishedGameRecord } from './game-recorder';

function ok(result: EngineResult): GameState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

/** Alice steps on Bob's mine at (3,5), then Bob forfeits. */
function finishedGame(): GameState {
  let game = createGame(ALICE.id, BOB.id);
  game = ok(
    placeMines(game, {
      playerId: ALICE.id,
      cells: [
        { col: 0, row: 1 },
        { col: 1, row: 1 },
      ],
    }),
  );
  game = ok(
    placeMines(game, {
      playerId: BOB.id,
      cells: [
        { col: 3, row: 5 },
        { col: 6, row: 1 },
      ],
    }),
  );
  game = ok(applyMove(game, { playerId: ALICE.id, column: 3, turnId: game.turnId }));
  return ok(forfeit(game, BOB.id));
}

describe('toFinishedGameRecord', () => {
  const record = toFinishedGameRecord({
    roomCode: 'K7QX2M',
    game: finishedGame(),
    nicknames: new Map([
      [ALICE.id, ALICE.nickname],
      [BOB.id, BOB.nickname],
    ]),
    startedAt: 1_000,
    endedAt: 9_000,
    moveTimes: [4_000],
  });

  it('keeps players in red/yellow order with their nicknames', () => {
    expect(record.players).toEqual([ALICE, BOB]);
    expect(record.result).toEqual({ type: 'forfeit', winnerId: ALICE.id });
  });

  it('stores exploded mines with their move, and remaining mines as unexploded', () => {
    expect(record.mines).toEqual([
      { ownerId: BOB.id, col: 3, row: 5, exploded: true, explodedAtMove: 1 },
      { ownerId: ALICE.id, col: 0, row: 1, exploded: false, explodedAtMove: null },
      { ownerId: ALICE.id, col: 1, row: 1, exploded: false, explodedAtMove: null },
      { ownerId: BOB.id, col: 6, row: 1, exploded: false, explodedAtMove: null },
    ]);
  });

  it('stores moves with their outcome and the time they were played', () => {
    expect(record.moves).toEqual([
      {
        moveNumber: 1,
        playerId: ALICE.id,
        column: 3,
        landedRow: 5,
        outcome: 'exploded',
        timedOut: false,
        playedAt: new Date(4_000),
      },
    ]);
    expect(record.startedAt).toEqual(new Date(1_000));
    expect(record.endedAt).toEqual(new Date(9_000));
  });

  it('refuses a game that is not finished', () => {
    expect(() =>
      toFinishedGameRecord({
        roomCode: 'X',
        game: createGame(ALICE.id, BOB.id),
        nicknames: new Map(),
        startedAt: 0,
        endedAt: 0,
        moveTimes: [],
      }),
    ).toThrow();
  });
});
