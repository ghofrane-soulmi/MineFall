/**
 * Pure functions that fold server events into the client's copy of the game.
 * They COPY what the server decided (landing row, outcome, blocked columns, next player);
 * they never compute a rule. If anything looks off, the next room:state replaces it all.
 */
import type {
  CellContent,
  Color,
  GameOverPayload,
  MoveResultPayload,
  PlayerId,
  PlayerView,
} from '@minefall/shared';

export function applyMoveResult(view: PlayerView, move: MoveResultPayload): PlayerView {
  const color = view.players.find((p) => p.id === move.playerId)?.color;
  const board =
    move.outcome === 'placed' && color
      ? placeOnBoard(view.board, move.column, move.landedRow, color)
      : view.board;

  return {
    ...view,
    board,
    explodedMines: move.explodedMine
      ? [...view.explodedMines, move.explodedMine]
      : view.explodedMines,
    // If one of MY mines exploded, it is no longer an active "own mine".
    ownMines: move.explodedMine
      ? view.ownMines.filter(
          (m) => !(m.col === move.explodedMine?.col && m.row === move.explodedMine.row),
        )
      : view.ownMines,
    blockedColumns: move.blockedColumns,
    currentPlayerId: move.nextPlayerId,
    turnId: move.turnId,
    moveHistory: [
      ...view.moveHistory,
      {
        moveNumber: view.moveHistory.length + 1,
        playerId: move.playerId,
        column: move.column,
        landedRow: move.landedRow,
        outcome: move.outcome,
        timeout: move.timeout,
      },
    ],
  };
}

export function applyGameOver(view: PlayerView, over: GameOverPayload): PlayerView {
  return {
    ...view,
    phase: 'finished',
    result: over.result,
    currentPlayerId: null,
    revealedMines: over.allMines,
    explodedMines: over.explodedMines,
  };
}

export function applyMinesConfirmed(view: PlayerView, playerId: PlayerId): PlayerView {
  return {
    ...view,
    minesConfirmed: view.minesConfirmed.map((m) =>
      m.playerId === playerId ? { ...m, confirmed: true } : m,
    ),
  };
}

function placeOnBoard(
  board: PlayerView['board'],
  col: number,
  row: number,
  color: Color,
): PlayerView['board'] {
  return board.map((cells, r) =>
    r === row ? cells.map((c, i): CellContent => (i === col ? color : c)) : cells,
  );
}
