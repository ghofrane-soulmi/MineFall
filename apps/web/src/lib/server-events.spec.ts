import { describe, expect, it } from 'vitest';
import { ME, OPP, playerView } from '../test/fixtures';
import { applyGameOver, applyMinesConfirmed, applyMoveResult } from './server-events';

const move = {
  playerId: ME.id,
  column: 3,
  landedRow: 5,
  outcome: 'placed' as const,
  timeout: false,
  explodedMine: null,
  blockedColumn: null,
  blockedColumns: {},
  nextPlayerId: OPP.id,
  turnEndsAt: 123,
  turnId: 2,
};

describe('applyMoveResult', () => {
  it("places the token where the SERVER says it landed, in the mover's colour", () => {
    const next = applyMoveResult(playerView(), move);
    expect(next.board[5]?.[3]).toBe('red');
    expect(next.currentPlayerId).toBe(OPP.id);
    expect(next.turnId).toBe(2);
    expect(next.moveHistory).toEqual([
      {
        moveNumber: 1,
        playerId: ME.id,
        column: 3,
        landedRow: 5,
        outcome: 'placed',
        timeout: false,
      },
    ]);
  });

  it('does not mutate the previous view', () => {
    const before = playerView();
    applyMoveResult(before, move);
    expect(before.board[5]?.[3]).toBeNull();
  });

  it('an explosion leaves the cell empty, records the mine and copies the blocked columns', () => {
    const exploded = {
      ...move,
      outcome: 'exploded' as const,
      explodedMine: { col: 3, row: 5, ownerId: OPP.id, moveNumber: 1 },
      blockedColumn: 3,
      blockedColumns: { 3: 1 },
    };
    const next = applyMoveResult(playerView(), exploded);
    expect(next.board[5]?.[3]).toBeNull();
    expect(next.explodedMines).toHaveLength(1);
    expect(next.blockedColumns).toEqual({ 3: 1 });
  });

  it('removes one of my mines from my own list when it explodes', () => {
    const view = playerView({ viewerId: OPP.id });
    const next = applyMoveResult(
      { ...view, ownMines: [{ col: 2, row: 5 }] },
      {
        ...move,
        outcome: 'exploded',
        explodedMine: { col: 2, row: 5, ownerId: OPP.id, moveNumber: 1 },
      },
    );
    expect(next.ownMines).toEqual([]);
  });
});

describe('applyGameOver', () => {
  it('finishes the game and reveals every mine', () => {
    const allMines = [{ ownerId: OPP.id, col: 6, row: 1 }];
    const next = applyGameOver(playerView(), {
      result: { type: 'draw' },
      allMines,
      explodedMines: [],
      durationMs: 1000,
      moveCount: 42,
    });
    expect(next.phase).toBe('finished');
    expect(next.currentPlayerId).toBeNull();
    expect(next.revealedMines).toEqual(allMines);
  });
});

describe('applyMinesConfirmed', () => {
  it('marks only that player as confirmed', () => {
    const view = playerView({
      minesConfirmed: [
        { playerId: ME.id, confirmed: false },
        { playerId: OPP.id, confirmed: false },
      ],
    });
    expect(applyMinesConfirmed(view, OPP.id).minesConfirmed).toEqual([
      { playerId: ME.id, confirmed: false },
      { playerId: OPP.id, confirmed: true },
    ]);
  });
});
