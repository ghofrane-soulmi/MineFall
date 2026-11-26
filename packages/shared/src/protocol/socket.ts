/**
 * Typed Socket.IO event maps. Socket.IO uses these to type-check `emit` and `on` on both
 * sides: `Server<ClientToServerEvents, ServerToClientEvents>` / `Socket<ServerToClientEvents,
 * ClientToServerEvents>`. Keys come from the event constants, so names are never retyped.
 */
import type { StartingRoll } from '../engine/dice';
import type { ClientEvents, ServerEvents } from '../events';
import type {
  Ack,
  ChatMessagePayload,
  ChatSendPayload,
  EmptyPayload,
  RoomCreatePayload,
  ErrorPayload,
  GameOverPayload,
  MinesConfirmedPayload,
  MinesPlacePayload,
  MoveDropPayload,
  MoveResultPayload,
  PhaseChangedPayload,
  PlayerConnectionPayload,
  QueueMatchedPayload,
  RoomJoinPayload,
  RoomPlayersPayload,
  RoomReadyPayload,
  RoomStatePayload,
} from './payloads';

type AckCallback<T = undefined> = (response: Ack<T>) => void;

export interface ClientToServerEvents {
  [ClientEvents.RoomCreate]: (
    payload: RoomCreatePayload,
    ack: AckCallback<{ code: string }>,
  ) => void;
  [ClientEvents.RoomJoin]: (payload: RoomJoinPayload, ack: AckCallback) => void;
  /** Watch a room as a spectator (same payload as joining). */
  [ClientEvents.RoomWatch]: (payload: RoomJoinPayload, ack: AckCallback) => void;
  [ClientEvents.RoomReady]: (payload: RoomReadyPayload, ack: AckCallback) => void;
  [ClientEvents.RoomLeave]: (payload: EmptyPayload, ack: AckCallback) => void;
  [ClientEvents.MinesPlace]: (payload: MinesPlacePayload, ack: AckCallback) => void;
  [ClientEvents.MoveDrop]: (payload: MoveDropPayload, ack: AckCallback) => void;
  [ClientEvents.GameRematch]: (payload: EmptyPayload, ack: AckCallback) => void;
  [ClientEvents.QueueJoin]: (payload: EmptyPayload, ack: AckCallback) => void;
  [ClientEvents.QueueLeave]: (payload: EmptyPayload, ack: AckCallback) => void;
  [ClientEvents.ChatSend]: (payload: ChatSendPayload, ack: AckCallback) => void;
}

export interface ServerToClientEvents {
  [ServerEvents.RoomState]: (payload: RoomStatePayload) => void;
  [ServerEvents.RoomPlayers]: (payload: RoomPlayersPayload) => void;
  [ServerEvents.PhaseChanged]: (payload: PhaseChangedPayload) => void;
  [ServerEvents.DiceRolled]: (payload: StartingRoll) => void;
  [ServerEvents.QueueMatched]: (payload: QueueMatchedPayload) => void;
  [ServerEvents.MinesConfirmed]: (payload: MinesConfirmedPayload) => void;
  [ServerEvents.MoveResult]: (payload: MoveResultPayload) => void;
  [ServerEvents.GameOver]: (payload: GameOverPayload) => void;
  [ServerEvents.ChatMessage]: (payload: ChatMessagePayload) => void;
  [ServerEvents.PlayerDisconnected]: (payload: PlayerConnectionPayload) => void;
  [ServerEvents.PlayerReconnected]: (payload: PlayerConnectionPayload) => void;
  [ServerEvents.Error]: (payload: ErrorPayload) => void;
}

/** The payload type of a server -> client event. */
export type ServerPayload<E extends keyof ServerToClientEvents> = Parameters<
  ServerToClientEvents[E]
>[0];
