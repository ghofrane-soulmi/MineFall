/**
 * The game state machine: placement -> playing -> finished.
 * Each action validates its input and returns `{ ok, state, events }` or `{ ok: false, error }`;
 * the input state is never mutated, so a refused action changes nothing.
 */
import { BLOCKED_COLUMN_MOVES, COLS, MINES_PER_PLAYER } from '../constants';
import type { Board, Cell } from '../types/board';
import type {
  EngineErrorCode,
  EngineEvent,
  EngineResult,
  MinePlacementInput,
  MoveInput,
} from '../types/engine';
import type {
  ExplodedMine,
  GamePlayer,
  GameResult,
  GameState,
  MoveRecord,
  PlayerId,
  Rng,
} from '../types/game';
import { createEmptyBoard, getLandingRow, isValidColumnIndex, placeToken } from './board';
import { randomMineCells, sameCell, validateMinePlacement } from './mines';
import { findWinningLine } from './win';

// ---------------------------------------------------------------------------
// Creation & queries
// ---------------------------------------------------------------------------

/** Creates a game in the placement phase. `firstPlayerId` becomes Player 1 (red). */
export function createGame(firstPlayerId: PlayerId, secondPlayerId: PlayerId): GameState {
  if (firstPlayerId === secondPlayerId) throw new Error('createGame: player ids must differ');
  const players: [GamePlayer, GamePlayer] = [
    { id: firstPlayerId, color: 'red' },
    { id: secondPlayerId, color: 'yellow' },
  ];
  return {
    phase: 'placement',
    players,
    board: createEmptyBoard(),
    mines: { [firstPlayerId]: [], [secondPlayerId]: [] },
    minesConfirmed: { [firstPlayerId]: false, [secondPlayerId]: false },
    explodedMines: [],
    blockedColumns: {},
    currentPlayerId: null,
    turnId: 0,
    moveHistory: [],
    result: null,
  };
}

export function isPlayer(state: GameState, playerId: PlayerId): boolean {
  return state.players.some((p) => p.id === playerId);
}

export function getOpponentId(state: GameState, playerId: PlayerId): PlayerId {
  const [p1, p2] = state.players;
  return p1.id === playerId ? p2.id : p1.id;
}

export function isColumnBlocked(blocked: GameState['blockedColumns'], col: number): boolean {
  return (blocked[col] ?? 0) > 0;
}

/** Columns that are neither full nor blocked. */
export function getValidColumns(board: Board, blocked: GameState['blockedColumns']): number[] {
  const cols: number[] = [];
  for (let col = 0; col < COLS; col++) {
    if (getLandingRow(board, col) !== null && !isColumnBlocked(blocked, col)) cols.push(col);
  }
  return cols;
}

// ---------------------------------------------------------------------------
// Phase 1: mine placement
// ---------------------------------------------------------------------------

/** A player submits (and confirms) their mines. Play starts once both have confirmed. */
export function placeMines(state: GameState, input: MinePlacementInput): EngineResult {
  const { playerId, cells } = input;
  if (state.phase !== 'placement') return fail('WRONG_PHASE');
  if (!isPlayer(state, playerId)) return fail('UNKNOWN_PLAYER');
  if (state.minesConfirmed[playerId]) return fail('MINES_ALREADY_CONFIRMED');
  const invalid = validateMinePlacement(cells);
  if (invalid) return fail(invalid);

  const next: GameState = {
    ...state,
    mines: { ...state.mines, [playerId]: cells.map(copyCell) },
    minesConfirmed: { ...state.minesConfirmed, [playerId]: true },
  };
  const events: EngineEvent[] = [{ type: 'minesConfirmed', playerId }];

  if (state.players.every((p) => next.minesConfirmed[p.id])) {
    return startPlay(next, events);
  }
  return { ok: true, state: next, events };
}

/** Placement timer ended: random mines for players who did not confirm, then play starts. */
export function finishPlacement(state: GameState, rng: Rng): EngineResult {
  if (state.phase !== 'placement') return fail('WRONG_PHASE');

  let mines = state.mines;
  let confirmed = state.minesConfirmed;
  const events: EngineEvent[] = [];
  for (const { id } of state.players) {
    if (confirmed[id]) continue;
    mines = { ...mines, [id]: randomMineCells(rng, MINES_PER_PLAYER) };
    confirmed = { ...confirmed, [id]: true };
    events.push({ type: 'minesConfirmed', playerId: id });
  }
  return startPlay({ ...state, mines, minesConfirmed: confirmed }, events);
}

function startPlay(state: GameState, events: EngineEvent[]): EngineResult {
  const currentPlayerId = state.players[0].id;
  const turnId = state.turnId + 1;
  return {
    ok: true,
    state: { ...state, phase: 'playing', currentPlayerId, turnId },
    events: [...events, { type: 'playStarted', currentPlayerId, turnId }],
  };
}

// ---------------------------------------------------------------------------
// Phase 2: play
// ---------------------------------------------------------------------------

