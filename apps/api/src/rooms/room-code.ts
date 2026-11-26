import { randomInt } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@minefall/shared';

/** Picks an index in [0, max). Defaults to a cryptographically secure source. */
export type RandomIndex = (max: number) => number;

/** A random, non-sequential room code such as "K7QX2M" (SPEC section 6). */
export function generateRoomCode(randomIndex: RandomIndex = randomInt): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomIndex(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
