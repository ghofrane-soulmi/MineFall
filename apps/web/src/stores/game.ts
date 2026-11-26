/**
 * The room/game store: the ONLY module that talks to the socket.
 * - Server events update state (the server is the source of truth).
 * - Actions emit client events and resolve with the server's acknowledgement.
 * Components read state and call actions; they never touch the socket.
 */
import {
  ClientEvents,
  ServerEvents,
  type Ack,
  type BotLevel,
  type Cell,
  type ChatMessagePayload,
  type ChatMessageType,
  type GameOverPayload,
  type MoveResultPayload,
  type PlayerView,
  type RoomPlayerInfo,
  type RoomSnapshot,
  type StartingRoll,
} from '@minefall/shared';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { errorMessage, type ClientErrorCode } from '../lib/errors';
import { applyGameOver, applyMinesConfirmed, applyMoveResult } from '../lib/server-events';
import { createGameSocket, type GameClient } from '../services/socket';
import { useSessionStore } from './session';

const ACK_TIMEOUT_MS = 5_000;
const MAX_CHAT_MESSAGES = 50;
const REACTION_DURATION_MS = 2_000;

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'offline';

/** End-of-game summary. Duration is unknown when the result came from a reconnect. */
export interface EndSummary extends Omit<GameOverPayload, 'durationMs'> {
  readonly durationMs: number | null;
}

export interface LastMove extends MoveResultPayload {
  /** Increments on every move so animations re-run even for the same cell. */
  readonly seq: number;
}

export interface Reaction {
  readonly id: string;
  readonly emoji: string;
  readonly playerId: string;
}

/** Socket factory, replaceable in tests. */
let socketFactory: (token: string) => GameClient = createGameSocket;
export function setSocketFactory(factory: (token: string) => GameClient): void {
  socketFactory = factory;
}

