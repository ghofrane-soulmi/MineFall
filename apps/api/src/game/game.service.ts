/**
 * Orchestrates a room's life: lobby -> dice -> placement -> playing -> finished -> rematch.
 * It is the only caller of the pure engine. For every engine result it updates the room,
 * (re)starts server timers and emits events. Game state leaves only via `toPlayerView`.
 */
import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  CHAT_MIN_INTERVAL_MS,
  ServerEvents,
  allRemainingMines,
  applyMove,
  chooseBotColumn,
  chooseBotMines,
  applyTimeoutMove,
  createGame,
  finishPlacement,
  forfeit,
  placeMines,
  rollStartingPlayer,
  toPlayerView,
  type Ack,
  type AckErrorCode,
  type AckFailure,
  type BotLevel,
  type ChatSendPayload,
  type EngineEvent,
  type EngineResult,
  type GameResult,
  type GuestIdentity,
  type MinesPlacePayload,
  type MoveDropPayload,
  type PlayerId,
  type Rng,
} from '@minefall/shared';
import { APP_CONFIG, CLOCK, RNG, type AppConfig, type Clock } from '../config/app-config';
import { GameRecorder, toFinishedGameRecord } from '../persistence/game-recorder';
import {
  findBot,
  findMember,
  isGameRunning,
  roomPhase,
  toRoomPlayersPayload,
  toRoomSnapshot,
  type Room,
  type RoomMember,
} from '../rooms/room';
import { RoomsService } from '../rooms/rooms.service';
import { GameNotifier } from './game-notifier';
import { Scheduler } from './scheduler';

const OK = { ok: true } as const;
const fail = (error: AckErrorCode): AckFailure => ({ ok: false, error });

const phaseTimerKey = (code: string): string => `${code}:phase`;
const botTimerKey = (code: string): string => `${code}:bot`;
const graceTimerKey = (code: string, playerId: PlayerId): string => `${code}:grace:${playerId}`;

