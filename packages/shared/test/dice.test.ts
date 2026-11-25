import { describe, expect, it } from 'vitest';
import { MAX_DICE_ROUNDS } from '../src/constants';
import { rollDie, rollStartingPlayer } from '../src/engine/dice';
import { RED, YELLOW, sequenceRng } from './helpers';

// With a die: rng 0 -> 1, rng 0.5 -> 4, rng 0.99 -> 6.
// Each round consumes 4 rng values: first player's 2 dice, then second player's 2 dice.

describe('rollDie', () => {
  it('returns values from 1 to 6', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.9999)).toBe(6);
  });
});

describe('rollStartingPlayer (two dice each)', () => {
  it('lets the first player start when their total is higher', () => {
    const roll = rollStartingPlayer([RED, YELLOW], sequenceRng(0.99, 0.5, 0, 0.99));
    expect(roll).toEqual({
      rounds: [
        {
          throws: [
            [6, 4],
            [1, 6],
          ],
          totals: [10, 7],
        },
      ],
      firstPlayerId: RED,
    });
  });

  it('lets the second player start when their total is higher', () => {
    const roll = rollStartingPlayer([RED, YELLOW], sequenceRng(0, 0, 0.99, 0.99));
    expect(roll.rounds[0]?.totals).toEqual([2, 12]);
    expect(roll.firstPlayerId).toBe(YELLOW);
  });

  it('compares totals, not individual dice (6+1 vs 4+4)', () => {
    const roll = rollStartingPlayer([RED, YELLOW], sequenceRng(0.99, 0, 0.5, 0.5));
    expect(roll.rounds[0]?.totals).toEqual([7, 8]);
    expect(roll.firstPlayerId).toBe(YELLOW);
  });

  it('re-rolls on equal totals and keeps every round for the animation', () => {
    // Round 1: [1,6] vs [6,1] -> 7 = 7, tie. Round 2: [6,6] vs [1,1] -> red starts.
    const roll = rollStartingPlayer([RED, YELLOW], sequenceRng(0, 0.99, 0.99, 0, 0.99, 0.99, 0, 0));
    expect(roll.rounds.map((r) => r.totals)).toEqual([
      [7, 7],
      [12, 2],
    ]);
    expect(roll.firstPlayerId).toBe(RED);
  });

  it('never loops forever with a broken RNG', () => {
    const roll = rollStartingPlayer([RED, YELLOW], () => 0);
    expect(roll.rounds).toHaveLength(MAX_DICE_ROUNDS);
    expect(roll.firstPlayerId).toBe(RED);
  });
});
