import type { AckErrorCode } from '@minefall/shared';

/** Client-only failure: the server did not answer in time. */
export type ClientErrorCode = AckErrorCode | 'TIMEOUT';

/** Player-facing messages. A Record forces a message for every code the server can send. */
const MESSAGES: Record<ClientErrorCode, string> = {
  UNAUTHORIZED: 'Your session expired. Please choose a nickname again.',
  INVALID_PAYLOAD: 'That action was not understood.',
  INVALID_NICKNAME: 'Nicknames are 3–16 letters, digits, spaces, "_" or "-".',
  ROOM_NOT_FOUND: 'This room does not exist (or it expired).',
  ROOM_FULL: 'This room already has two players.',
  NOT_IN_ROOM: 'You are not in this room anymore.',
  ALREADY_IN_ROOM: 'You are already in another room.',
  RATE_LIMITED: 'Easy! One message per second.',
  INTERNAL_ERROR: 'Something went wrong on the server.',
  TIMEOUT: 'The server did not answer. Check your connection.',
  UNKNOWN_PLAYER: 'You are not a player in this game.',
  WRONG_PHASE: 'Not possible right now.',
  MINES_ALREADY_CONFIRMED: 'Your mines are already locked in.',
  INVALID_MINE_COUNT: 'Pick exactly 2 cells for your mines.',
  DUPLICATE_MINE: 'Your 2 mines must be on different cells.',
  MINE_OUT_OF_BOUNDS: 'That cell is outside the board.',
  MINE_ON_TOP_ROW: 'Mines cannot go on the top row.',
  NOT_YOUR_TURN: 'Wait for your turn.',
  STALE_TURN: 'Too late: the turn already changed.',
  INVALID_COLUMN: 'That column does not exist.',
  COLUMN_FULL: 'This column is full.',
  COLUMN_BLOCKED: 'This column is blocked after an explosion.',
};

export function errorMessage(code: ClientErrorCode): string {
  return MESSAGES[code];
}