export const useGameStore = defineStore('game', () => {
  const session = useSessionStore();

  const socket = shallowRef<GameClient | null>(null);
  const connection = ref<ConnectionState>('idle');
  const room = ref<RoomSnapshot | null>(null);
  const game = ref<PlayerView | null>(null);
  /** serverTime - Date.now(): corrects countdowns when the player's clock is off. */
  const clockOffset = ref(0);
  const lastMove = ref<LastMove | null>(null);
  const dice = ref<StartingRoll | null>(null);
  const summary = ref<EndSummary | null>(null);
  const chat = ref<ChatMessagePayload[]>([]);
  const reactions = ref<Reaction[]>([]);
  const error = ref<string | null>(null);
  /** Quick match: searching for an opponent, and the room we were matched into. */
  const queue = ref<'idle' | 'searching'>('idle');
  const matchedCode = ref<string | null>(null);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const myId = computed(() => session.player?.id ?? null);
  const phase = computed(() => room.value?.phase ?? null);
  const players = computed<readonly RoomPlayerInfo[]>(() => room.value?.players ?? []);
  const me = computed(() => players.value.find((p) => p.id === myId.value) ?? null);
  const opponent = computed(() => players.value.find((p) => p.id !== myId.value) ?? null);
  const myColor = computed(
    () => game.value?.players.find((p) => p.id === myId.value)?.color ?? null,
  );
  const isMyTurn = computed(
    () => phase.value === 'playing' && game.value?.currentPlayerId === myId.value,
  );
  const myMinesConfirmed = computed(
    () => game.value?.minesConfirmed.find((m) => m.playerId === myId.value)?.confirmed ?? false,
  );

  // ---------------------------------------------------------------------------
  // Connection + server events
  // ---------------------------------------------------------------------------

  /** Opens the socket once. The server answers with room:state if we are in a room. */
  function connect(): void {
    const token = session.token;
    if (!token || socket.value) return;
    const s = socketFactory(token);
    socket.value = s;
    connection.value = 'connecting';

    s.on('connect', () => {
      connection.value = 'connected';
      queue.value = 'idle'; // the server drops a disconnected player from the queue
    });
    s.on('disconnect', () => {
      connection.value = 'offline';
    });
    s.on('connect_error', (err) => {
      connection.value = 'offline';
      if (err.message === 'UNAUTHORIZED') {
        disconnect();
        session.logout();
        setError('UNAUTHORIZED');
      }
    });

    s.on(ServerEvents.RoomState, (payload) => {
      room.value = payload.room;
      game.value = payload.game;
      clockOffset.value = payload.serverTime - Date.now();
      if (payload.game?.phase === 'finished' && payload.game.result) {
        summary.value ??= {
          result: payload.game.result,
          allMines: payload.game.revealedMines ?? [],
          explodedMines: payload.game.explodedMines,
          moveCount: payload.game.moveHistory.length,
          durationMs: null,
        };
      } else {
        summary.value = null;
      }
    });
    s.on(ServerEvents.RoomPlayers, (payload) => {
      if (room.value) room.value = { ...room.value, ...payload };
    });
    s.on(ServerEvents.PhaseChanged, ({ phase: next, endsAt }) => {
      if (!room.value) return;
      room.value = { ...room.value, phase: next, phaseEndsAt: endsAt };
      if (next === 'lobby') {
        game.value = null;
        summary.value = null;
        dice.value = null;
        lastMove.value = null;
      }
    });
    s.on(ServerEvents.QueueMatched, ({ code }) => {
      queue.value = 'idle';
      matchedCode.value = code;
    });
    s.on(ServerEvents.DiceRolled, (roll) => {
      dice.value = roll;
    });
    s.on(ServerEvents.MinesConfirmed, ({ playerId }) => {
      if (game.value) game.value = applyMinesConfirmed(game.value, playerId);
    });
    s.on(ServerEvents.MoveResult, (move) => {
      if (game.value) game.value = applyMoveResult(game.value, move);
      if (room.value) room.value = { ...room.value, phaseEndsAt: move.turnEndsAt };
      lastMove.value = { ...move, seq: (lastMove.value?.seq ?? 0) + 1 };
    });
    s.on(ServerEvents.GameOver, (over) => {
      if (game.value) game.value = applyGameOver(game.value, over);
      summary.value = over;
    });
    s.on(ServerEvents.ChatMessage, (message) => {
      chat.value = [...chat.value, message].slice(-MAX_CHAT_MESSAGES);
      if (message.type === 'emoji') addReaction(message);
    });
    s.on(ServerEvents.PlayerDisconnected, (payload) => {
      if (!room.value) return;
      const others = room.value.disconnected.filter((d) => d.playerId !== payload.playerId);
      room.value = { ...room.value, disconnected: [...others, payload] };
    });
    s.on(ServerEvents.PlayerReconnected, ({ playerId }) => {
      if (!room.value) return;
      room.value = {
        ...room.value,
        disconnected: room.value.disconnected.filter((d) => d.playerId !== playerId),
      };
    });

    s.connect();
  }

  function disconnect(): void {
    socket.value?.removeAllListeners();
    socket.value?.disconnect();
    socket.value = null;
    connection.value = 'idle';
    resetRoom();
  }

  // ---------------------------------------------------------------------------
  // Actions (client -> server, with acknowledgement)
  // ---------------------------------------------------------------------------

  /** Creates a room; with `bot`, Minebot is the opponent and the game starts at once. */
  async function createRoom(bot?: BotLevel): Promise<string | null> {
    const payload = bot ? { bot } : {};
    const ack = await request((s) => s.emitWithAck(ClientEvents.RoomCreate, payload));
    return ack.ok ? ack.data.code : null;
  }

  /** Quick match: wait for an opponent; `matchedCode` is set when the server pairs us. */
  async function joinQueue(): Promise<Ack> {
    matchedCode.value = null;
    const ack = await request((s) => s.emitWithAck(ClientEvents.QueueJoin, {}));
    if (ack.ok && matchedCode.value === null) queue.value = 'searching';
    return ack;
  }

  async function leaveQueue(): Promise<Ack> {
    queue.value = 'idle';
    return request((s) => s.emitWithAck(ClientEvents.QueueLeave, {}), { silent: true });
  }

  async function joinRoom(code: string): Promise<Ack> {
    return request((s) => s.emitWithAck(ClientEvents.RoomJoin, { code }), { silent: true });
  }

  async function setReady(ready: boolean): Promise<Ack> {
    return request((s) => s.emitWithAck(ClientEvents.RoomReady, { ready }));
  }

  async function placeMines(cells: readonly Cell[]): Promise<Ack> {
    return request((s) => s.emitWithAck(ClientEvents.MinesPlace, { cells }));
  }

  async function dropToken(column: number): Promise<Ack> {
    const turnId = game.value?.turnId ?? -1;
    return request((s) => s.emitWithAck(ClientEvents.MoveDrop, { column, turnId }));
  }

  async function requestRematch(): Promise<Ack> {
    return request((s) => s.emitWithAck(ClientEvents.GameRematch, {}));
  }

  async function sendChat(type: ChatMessageType, value: string): Promise<Ack> {
    return request((s) => s.emitWithAck(ClientEvents.ChatSend, { type, value }));
  }

  async function leaveRoom(): Promise<Ack> {
    const ack = await request((s) => s.emitWithAck(ClientEvents.RoomLeave, {}), { silent: true });
    resetRoom();
    return ack;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function request<T>(
    send: (s: GameClient) => Promise<Ack<T>>,
    options: { silent?: boolean } = {},
  ): Promise<Ack<T>> {
    const s = socket.value;
    let ack: Ack<T>;
    if (!s) {
      ack = { ok: false, error: 'NOT_IN_ROOM' };
    } else {
      try {
        ack = await send(s.timeout(ACK_TIMEOUT_MS) as unknown as GameClient);
      } catch {
        ack = { ok: false, error: 'INTERNAL_ERROR' };
        if (!options.silent) setError('TIMEOUT');
        return ack;
      }
    }
    if (!ack.ok && !options.silent) setError(ack.error);
    return ack;
  }

  function setError(code: ClientErrorCode): void {
    error.value = errorMessage(code);
  }

  function clearError(): void {
    error.value = null;
  }

  function dismissDice(): void {
    dice.value = null;
  }

  function addReaction(message: ChatMessagePayload): void {
    const reaction: Reaction = { id: message.id, emoji: message.value, playerId: message.playerId };
    reactions.value = [...reactions.value, reaction];
    setTimeout(() => {
      reactions.value = reactions.value.filter((r) => r.id !== reaction.id);
    }, REACTION_DURATION_MS);
  }

  function resetRoom(): void {
    room.value = null;
    game.value = null;
    lastMove.value = null;
    dice.value = null;
    summary.value = null;
    chat.value = [];
    reactions.value = [];
  }

  return {
    // state
    connection,
    room,
    game,
    clockOffset,
    lastMove,
    dice,
    summary,
    chat,
    reactions,
    error,
    queue,
    matchedCode,
    // derived
    myId,
    phase,
    players,
    me,
    opponent,
    myColor,
    isMyTurn,
    myMinesConfirmed,
    // actions
    connect,
    disconnect,
    createRoom,
    joinRoom,
    setReady,
    placeMines,
    dropToken,
    requestRematch,
    sendChat,
    leaveRoom,
    joinQueue,
    leaveQueue,
    clearError,
    dismissDice,
  };
});
