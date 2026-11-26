/**
 * "Send this event to player X / to room Y". GameService depends on the abstract class only;
 * SocketGameNotifier implements it with Socket.IO channels:
 *   player:<id>  - every socket (tab) of one player
 *   room:<code>  - every socket of every player in a room
 */
import { Injectable } from '@nestjs/common';
import type {
  ClientToServerEvents,
  GuestIdentity,
  PlayerId,
  ServerPayload,
  ServerToClientEvents,
} from '@minefall/shared';
import type { Namespace, Socket } from 'socket.io';

type ServerEvent = keyof ServerToClientEvents;

export interface SocketData {
  player: GuestIdentity;
}
export type GameNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
export type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export const playerChannel = (playerId: PlayerId): string => `player:${playerId}`;
export const roomChannel = (code: string): string => `room:${code}`;

export abstract class GameNotifier {
  abstract toPlayer<E extends ServerEvent>(
    playerId: PlayerId,
    event: E,
    payload: ServerPayload<E>,
  ): void;
  abstract toRoom<E extends ServerEvent>(code: string, event: E, payload: ServerPayload<E>): void;
  /** Subscribes all of a player's sockets to a room's broadcasts. */
  abstract joinRoom(playerId: PlayerId, code: string): void;
  abstract leaveRoom(playerId: PlayerId, code: string): void;
}

@Injectable()
export class SocketGameNotifier extends GameNotifier {
  private server: GameNamespace | null = null;

  /** Called by the gateway once Socket.IO is ready. */
  attach(server: GameNamespace): void {
    this.server = server;
  }

  toPlayer<E extends ServerEvent>(playerId: PlayerId, event: E, payload: ServerPayload<E>): void {
    this.emit(playerChannel(playerId), event, payload);
  }

  toRoom<E extends ServerEvent>(code: string, event: E, payload: ServerPayload<E>): void {
    this.emit(roomChannel(code), event, payload);
  }

  joinRoom(playerId: PlayerId, code: string): void {
    this.server?.in(playerChannel(playerId)).socketsJoin(roomChannel(code));
  }

  leaveRoom(playerId: PlayerId, code: string): void {
    this.server?.in(playerChannel(playerId)).socketsLeave(roomChannel(code));
  }

  private emit<E extends ServerEvent>(channel: string, event: E, payload: ServerPayload<E>): void {
    // Socket.IO's emit typing cannot follow a generic event name, hence the narrow cast.
    const emitter = this.server?.to(channel) as
      { emit: (event: E, payload: ServerPayload<E>) => boolean } | undefined;
    emitter?.emit(event, payload);
  }
}
