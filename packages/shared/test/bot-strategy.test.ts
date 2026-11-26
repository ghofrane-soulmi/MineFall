import { describe, expect, it } from 'vitest';
import { chooseBotColumn, chooseBotMines } from '../src/bot/strategy';
import { applyTimeoutMove, createGame, finishPlacement, getValidColumns } from '../src/engine/game';
import { validateMinePlacement } from '../src/engine/mines';
import { toPlayerView } from '../src/engine/view';
import type { Board } from '../src/types/board';
import type { PlayerView } from '../src/types/view';
import { RED, YELLOW, boardFrom, expectOk, seededRng, sequenceRng } from './helpers';

/** A view for the bot playing RED (viewer) against YELLOW. */
function botView(board: Board, overrides: Partial<PlayerView> = {}): PlayerView {
  const game = expectOk(finishPlacement(createGame(RED, YELLOW), seededRng(1))).state;
  return { ...toPlayerView({ ...game, board }, RED), ownMines: [], ...overrides };
}

describe('chooseBotMines', () => {
  it.each(['easy', 'normal'] as const)('%s: always 2 valid, distinct cells', (level) => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(validateMinePlacement(chooseBotMines(level, seededRng(seed)))).toBeNull();
    }
  });

  it('normal: hides mines low in the centre, where people play early', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const mine of chooseBotMines('normal', seededRng(seed))) {
        expect(mine.row).toBeGreaterThanOrEqual(4);
        expect(mine.col).toBeGreaterThanOrEqual(1);
        expect(mine.col).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe('chooseBotColumn', () => {
  it('easy: plays a random valid column', () => {
    const board = boardFrom('R......', 'Y......', 'R......', 'Y......', 'R......', 'Y......');
    const view = botView(board, { blockedColumns: { 3: 1 } });
    for (let seed = 1; seed <= 30; seed++) {
      const col = chooseBotColumn(view, 'easy', seededRng(seed));
      expect([1, 2, 4, 5, 6]).toContain(col);
    }
  });

  it('normal: takes an immediate win', () => {
    const view = botView(boardFrom('YYY....', 'RRR....'));
    expect(chooseBotColumn(view, 'normal', () => 0.5)).toBe(3);
  });

  it('normal: blocks the opponent when it cannot win', () => {
    const view = botView(boardFrom('R......', 'R...Y..', 'YR..Y..', 'RY..Y..'));
    expect(chooseBotColumn(view, 'normal', () => 0.5)).toBe(4);
  });

  it('normal: never plays a move that lets the opponent win on top of it', () => {
    // Yellow has 3 in a row on row 4 and needs (3,4), which is not reachable yet:
    // if Red fills (3,5), Yellow lands on (3,4) and wins.
    const view = botView(boardFrom('YYY....', 'RRY....'));
    for (let seed = 1; seed <= 30; seed++) {
      expect(chooseBotColumn(view, 'normal', seededRng(seed))).not.toBe(3);
    }
  });

  it('normal: avoids covering its own mine when there is a choice', () => {
    const view = botView(boardFrom('.......'), { ownMines: [{ col: 3, row: 5 }] });
    for (let seed = 1; seed <= 30; seed++) {
      expect(chooseBotColumn(view, 'normal', seededRng(seed))).not.toBe(3);
    }
  });

  it('normal: prefers the centre on an empty board', () => {
    expect(chooseBotColumn(botView(boardFrom('.......')), 'normal', () => 0)).toBe(3);
  });

  it('never picks a blocked or full column, and returns null when nothing is valid', () => {
    const full = boardFrom(...Array<string>(6).fill('RYRYRYR'));
    expect(chooseBotColumn(botView(full), 'normal', () => 0)).toBeNull();
    const view = botView(boardFrom('.......'), {
      blockedColumns: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
    });
    expect(chooseBotColumn(view, 'normal', sequenceRng(0.3))).toBe(6);
  });

  it('only ever receives a PlayerView: the opponent mines are not in its input', () => {
    // Type-level guarantee: chooseBotColumn(view: PlayerView). At runtime, check the view the
    // server would build for the bot during random games never exposes the opponent mines.
    for (let seed = 1; seed <= 30; seed++) {
      const rng = seededRng(seed);
      let state = expectOk(finishPlacement(createGame(RED, YELLOW), rng)).state;
      while (state.phase === 'playing') {
        const view = toPlayerView(state, RED);
        expect(view).not.toHaveProperty('mines');
        const col = chooseBotColumn(view, 'normal', rng);
        expect(getValidColumns(state.board, state.blockedColumns)).toContain(col);
        state = expectOk(applyTimeoutMove(state, rng)).state;
      }
    }
  });
});
