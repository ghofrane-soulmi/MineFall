/** Board size. Row 0 is the TOP row; tokens fall towards row ROWS - 1. */
export const COLS = 7;
export const ROWS = 6;

/** Number of aligned tokens needed to win. */
export const WIN_LENGTH = 4;

/** Mines each player hides during the placement phase. Never on the top row (row 0). */
export const MINES_PER_PLAYER = 2;

/** Moves during which a column stays blocked after an explosion (decided: 1). */
export const BLOCKED_COLUMN_MOVES = 1;

/** Phase durations in milliseconds. Timers run on the server, never in the engine. */
export const PLACEMENT_DURATION_MS = 30_000;
export const TURN_DURATION_MS = 20_000;

/** Starting-player dice roll: two six-sided dice per player, highest total starts, ties re-roll. */
export const DIE_FACES = 6;
export const DICE_PER_PLAYER = 2;
export const MAX_DICE_ROUNDS = 50;

/** Disconnected players have this long to come back before forfeiting (SPEC F11). */
export const DISCONNECT_GRACE_MS = 60_000;

/** Rooms with no activity for this long are removed from memory (SPEC section 8). */
export const ROOM_IDLE_TIMEOUT_MS = 30 * 60_000;

/** Guest nicknames (SPEC F1). */
export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 16;

/** Room codes: 6 characters, without look-alikes (0/O, 1/I/L) so they are easy to read aloud. */
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
