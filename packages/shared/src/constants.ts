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
