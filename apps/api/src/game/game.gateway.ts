/**
 * NestJS concept: a @WebSocketGateway is the Socket.IO equivalent of a controller.
 * Each @SubscribeMessage(event) method handles one client event; its return value is sent
 * back as the acknowledgement. This class stays thin: authenticate, validate, delegate.
 */
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import {
  ClientEvents,
  SOCKET_NAMESPACE,
  parseMinesPlace,
  parseMoveDrop,
  parseRoomJoin,
  parseRoomReady,
  type Ack,
  type AckFailure,
  type GuestIdentity,
  type PlayerId,
} from '@minefall/shared';
import { AuthService } from '../auth/auth.service';
import {
  SocketGameNotifier,
  playerChannel,
  type GameNamespace,
  type GameSocket,
} from './game-notifier';
import { GameService } from './game.service';

const INVALID_PAYLOAD: AckFailure = { ok: false, error: 'INVALID_PAYLOAD' };

@WebSocketGateway({ namespace: SOCKET_NAMESPACE })
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);
  /** Open sockets per player: a player is "offline" only when their last tab closes. */
  private readonly socketCount = new Map<PlayerId, number>();

  constructor(
    private readonly auth: AuthService,
    private readonly game: GameService,
    private readonly notifier: SocketGameNotifier,
  ) {}

  /** Runs once Socket.IO is ready. The middleware rejects any socket without a valid token. */
  afterInit(server: GameNamespace): void {
    this.notifier.attach(server);
    server.use((socket, next) => {
      const token: unknown = socket.handshake.auth['token'];
      const player = this.auth.verify(token);
      if (!player) return next(new Error('UNAUTHORIZED'));
      socket.data.player = player;
      next();
    });
  }

  async handleConnection(socket: GameSocket): Promise<void> {
    const { player } = socket.data;
    await socket.join(playerChannel(player.id));
    this.socketCount.set(player.id, (this.socketCount.get(player.id) ?? 0) + 1);
    this.game.playerConnected(player);
  }

  handleDisconnect(socket: GameSocket): void {
    const player = socket.data.player as GuestIdentity | undefined;
    if (!player) return; // rejected by the auth middleware
    const remaining = (this.socketCount.get(player.id) ?? 1) - 1;
    if (remaining > 0) {
      this.socketCount.set(player.id, remaining);
      return;
    }
    this.socketCount.delete(player.id);
    this.game.playerDisconnected(player.id);
  }

  @SubscribeMessage(ClientEvents.RoomCreate)
  createRoom(@ConnectedSocket() socket: GameSocket): Ack<{ code: string }> {
    return this.safely(() => this.game.createRoom(socket.data.player));
  }

  @SubscribeMessage(ClientEvents.RoomJoin)
  joinRoom(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Ack {
    const payload = parseRoomJoin(body);
    if (!payload) return INVALID_PAYLOAD;
    return this.safely(() => this.game.joinRoom(socket.data.player, payload.code));
  }

  @SubscribeMessage(ClientEvents.RoomReady)
  setReady(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Ack {
    const payload = parseRoomReady(body);
    if (!payload) return INVALID_PAYLOAD;
    return this.safely(() => this.game.setReady(socket.data.player.id, payload.ready));
  }

  @SubscribeMessage(ClientEvents.RoomLeave)
  leaveRoom(@ConnectedSocket() socket: GameSocket): Ack {
    return this.safely(() => this.game.leaveRoom(socket.data.player.id));
  }

  @SubscribeMessage(ClientEvents.MinesPlace)
  placeMines(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Ack {
    const payload = parseMinesPlace(body);
    if (!payload) return INVALID_PAYLOAD;
    return this.safely(() => this.game.placeMines(socket.data.player.id, payload));
  }

  @SubscribeMessage(ClientEvents.MoveDrop)
  dropToken(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Ack {
    const payload = parseMoveDrop(body);
    if (!payload) return INVALID_PAYLOAD;
    return this.safely(() => this.game.dropToken(socket.data.player.id, payload));
  }

  @SubscribeMessage(ClientEvents.GameRematch)
  requestRematch(@ConnectedSocket() socket: GameSocket): Ack {
    return this.safely(() => this.game.requestRematch(socket.data.player.id));
  }

  /** An unexpected error must still answer the client, never leave its ack hanging. */
  private safely<T>(action: () => Ack<T>): Ack<T> {
    try {
      return action();
    } catch (error) {
      this.logger.error(error);
      return { ok: false, error: 'INTERNAL_ERROR' };
    }
  }
}
