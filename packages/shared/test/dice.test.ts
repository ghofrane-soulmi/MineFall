import { describe, expect, it } from 'vitest';
import { MAX_DICE_ROUNDS } from '../src/constants';
import { rollDie, rollStartingPlayer } from '../src/engine/dice';
import { RED, YELLOW, sequenceRng } from './helpers';

// With a die: rng 0 -> 1, rng 0.99 -> 6, rng 0.5 -> 4.

describe('rollDie', () => {
  it('returns values from 1 to 6', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.9999)).toBe(6);
  });
});

describe('rollStartingPlayer', () => {
  it('lets the first player start when they roll higher', () => {
    const roll = rollStartingPlayer([RED, YELLOW], sequenceRng(0.99, 0));
    expect(roll).toEqual({ rounds: [{ rolls: [6, 1] }], firstPlayerId: RED });
  });

  it('lets the second player start when they roll higher', () => {
    const roll = rollStartingPlayer([RED, YELLOW], sequenceRng(0, 0.99));
    expect(roll.firstPlayerId).toBe(YELLOW);
  });

  it('re-rolls on a tie and keeps every round for the animation', () => {
    const roll = rollStartingPlayer([RED, YELLOW], sequenceRng(0.5, 0.5, 0, 0.99));
    expect(roll.rounds).toEqual([{ rolls: [4, 4] }, { rolls: [1, 6] }]);
    expect(roll.firstPlayerId).toBe(YELLOW);
  });

  it('never loops forever with a broken RNG', () => {
    const roll = rollStartingPlayer([RED, YELLOW], () => 0);
    expect(roll.rounds).toHaveLength(MAX_DICE_ROUNDS);
    expect(roll.firstPlayerId).toBe(RED);
  });
});
