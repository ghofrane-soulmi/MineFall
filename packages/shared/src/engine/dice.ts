/**
 * Starting-player dice roll: each player rolls one die, the highest roll starts (Player 1,
 * red). Ties re-roll. All rounds are returned so the client can animate them.
 */
import { DIE_FACES, MAX_DICE_ROUNDS } from '../constants';
import type { PlayerId, Rng } from '../types/game';

export interface DiceRound {
  readonly rolls: readonly [number, number];
}

export interface StartingRoll {
  readonly rounds: readonly DiceRound[];
  readonly firstPlayerId: PlayerId;
}

export function rollDie(rng: Rng): number {
  return Math.floor(rng() * DIE_FACES) + 1;
}

export function rollStartingPlayer(
  playerIds: readonly [PlayerId, PlayerId],
  rng: Rng,
): StartingRoll {
  const rounds: DiceRound[] = [];
  for (let i = 0; i < MAX_DICE_ROUNDS; i++) {
    const rolls = [rollDie(rng), rollDie(rng)] as const;
    rounds.push({ rolls });
    if (rolls[0] !== rolls[1]) {
      return { rounds, firstPlayerId: rolls[0] > rolls[1] ? playerIds[0] : playerIds[1] };
    }
  }
  // Only reachable with a broken RNG; keeps the function total instead of looping forever.
  return { rounds, firstPlayerId: playerIds[0] };
}
