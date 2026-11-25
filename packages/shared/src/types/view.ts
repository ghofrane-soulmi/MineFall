import type { Board, Cell } from './board';
import type {
  ExplodedMine,
  GamePhase,
  GamePlayer,
  GameResult,
  MoveRecord,
  OwnedMine,
  PlayerId,
} from './game';

/**
 * The game as seen by one player. Safe to send over the network.
 * Note: there is deliberately NO field holding the opponent's unexploded mines.
 */
export interface PlayerView {
  readonly viewerId: PlayerId;
  readonly phase: GamePhase;
  readonly players: readonly GamePlayer[];
  readonly board: Board;
  /** The viewer's own unexploded mines. */
  readonly ownMines: readonly Cell[];
  /** Who has confirmed their mines (never where they are). */
  readonly minesConfirmed: readonly { readonly playerId: PlayerId; readonly confirmed: boolean }[];
  readonly explodedMines: readonly ExplodedMine[];
  readonly blockedColumns: Readonly<Record<number, number>>;
  readonly currentPlayerId: PlayerId | null;
  readonly turnId: number;
  readonly moveHistory: readonly MoveRecord[];
  readonly result: GameResult | null;
  /** All remaining mines of both players, only once the phase is 'finished'. */
  readonly revealedMines: readonly OwnedMine[] | null;
}
