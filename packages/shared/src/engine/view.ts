/**
 * Builds what ONE player is allowed to see. This is the only way game state leaves the
 * server: own mines included, opponent's unexploded mines removed until the game ends.
 * Fields are copied one by one (allow-list) so a new secret field can never leak by accident.
 */
import type { Cell } from '../types/board';
import type { GameState, OwnedMine, PlayerId } from '../types/game';
import type { PlayerView } from '../types/view';

export function toPlayerView(state: GameState, viewerId: PlayerId): PlayerView {
  return {
    viewerId,
    phase: state.phase,
    players: state.players.map((p) => ({ id: p.id, color: p.color })),
    board: state.board.map((row) => [...row]),
    ownMines: (state.mines[viewerId] ?? []).map(copyCell),
    minesConfirmed: state.players.map((p) => ({
      playerId: p.id,
      confirmed: state.minesConfirmed[p.id] ?? false,
    })),
    explodedMines: state.explodedMines.map((m) => ({ ...m })),
    blockedColumns: { ...state.blockedColumns },
    currentPlayerId: state.currentPlayerId,
    turnId: state.turnId,
    moveHistory: state.moveHistory.map((m) => ({ ...m })),
    result: state.result,
    // Every remaining mine is revealed to both players only once the game is over.
    revealedMines: state.phase === 'finished' ? allRemainingMines(state) : null,
  };
}

export function allRemainingMines(state: GameState): OwnedMine[] {
  return state.players.flatMap((p) =>
    (state.mines[p.id] ?? []).map((m) => ({ ownerId: p.id, col: m.col, row: m.row })),
  );
}

function copyCell(cell: Cell): Cell {
  return { col: cell.col, row: cell.row };
}
