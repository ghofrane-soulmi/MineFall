import type { Cell } from './board';
import type { ExplodedMine, GameResult, GameState, MoveRecord, PlayerId } from './game';

/** Why the engine refused an action. Sent back to clients as the ack error code. */
export type EngineErrorCode =
  | 'UNKNOWN_PLAYER'
  | 'WRONG_PHASE'
  | 'MINES_ALREADY_CONFIRMED'
  | 'INVALID_MINE_COUNT'
  | 'DUPLICATE_MINE'
  | 'MINE_OUT_OF_BOUNDS'
  | 'MINE_ON_TOP_ROW'
  | 'NOT_YOUR_TURN'
  | 'STALE_TURN'
  | 'INVALID_COLUMN'
  | 'COLUMN_FULL'
  | 'COLUMN_BLOCKED';

/** Things that happened during an action, for the gateway to broadcast. */
export type EngineEvent =
  | { readonly type: 'minesConfirmed'; readonly playerId: PlayerId }
  | { readonly type: 'playStarted'; readonly currentPlayerId: PlayerId; readonly turnId: number }
  | {
      readonly type: 'moveApplied';
      readonly move: MoveRecord;
      readonly explodedMine: ExplodedMine | null;
      readonly blockedColumn: number | null;
      readonly nextPlayerId: PlayerId | null;
      readonly turnId: number;
    }
  | { readonly type: 'gameOver'; readonly result: GameResult };

/** Every engine action returns either the new state + events, or an error and no change. */
export type EngineResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly EngineEvent[] }
  | { readonly ok: false; readonly error: EngineErrorCode };

export interface MoveInput {
  readonly playerId: PlayerId;
  readonly column: number;
  readonly turnId: number;
}

export interface MinePlacementInput {
  readonly playerId: PlayerId;
  readonly cells: readonly Cell[];
}
