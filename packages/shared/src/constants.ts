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

/** Quick chat (SPEC F9). Presets are sent by id; the client shows the text. */
export const CHAT_PRESETS = [
  { id: 'gg', text: 'GG' },
  { id: 'nice', text: 'Nice move!' },
  { id: 'oops', text: 'Oops' },
  { id: 'good-luck', text: 'Good luck' },
  { id: 'hurry', text: 'Hurry up!' },
  { id: 'rematch', text: 'Rematch?' },
] as const;
export const CHAT_EMOJIS = ['👍', '😂', '😮', '😢', '🔥', '💣'] as const;
export const CHAT_MAX_LENGTH = 120;
/** One chat message per second per player. */
export const CHAT_MIN_INTERVAL_MS = 1_000;

/** Spectator mode (F18): people who may watch one room at the same time. */
export const MAX_SPECTATORS = 20;

/** Quick match (F14): after this long without an opponent, the client offers Minebot. */
export const QUICK_MATCH_BOT_OFFER_MS = 30_000;