@Injectable()
export class GameService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameService.name);
  private cleanupInterval: NodeJS.Timeout | null = null;
  /** Last chat message time per player, for the 1 message / second limit. */
  private readonly lastChatAt = new Map<PlayerId, number>();

  constructor(
    private readonly rooms: RoomsService,
    private readonly scheduler: Scheduler,
    private readonly notifier: GameNotifier,
    private readonly recorder: GameRecorder,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly now: Clock,
    @Inject(RNG) private readonly rng: Rng,
  ) {}

  onModuleInit(): void {
    this.cleanupInterval = setInterval(
      () => this.cleanupIdleRooms(),
      this.config.timings.cleanupIntervalMs,
    );
    this.cleanupInterval.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle (called by the gateway)
  // -------------------------------------------------------------------------

  /** A socket of `player` connected: re-attach to their room and resend the full state. */
  playerConnected(player: GuestIdentity): void {
    const room = this.rooms.findByPlayer(player.id);
    const member = room && findMember(room, player.id);
    if (!room || !member) return;

    this.notifier.joinRoom(player.id, room.code);
    if (!member.online) {
      member.online = true;
      room.graceEndsAt.delete(player.id);
      this.scheduler.cancel(graceTimerKey(room.code, player.id));
      this.notifier.toRoom(room.code, ServerEvents.PlayerReconnected, {
        playerId: player.id,
        graceEndsAt: null,
      });
      this.broadcastPlayers(room);
    }
    this.sendRoomState(room, player.id);
  }

  /** The LAST socket of a player closed. During a game they get a grace period, then forfeit. */
  playerDisconnected(playerId: PlayerId): void {
    const room = this.rooms.findByPlayer(playerId);
    const member = room && findMember(room, playerId);
    if (!room || !member) return;

    member.online = false;
    let graceEndsAt: number | null = null;
    if (isGameRunning(room)) {
      const graceMs = this.config.timings.disconnectGraceMs;
      graceEndsAt = this.now() + graceMs;
      room.graceEndsAt.set(playerId, graceEndsAt);
      this.scheduler.schedule(graceTimerKey(room.code, playerId), graceMs, () =>
        this.onGraceExpired(room.code, playerId),
      );
    }
    this.notifier.toRoom(room.code, ServerEvents.PlayerDisconnected, { playerId, graceEndsAt });
    this.broadcastPlayers(room);
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------

  /** Creates a room. With `bot`, Minebot joins as the second player and the game starts. */
  createRoom(player: GuestIdentity, bot?: BotLevel): Ack<{ code: string }> {
    if (this.rooms.findByPlayer(player.id)) return fail('ALREADY_IN_ROOM');
    const room = this.rooms.create(player, this.now());
    this.notifier.joinRoom(player.id, room.code);
    if (bot) {
      this.rooms.addBot(room, bot, this.now());
      this.startGame(room, null);
      this.sendBotChat(room, 'good-luck');
    } else {
      this.sendRoomState(room, player.id);
    }
    return { ok: true, data: { code: room.code } };
  }

  joinRoom(player: GuestIdentity, code: string): Ack {
    const current = this.rooms.findByPlayer(player.id);
    if (current) {
      if (current.code !== code) return fail('ALREADY_IN_ROOM');
      this.sendRoomState(current, player.id); // joining your own room again is harmless
      return OK;
    }
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND');
    const error = this.rooms.addMember(room, player, this.now());
    if (error) return fail(error);

    this.notifier.joinRoom(player.id, room.code);
    this.broadcastPlayers(room);
    this.sendRoomState(room, player.id);
    return OK;
  }

  setReady(playerId: PlayerId, ready: boolean): Ack {
    const found = this.requireMember(playerId);
    if (!found.ok) return found;
    const { room, member } = found;
    if (roomPhase(room) !== 'lobby') return fail('WRONG_PHASE');

    member.ready = ready;
    this.touch(room);
    this.broadcastPlayers(room);
    if (room.members.length === 2 && room.members.every((m) => m.ready)) {
      this.startGame(room, null);
    }
    return OK;
  }

  /** Leaving during a game is a forfeit (SPEC F12). The other player goes back to the lobby. */
  leaveRoom(playerId: PlayerId): Ack {
    const found = this.requireMember(playerId);
    if (!found.ok) return found;
    const { room } = found;

    if (room.game && isGameRunning(room)) this.applyEngine(room, forfeit(room.game, playerId));
    this.scheduler.cancel(graceTimerKey(room.code, playerId));
    this.notifier.leaveRoom(playerId, room.code);
    this.rooms.removeMember(room, playerId);
    this.lastChatAt.delete(playerId);

    if (room.members.every((m) => m.bot !== null)) {
      // Only Minebot is left (or nobody): the room has no reason to exist.
      this.scheduler.cancelByPrefix(`${room.code}:`);
      this.rooms.delete(room);
      return OK;
    }
    this.resetToLobby(room);
    this.broadcastPlayers(room);
    this.notifier.toRoom(room.code, ServerEvents.PhaseChanged, { phase: 'lobby', endsAt: null });
    return OK;
  }

  /** Both players ask for a rematch -> new game, starting player swapped (SPEC F10). */
  requestRematch(playerId: PlayerId): Ack {
    const found = this.requireMember(playerId);
    if (!found.ok) return found;
    const { room, member } = found;
    if (roomPhase(room) !== 'finished' || !room.game) return fail('WRONG_PHASE');

    member.wantsRematch = true;
    this.touch(room);
    this.broadcastPlayers(room);
    if (room.members.length === 2 && room.members.every((m) => m.wantsRematch)) {
      this.startGame(room, room.game.players[1].id);
    }
    return OK;
  }

  // -------------------------------------------------------------------------
  // Game actions
  // -------------------------------------------------------------------------

  placeMines(playerId: PlayerId, payload: MinesPlacePayload): Ack {
    const found = this.requireMember(playerId);
    if (!found.ok) return found;
    const { room } = found;
    if (!room.game) return fail('WRONG_PHASE');
    return this.applyEngine(room, placeMines(room.game, { playerId, cells: payload.cells }));
  }

  dropToken(playerId: PlayerId, payload: MoveDropPayload): Ack {
    const found = this.requireMember(playerId);
    if (!found.ok) return found;
    const { room } = found;
    if (!room.game) return fail('WRONG_PHASE');
    return this.applyEngine(room, applyMove(room.game, { playerId, ...payload }));
  }

  // -------------------------------------------------------------------------
  // Chat
  // -------------------------------------------------------------------------

  /** Broadcasts an already-validated chat message to the room, max 1 per second per player. */
  sendChat(playerId: PlayerId, payload: ChatSendPayload): Ack {
    const found = this.requireMember(playerId);
    if (!found.ok) return found;
    const { room } = found;
    const now = this.now();
    const last = this.lastChatAt.get(playerId);
    if (last !== undefined && now - last < CHAT_MIN_INTERVAL_MS) return fail('RATE_LIMITED');

    this.lastChatAt.set(playerId, now);
    this.touch(room);
    this.notifier.toRoom(room.code, ServerEvents.ChatMessage, {
      id: randomUUID(),
      playerId,
      type: payload.type,
      value: payload.value,
      sentAt: now,
    });
    return OK;
  }

  /** Removes rooms with no activity for `roomIdleMs` (SPEC section 8: 30 min). */
  cleanupIdleRooms(): number {
    const limit = this.now() - this.config.timings.roomIdleMs;
    const idle = this.rooms.all().filter((room) => room.lastActivityAt < limit);
    for (const room of idle) {
      for (const member of room.members) {
        this.notifier.leaveRoom(member.id, room.code);
        this.lastChatAt.delete(member.id);
      }
      this.scheduler.cancelByPrefix(`${room.code}:`);
      this.rooms.delete(room);
    }
    return idle.length;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Starts a game. `firstPlayerId` null = decide with the dice roll. */
  private startGame(room: Room, firstPlayerId: PlayerId | null): void {
    const [a, b] = room.members as [RoomMember, RoomMember];
    let first = firstPlayerId;
    room.startingRoll = null;
    if (first === null) {
      const roll = rollStartingPlayer([a.id, b.id], this.rng);
      room.startingRoll = roll;
      first = roll.firstPlayerId;
      this.notifier.toRoom(room.code, ServerEvents.DiceRolled, roll);
    }
    const second = first === a.id ? b.id : a.id;

    const { placementMs } = this.config.timings;
    room.game = createGame(first, second);
    room.gameStartedAt = this.now();
    room.moveTimes = [];
    room.phaseEndsAt = this.now() + placementMs;
    for (const member of room.members) {
      member.ready = false;
      member.wantsRematch = false;
    }
    this.touch(room);
    this.scheduler.schedule(phaseTimerKey(room.code), placementMs, () =>
      this.onPlacementTimeout(room.code),
    );

    this.broadcastPlayers(room); // colours are known now
    this.notifier.toRoom(room.code, ServerEvents.PhaseChanged, {
      phase: 'placement',
      endsAt: room.phaseEndsAt,
    });
    for (const member of room.members) this.sendRoomState(room, member.id);
    this.scheduleBot(room);
  }

  // -------------------------------------------------------------------------
  // Minebot
  // -------------------------------------------------------------------------

  /** If it is Minebot's job to act (hide mines / play its turn), do it after a short pause. */
  private scheduleBot(room: Room): void {
    const bot = findBot(room);
    const game = room.game;
    if (!bot || !game) return;
    const needsMines = game.phase === 'placement' && !game.minesConfirmed[bot.id];
    const needsMove = game.phase === 'playing' && game.currentPlayerId === bot.id;
    if (!needsMines && !needsMove) return;

    const { botThinkMinMs: min, botThinkMaxMs: max } = this.config.timings;
    const delay = min + this.rng() * (max - min);
    this.scheduler.schedule(botTimerKey(room.code), delay, () => this.playBotTurn(room.code));
  }

  private playBotTurn(code: string): void {
    const room = this.rooms.get(code);
    const bot = room && findBot(room);
    const game = room?.game;
    if (!room || !bot?.bot || !game) return;

    if (game.phase === 'placement' && !game.minesConfirmed[bot.id]) {
      const cells = chooseBotMines(bot.bot, this.rng);
      this.applyEngine(room, placeMines(game, { playerId: bot.id, cells }));
      return;
    }
    if (game.phase === 'playing' && game.currentPlayerId === bot.id) {
      // The bot decides from ITS OWN view, exactly what a human would receive: no cheating.
      const column = chooseBotColumn(toPlayerView(game, bot.id), bot.bot, this.rng);
      if (column === null) return;
      this.applyEngine(room, applyMove(game, { playerId: bot.id, column, turnId: game.turnId }));
    }
  }

  private sendBotChat(room: Room, presetId: string): void {
    const bot = findBot(room);
    if (!bot) return;
    this.notifier.toRoom(room.code, ServerEvents.ChatMessage, {
      id: randomUUID(),
      playerId: bot.id,
      type: 'preset',
      value: presetId,
      sentAt: this.now(),
    });
  }

  private onPlacementTimeout(code: string): void {
    const room = this.rooms.get(code);
    if (room?.game?.phase !== 'placement') return;
    this.applyEngine(room, finishPlacement(room.game, this.rng));
  }

  private onTurnTimeout(code: string, turnId: number): void {
    const room = this.rooms.get(code);
    const game = room?.game;
    if (!room || game?.phase !== 'playing' || game.turnId !== turnId) return; // stale timer
    this.applyEngine(room, applyTimeoutMove(game, this.rng));
  }

  private onGraceExpired(code: string, playerId: PlayerId): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.graceEndsAt.delete(playerId);
    const member = findMember(room, playerId);
    if (!member || member.online || !room.game || !isGameRunning(room)) return;
    this.applyEngine(room, forfeit(room.game, playerId));
  }

  /** Stores an engine result and turns its events into timers + emits. */
  private applyEngine(room: Room, result: EngineResult): Ack {
    if (!result.ok) return fail(result.error);
    room.game = result.state;
    this.touch(room);
    for (const event of result.events) this.handleEngineEvent(room, event);
    this.scheduleBot(room);
    return OK;
  }

  private handleEngineEvent(room: Room, event: EngineEvent): void {
    switch (event.type) {
      case 'minesConfirmed':
        this.notifier.toRoom(room.code, ServerEvents.MinesConfirmed, { playerId: event.playerId });
        return;
      case 'playStarted':
        this.startTurnTimer(room, event.turnId);
        this.notifier.toRoom(room.code, ServerEvents.PhaseChanged, {
          phase: 'playing',
          endsAt: room.phaseEndsAt,
        });
        // Each player needs who moves first + the turnId: resend their own view.
        for (const member of room.members) this.sendRoomState(room, member.id);
        return;
      case 'moveApplied': {
        room.moveTimes.push(this.now());
        if (event.nextPlayerId) this.startTurnTimer(room, event.turnId);
        const { move } = event;
        this.notifier.toRoom(room.code, ServerEvents.MoveResult, {
          playerId: move.playerId,
          column: move.column,
          landedRow: move.landedRow,
          outcome: move.outcome,
          timeout: move.timeout,
          explodedMine: event.explodedMine,
          blockedColumn: event.blockedColumn,
          blockedColumns: { ...room.game?.blockedColumns },
          nextPlayerId: event.nextPlayerId,
          turnEndsAt: event.nextPlayerId ? room.phaseEndsAt : null,
          turnId: event.turnId,
        });
        return;
      }
      case 'gameOver':
        this.endGame(room, event.result);
        return;
    }
  }

  private startTurnTimer(room: Room, turnId: number): void {
    const { turnMs } = this.config.timings;
    room.phaseEndsAt = this.now() + turnMs;
    this.scheduler.schedule(phaseTimerKey(room.code), turnMs, () =>
      this.onTurnTimeout(room.code, turnId),
    );
  }

  private endGame(room: Room, result: GameResult): void {
    this.scheduler.cancelByPrefix(`${room.code}:`); // turn timer and any grace timers
    room.graceEndsAt.clear();
    room.phaseEndsAt = null;
    const game = room.game;
    if (!game) return;
    this.notifier.toRoom(room.code, ServerEvents.GameOver, {
      result,
      allMines: allRemainingMines(game),
      explodedMines: game.explodedMines,
      durationMs: this.now() - (room.gameStartedAt ?? this.now()),
      moveCount: game.moveHistory.length,
    });
    this.notifier.toRoom(room.code, ServerEvents.PhaseChanged, { phase: 'finished', endsAt: null });
    this.saveFinishedGame(room);

    const bot = findBot(room);
    if (bot) {
      // Minebot is always up for another round: the human's rematch click starts it.
      bot.wantsRematch = true;
      this.broadcastPlayers(room);
      this.sendBotChat(room, 'gg');
    }
  }

  /** Stores the game in the background: a database problem must never break live play. */
  private saveFinishedGame(room: Room): void {
    const game = room.game;
    if (!game) return;
    const record = toFinishedGameRecord({
      roomCode: room.code,
      game,
      nicknames: new Map(room.members.map((m) => [m.id, m.nickname])),
      startedAt: room.gameStartedAt ?? this.now(),
      endedAt: this.now(),
      moveTimes: room.moveTimes,
    });
    this.recorder.record(record).catch((error: unknown) => {
      this.logger.error(`Could not save game of room ${room.code}`, error);
    });
  }

  private resetToLobby(room: Room): void {
    room.game = null;
    room.startingRoll = null;
    room.phaseEndsAt = null;
    room.gameStartedAt = null;
    room.graceEndsAt.clear();
    for (const member of room.members) {
      member.ready = false;
      member.wantsRematch = false;
    }
  }

  /** The ONLY place a game state is sent: always through the receiver's own view. */
  private sendRoomState(room: Room, playerId: PlayerId): void {
    this.notifier.toPlayer(playerId, ServerEvents.RoomState, {
      room: toRoomSnapshot(room),
      game: room.game ? toPlayerView(room.game, playerId) : null,
      serverTime: this.now(),
    });
  }

  private broadcastPlayers(room: Room): void {
    this.notifier.toRoom(room.code, ServerEvents.RoomPlayers, toRoomPlayersPayload(room));
  }

  private requireMember(
    playerId: PlayerId,
  ): { ok: true; room: Room; member: RoomMember } | AckFailure {
    const room = this.rooms.findByPlayer(playerId);
    const member = room && findMember(room, playerId);
    if (!room || !member) return fail('NOT_IN_ROOM');
    return { ok: true, room, member };
  }

  private touch(room: Room): void {
    room.lastActivityAt = this.now();
  }
}
