import type { Board, Cell, Color } from './board';

export type PlayerId = string;

/** Random number source in [0, 1). Injected so the engine stays deterministic in tests. */
export type Rng = () => number;

/** Engine phases. The room "lobby" phase lives in the server, before a game exists. */
export type GamePhase = 'placement' | 'playing' | 'finished';

export interface GamePlayer {
  readonly id: PlayerId;
  readonly color: Color;
}

/** A mine that exploded: removed from play but public to both players. */
export interface ExplodedMine extends Cell {
  readonly ownerId: PlayerId;
  readonly moveNumber: number;
}

/** A mine with its owner, used when all mines are revealed at the end. */
export interface OwnedMine extends Cell {
  readonly ownerId: PlayerId;
}

export type MoveOutcome = 'placed' | 'exploded';

export interface MoveRecord {
  readonly moveNumber: number;
  readonly playerId: PlayerId;
  readonly column: number;
  readonly landedRow: number;
  readonly outcome: MoveOutcome;
  /** True when the server played this move because the turn timer ran out. */
  readonly timeout: boolean;
}

export type GameResult =
  | { readonly type: 'win'; readonly winnerId: PlayerId; readonly winningLine: readonly Cell[] }
  | { readonly type: 'draw' }
  | { readonly type: 'forfeit'; readonly winnerId: PlayerId };

/**
 * Full authoritative game state. Lives only on the server.
 * NEVER send it to a client as-is: use `toPlayerView(state, playerId)`.
 */
export interface GameState {
  readonly phase: GamePhase;
  /** players[0] is Player 1 (red) and moves first. */
  readonly players: readonly [GamePlayer, GamePlayer];
  readonly board: Board;
  /** Unexploded mines per player. SECRET: each player may only see their own. */
  readonly mines: Readonly<Record<PlayerId, readonly Cell[]>>;
  readonly minesConfirmed: Readonly<Record<PlayerId, boolean>>;
  readonly explodedMines: readonly ExplodedMine[];
  /** Column index -> number of upcoming moves during which it cannot be played. */
  readonly blockedColumns: Readonly<Record<number, number>>;
  readonly currentPlayerId: PlayerId | null;
  /** Increments after every move; clients echo it back to reject stale/double clicks. */
  readonly turnId: number;
  readonly moveHistory: readonly MoveRecord[];
  readonly result: GameResult | null;
}
