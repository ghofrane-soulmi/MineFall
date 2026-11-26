import {
  COLS,
  ROWS,
  type CellContent,
  type PlayerView,
  type RoomSnapshot,
  type RoomStatePayload,
} from '@minefall/shared';

export const ME = { id: 'me-id', nickname: 'Ghof' };
export const OPP = { id: 'opp-id', nickname: 'Neo' };

export function emptyBoard(): CellContent[][] {
  return Array.from({ length: ROWS }, () => Array<CellContent>(COLS).fill(null));
}

export function roomSnapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: 'K7QX2M',
    hostId: ME.id,
    phase: 'playing',
    players: [
      { ...ME, color: 'red', online: true, ready: false, wantsRematch: false, bot: null },
      { ...OPP, color: 'yellow', online: true, ready: false, wantsRematch: false, bot: null },
    ],
    phaseEndsAt: 1_000_000 + 20_000,
    startingRoll: null,
    disconnected: [],
    ...overrides,
  };
}

export function playerView(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    viewerId: ME.id,
    phase: 'playing',
    players: [
      { id: ME.id, color: 'red' },
      { id: OPP.id, color: 'yellow' },
    ],
    board: emptyBoard(),
    ownMines: [
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ],
    minesConfirmed: [
      { playerId: ME.id, confirmed: true },
      { playerId: OPP.id, confirmed: true },
    ],
    explodedMines: [],
    blockedColumns: {},
    currentPlayerId: ME.id,
    turnId: 1,
    moveHistory: [],
    result: null,
    revealedMines: null,
    ...overrides,
  };
}

export function roomState(
  game: PlayerView | null = playerView(),
  room: RoomSnapshot = roomSnapshot(),
): RoomStatePayload {
  return { room, game, serverTime: Date.now() };
}