/** A player drops a token. Fully validated: phase, player, turn, turnId, column. */
export function applyMove(state: GameState, input: MoveInput): EngineResult {
  const { playerId, column, turnId } = input;
  if (state.phase !== 'playing') return fail('WRONG_PHASE');
  if (!isPlayer(state, playerId)) return fail('UNKNOWN_PLAYER');
  if (state.currentPlayerId !== playerId) return fail('NOT_YOUR_TURN');
  if (turnId !== state.turnId) return fail('STALE_TURN');
  if (!isValidColumnIndex(column)) return fail('INVALID_COLUMN');
  if (getLandingRow(state.board, column) === null) return fail('COLUMN_FULL');
  if (isColumnBlocked(state.blockedColumns, column)) return fail('COLUMN_BLOCKED');
  return resolveMove(state, playerId, column, false);
}

/** Turn timer ended: the server plays a random valid column for the current player. */
export function applyTimeoutMove(state: GameState, rng: Rng): EngineResult {
  if (state.phase !== 'playing' || state.currentPlayerId === null) return fail('WRONG_PHASE');
  const valid = getValidColumns(state.board, state.blockedColumns);
  const column = valid[Math.floor(rng() * valid.length)];
  // Unreachable while invariants hold: a turn with no valid column ends the game as a draw.
  if (column === undefined) return fail('INVALID_COLUMN');
  return resolveMove(state, state.currentPlayerId, column, true);
}

/** A player leaves or stays disconnected too long: the opponent wins. */
export function forfeit(state: GameState, loserId: PlayerId): EngineResult {
  if (state.phase === 'finished') return fail('WRONG_PHASE');
  if (!isPlayer(state, loserId)) return fail('UNKNOWN_PLAYER');
  return finish(state, { type: 'forfeit', winnerId: getOpponentId(state, loserId) }, []);
}

/** Applies an already-validated move: gravity, mines, blocked columns, win / draw. */
function resolveMove(
  state: GameState,
  playerId: PlayerId,
  column: number,
  timeout: boolean,
): EngineResult {
  const landedRow = getLandingRow(state.board, column) as number;
  const cell: Cell = { col: column, row: landedRow };
  const opponentId = getOpponentId(state, playerId);
  const moveNumber = state.moveHistory.length + 1;
  const hitsOpponentMine = (state.mines[opponentId] ?? []).some((m) => sameCell(m, cell));

  // Blocks from earlier explosions count down once per move, before any new block is added.
  let blockedColumns = tickBlockedColumns(state.blockedColumns);
  let board = state.board;
  let mines = state.mines;
  let explodedMine: ExplodedMine | null = null;
  const explodedMines = [...state.explodedMines];

  if (hitsOpponentMine) {
    // Token destroyed, cell stays empty, mine removed and revealed, column blocked.
    explodedMine = { ...cell, ownerId: opponentId, moveNumber };
    explodedMines.push(explodedMine);
    mines = { ...mines, [opponentId]: withoutCell(mines[opponentId], cell) };
    // PROVISIONAL (open question Q2): if the mover also mined this cell, that mine is cleared too.
    if ((mines[playerId] ?? []).some((m) => sameCell(m, cell))) {
      explodedMines.push({ ...cell, ownerId: playerId, moveNumber });
      mines = { ...mines, [playerId]: withoutCell(mines[playerId], cell) };
    }
    blockedColumns = { ...blockedColumns, [column]: BLOCKED_COLUMN_MOVES };
  } else {
    // Empty cell or the player's own mine: the token simply stays.
    const player = state.players.find((p) => p.id === playerId) as GamePlayer;
    board = placeToken(board, cell, player.color);
  }

  const move: MoveRecord = {
    moveNumber,
    playerId,
    column,
    landedRow,
    outcome: hitsOpponentMine ? 'exploded' : 'placed',
    timeout,
  };
  const next: GameState = {
    ...state,
    board,
    mines,
    explodedMines,
    blockedColumns,
    moveHistory: [...state.moveHistory, move],
  };

  const winningLine = hitsOpponentMine ? null : findWinningLine(board, cell);
  const nextHasMove = getValidColumns(board, blockedColumns).length > 0;
  const result: GameResult | null = winningLine
    ? { type: 'win', winnerId: playerId, winningLine }
    : nextHasMove
      ? null
      : { type: 'draw' }; // board full, or every free column blocked for the next player

  const turnId = state.turnId + 1;
  const moveEvent: EngineEvent = {
    type: 'moveApplied',
    move,
    explodedMine,
    blockedColumn: hitsOpponentMine ? column : null,
    nextPlayerId: result ? null : opponentId,
    turnId,
  };

  if (result) return finish({ ...next, turnId }, result, [moveEvent]);
  return {
    ok: true,
    state: { ...next, currentPlayerId: opponentId, turnId },
    events: [moveEvent],
  };
}

function finish(state: GameState, result: GameResult, events: EngineEvent[]): EngineResult {
  return {
    ok: true,
    state: { ...state, phase: 'finished', currentPlayerId: null, result },
    events: [...events, { type: 'gameOver', result }],
  };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function fail(error: EngineErrorCode): EngineResult {
  return { ok: false, error };
}

function tickBlockedColumns(blocked: GameState['blockedColumns']): Record<number, number> {
  const next: Record<number, number> = {};
  for (const [col, left] of Object.entries(blocked)) {
    if (left > 1) next[Number(col)] = left - 1;
  }
  return next;
}

function withoutCell(cells: readonly Cell[] | undefined, cell: Cell): Cell[] {
  return (cells ?? []).filter((c) => !sameCell(c, cell));
}

function copyCell(cell: Cell): Cell {
  return { col: cell.col, row: cell.row };
}
