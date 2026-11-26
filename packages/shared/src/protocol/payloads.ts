/**
 * Payload shapes exchanged over Socket.IO and HTTP. Plain data only (JSON-safe).
 * Anything game-related a client receives is built from `toPlayerView`, never from raw state.
 */
import type { StartingRoll } from '../engine/dice';
import type { Cell, Color } from '../types/board';
import type { EngineErrorCode } from '../types/engine';
import type {
  ExplodedMine,
  GamePhase,
  GameResult,
  MoveOutcome,
  OwnedMine,
  PlayerId,
} from '../types/game';
import type { PlayerView } from '../types/view';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface GuestIdentity {
  readonly id: PlayerId;
  readonly nickname: string;
}

/** POST /auth/guest request and response. */
export interface GuestLoginRequest {
  readonly nickname: string;
}
export interface GuestSession {
  readonly token: string;
  readonly player: GuestIdentity;
}

// ---------------------------------------------------------------------------
// Errors and acknowledgements
// ---------------------------------------------------------------------------

export type ProtocolErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_PAYLOAD'
  | 'INVALID_NICKNAME'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NOT_IN_ROOM'
  | 'ALREADY_IN_ROOM'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type AckErrorCode = ProtocolErrorCode | EngineErrorCode;

export type AckFailure = { readonly ok: false; readonly error: AckErrorCode };

/**
 * Every client -> server event is acknowledged with this shape (SPEC section 5).
 * `Ack` = `{ ok: true }`; `Ack<{ code: string }>` = `{ ok: true, data: { code } }`.
 */
export type Ack<T = undefined> =
  | ([T] extends [undefined] ? { readonly ok: true } : { readonly ok: true; readonly data: T })
  | AckFailure;

// ---------------------------------------------------------------------------
// Client -> server payloads
// ---------------------------------------------------------------------------

export type EmptyPayload = Record<string, never>;
export interface RoomJoinPayload {
  readonly code: string;
}
export interface RoomReadyPayload {
  readonly ready: boolean;
}
export interface MinesPlacePayload {
  readonly cells: readonly Cell[];
}
export interface MoveDropPayload {
  readonly column: number;
  readonly turnId: number;
}

export type ChatMessageType = 'preset' | 'emoji' | 'text';
/** `value` is a preset id, one of CHAT_EMOJIS, or free text (sanitised, max 120 chars). */
export interface ChatSendPayload {
  readonly type: ChatMessageType;
  readonly value: string;
}

// ---------------------------------------------------------------------------
// Server -> client payloads
// ---------------------------------------------------------------------------

/** The room lifecycle: a lobby, then the phases of the current game. */
export type RoomPhase = 'lobby' | GamePhase;

export interface RoomPlayerInfo {
  readonly id: PlayerId;
  readonly nickname: string;
  /** Null in the lobby, before the dice decide who is red. */
  readonly color: Color | null;
  readonly online: boolean;
  readonly ready: boolean;
  readonly wantsRematch: boolean;
}

export interface RoomSnapshot {
  readonly code: string;
  readonly hostId: PlayerId;
  readonly phase: RoomPhase;
  readonly players: readonly RoomPlayerInfo[];
  /** When the current placement phase or turn ends (epoch ms), for the countdown. */
  readonly phaseEndsAt: number | null;
  readonly startingRoll: StartingRoll | null;
  /** Disconnected players and when their grace period ends (epoch ms). */
  readonly disconnected: readonly PlayerConnectionPayload[];
}

/** Sent to ONE player on join / reconnect: the room plus that player's own view of the game. */
export interface RoomStatePayload {
  readonly room: RoomSnapshot;
  readonly game: PlayerView | null;
  /** Server clock (epoch ms) when sent: lets clients correct their own clock for countdowns. */
  readonly serverTime: number;
}

export interface RoomPlayersPayload {
  readonly hostId: PlayerId;
  readonly players: readonly RoomPlayerInfo[];
}

export interface PhaseChangedPayload {
  readonly phase: RoomPhase;
  readonly endsAt: number | null;
}

export interface MinesConfirmedPayload {
  readonly playerId: PlayerId;
}

export interface MoveResultPayload {
  readonly playerId: PlayerId;
  readonly column: number;
  readonly landedRow: number;
  readonly outcome: MoveOutcome;
  /** True when the server played for the player because their turn timer ran out. */
  readonly timeout: boolean;
  readonly explodedMine: ExplodedMine | null;
  readonly blockedColumn: number | null;
  /** All blocked columns after this move (column -> moves left), so clients never compute it. */
  readonly blockedColumns: Readonly<Record<number, number>>;
  readonly nextPlayerId: PlayerId | null;
  readonly turnEndsAt: number | null;
  readonly turnId: number;
}

export interface GameOverPayload {
  readonly result: GameResult;
  /** Every remaining mine of both players: revealed only now that the game is over. */
  readonly allMines: readonly OwnedMine[];
  readonly explodedMines: readonly ExplodedMine[];
  readonly durationMs: number;
  readonly moveCount: number;
}

export interface PlayerConnectionPayload {
  readonly playerId: PlayerId;
  /** Set while a game is running: the player forfeits if not back by then (epoch ms). */
  readonly graceEndsAt: number | null;
}

export interface ChatMessagePayload {
  readonly id: string;
  readonly playerId: PlayerId;
  readonly type: ChatMessageType;
  readonly value: string;
  readonly sentAt: number;
}

export interface ErrorPayload {
  readonly code: AckErrorCode;
  readonly message: string;
}
