/**
 * SECURITY (SPEC section 6): a player's view must never contain the opponent's unexploded
 * mines. Checked on hand-written scenarios AND on hundreds of random full games, at every step.
 */
import { describe, expect, it } from 'vitest';
import { applyTimeoutMove, createGame, finishPlacement, getOpponentId } from '../src/engine/game';
import { sameCell } from '../src/engine/mines';
import { toPlayerView } from '../src/engine/view';
import type { Cell } from '../src/types/board';
import type { GameState, PlayerId } from '../src/types/game';
import {
  FAR_MINES_RED,
  FAR_MINES_YELLOW,
  RED,
  YELLOW,
  drop,
  expectOk,
  seededRng,
  startedGame,
  snapshot,
} from './helpers';

/** Every {col,row} object found anywhere inside a (JSON-serialised) payload. */
function cellsInPayload(payload: unknown): Cell[] {
  const found: Cell[] = [];
  JSON.parse(JSON.stringify(payload), (_key, value: unknown) => {
    if (value && typeof value === 'object' && 'col' in value && 'row' in value) {
      found.push(value as Cell);
    }
    return value;
  });
  return found;
}

/**
 * Asserts the view sent to `viewerId` leaks none of the opponent's unexploded mines.
 * A cell the viewer mined themselves may legitimately appear (they chose it).
 */
function assertNoOpponentMineLeak(state: GameState, viewerId: PlayerId): void {
  if (state.phase === 'finished') return; // everything is revealed at the end, by design
  const view = toPlayerView(state, viewerId);
  const ownMines = state.mines[viewerId] ?? [];
  const secret = (state.mines[getOpponentId(state, viewerId)] ?? []).filter(
    (m) => !ownMines.some((own) => sameCell(own, m)),
  );
  const leaked = cellsInPayload(view).filter((c) => secret.some((m) => sameCell(m, c)));
  expect(leaked, `opponent mines leaked to ${viewerId}`).toEqual([]);
  expect(view).not.toHaveProperty('mines');
  expect(view.revealedMines).toBeNull();
}

describe('toPlayerView: content', () => {
  const game = startedGame();

  it("includes the viewer's own mines only", () => {
    expect(toPlayerView(game, RED).ownMines).toEqual(FAR_MINES_RED);
    expect(toPlayerView(game, YELLOW).ownMines).toEqual(FAR_MINES_YELLOW);
  });

  it("never contains the opponent's mines, for either player", () => {
    assertNoOpponentMineLeak(game, RED);
    assertNoOpponentMineLeak(game, YELLOW);
  });

  it('shows who confirmed mines, never where (placement phase)', () => {
    const placement = createGame(RED, YELLOW);
    const view = toPlayerView(
      {
        ...placement,
        mines: { [RED]: [], [YELLOW]: FAR_MINES_YELLOW },
        minesConfirmed: { [RED]: false, [YELLOW]: true },
      },
      RED,
    );
    expect(view.minesConfirmed).toEqual([
      { playerId: RED, confirmed: false },
      { playerId: YELLOW, confirmed: true },
    ]);
    expect(cellsInPayload(view)).toEqual([]);
  });

  it('shows exploded mines to both players', () => {
    const game2 = startedGame(FAR_MINES_RED, [
      { col: 3, row: 5 },
      { col: 6, row: 1 },
    ]);
    const after = drop(game2, 3);
    for (const viewer of [RED, YELLOW]) {
      expect(toPlayerView(after, viewer).explodedMines).toEqual([
        { col: 3, row: 5, ownerId: YELLOW, moveNumber: 1 },
      ]);
    }
    assertNoOpponentMineLeak(after, RED);
  });

  it('reveals every remaining mine once the game is finished', () => {
    const finished = drop(drop(drop(drop(drop(drop(drop(game, 0), 0), 1), 1), 2), 2), 3);
    expect(finished.phase).toBe('finished');
    expect(toPlayerView(finished, RED).revealedMines).toEqual([
      ...FAR_MINES_RED.map((m) => ({ ownerId: RED, ...m })),
      ...FAR_MINES_YELLOW.map((m) => ({ ownerId: YELLOW, ...m })),
    ]);
  });

  it('gives an unknown viewer (future spectator) no mines at all', () => {
    const view = toPlayerView(game, 'spectator');
    expect(view.ownMines).toEqual([]);
    expect(cellsInPayload(view)).toEqual([]);
  });

  it('returns copies: mutating a view cannot corrupt the server state', () => {
    const before = snapshot(game);
    const view = toPlayerView(game, RED) as unknown as { board: unknown[][]; ownMines: Cell[] };
    (view.board[5] as unknown[])[0] = 'yellow';
    view.ownMines.push({ col: 9, row: 9 });
    expect(game).toEqual(before);
  });
});

describe('toPlayerView: no leak during random full games', () => {
  it('holds at every step of 300 random games (random mines, random moves)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = seededRng(seed);
      let state = expectOk(finishPlacement(createGame(RED, YELLOW), rng)).state;
      let steps = 0;
      while (state.phase === 'playing') {
        assertNoOpponentMineLeak(state, RED);
        assertNoOpponentMineLeak(state, YELLOW);
        state = expectOk(applyTimeoutMove(state, rng)).state;
        steps++;
        // 42 cells + at most 4 explosions: a game can never last longer.
        expect(steps).toBeLessThanOrEqual(46);
      }
      expect(state.result).not.toBeNull();
    }
  });
});
