/**
 * Starting-player dice roll: each player rolls two dice, the highest total starts (Player 1,
 * red). Equal totals re-roll. All rounds are returned so the client can animate them.
 */
import { DICE_PER_PLAYER, DIE_FACES, MAX_DICE_ROUNDS } from '../constants';
import type { PlayerId, Rng } from '../types/game';

/** One player's dice in a round, e.g. [3, 5]. */
export type DiceThrow = readonly number[];

export interface DiceRound {
  /** Dice of [first player, second player], in the order given to rollStartingPlayer. */
  readonly throws: readonly [DiceThrow, DiceThrow];
  readonly totals: readonly [number, number];
}

export interface StartingRoll {
  readonly rounds: readonly DiceRound[];
  readonly firstPlayerId: PlayerId;
}

export function rollDie(rng: Rng): number {
  return Math.floor(rng() * DIE_FACES) + 1;
}

function throwDice(rng: Rng): DiceThrow {
  return Array.from({ length: DICE_PER_PLAYER }, () => rollDie(rng));
}

function sum(values: DiceThrow): number {
  return values.reduce((total, value) => total + value, 0);
}

export function rollStartingPlayer(
  playerIds: readonly [PlayerId, PlayerId],
  rng: Rng,
): StartingRoll {
  const rounds: DiceRound[] = [];
  for (let i = 0; i < MAX_DICE_ROUNDS; i++) {
    const throws = [throwDice(rng), throwDice(rng)] as const;
    const totals = [sum(throws[0]), sum(throws[1])] as const;
    rounds.push({ throws, totals });
    if (totals[0] !== totals[1]) {
      return { rounds, firstPlayerId: totals[0] > totals[1] ? playerIds[0] : playerIds[1] };
    }
  }
  // Only reachable with a broken RNG; keeps the function total instead of looping forever.
  return { rounds, firstPlayerId: playerIds[0] };
}
