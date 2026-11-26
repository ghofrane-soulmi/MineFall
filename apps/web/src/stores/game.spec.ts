import { ClientEvents, ServerEvents } from '@minefall/shared';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameSocket } from '../services/socket';
import { FakeSocket } from '../test/fake-socket';
import { ME, OPP, playerView, roomSnapshot, roomState } from '../test/fixtures';
import { setSocketFactory, useGameStore } from './game';
import { useSessionStore } from './session';

let socket: FakeSocket;

function setup() {
  const session = useSessionStore();
  session.session = { token: 'token', player: ME };
  const store = useGameStore();
  store.connect();
  return { store, session };
}

beforeEach(() => {
  setActivePinia(createPinia());
  socket = new FakeSocket();
  setSocketFactory(() => socket.asClient());
});
afterEach(() => {
  setSocketFactory(createGameSocket);
  vi.useRealTimers();
});

describe('game store: server events', () => {
  it('connects once and tracks the connection', () => {
    const { store } = setup();
    store.connect();
    expect(store.connection).toBe('connected');
    expect(socket.handlers.get(ServerEvents.RoomState)).toHaveLength(1);
  });

  it('room:state replaces the whole room and game (resync after refresh)', () => {
    const { store } = setup();
    socket.serverEmit(ServerEvents.RoomState, roomState());
    expect(store.room?.code).toBe('K7QX2M');
    expect(store.isMyTurn).toBe(true);
    expect(store.myColor).toBe('red');
    expect(store.opponent?.nickname).toBe(OPP.nickname);
  });

  it('move:result updates the board, the turn and the deadline', () => {
    const { store } = setup();
    socket.serverEmit(ServerEvents.RoomState, roomState());
    socket.serverEmit(ServerEvents.MoveResult, {
      playerId: ME.id,
      column: 0,
      landedRow: 5,
      outcome: 'placed',
      timeout: false,
      explodedMine: null,
      blockedColumn: null,
      blockedColumns: {},
      nextPlayerId: OPP.id,
      turnEndsAt: 999,
      turnId: 2,
    });
    expect(store.game?.board[5]?.[0]).toBe('red');
    expect(store.isMyTurn).toBe(false);
    expect(store.room?.phaseEndsAt).toBe(999);
    expect(store.lastMove?.seq).toBe(1);
  });

  it('game:over stores the summary and reveals mines', () => {
    const { store } = setup();
    socket.serverEmit(ServerEvents.RoomState, roomState());
    socket.serverEmit(ServerEvents.GameOver, {
      result: { type: 'forfeit', winnerId: ME.id },
      allMines: [{ ownerId: OPP.id, col: 4, row: 2 }],
      explodedMines: [],
      durationMs: 61_000,
      moveCount: 3,
    });
    expect(store.summary?.durationMs).toBe(61_000);
    expect(store.game?.revealedMines).toHaveLength(1);
  });

  it('a finished game received on reconnect still gets a summary (without duration)', () => {
    const { store } = setup();
    socket.serverEmit(
      ServerEvents.RoomState,
      roomState(
        playerView({ phase: 'finished', result: { type: 'draw' }, revealedMines: [] }),
        roomSnapshot({ phase: 'finished' }),
      ),
    );
    expect(store.summary).toMatchObject({ result: { type: 'draw' }, durationMs: null });
  });

  it('phase:changed to lobby clears the finished game', () => {
    const { store } = setup();
    socket.serverEmit(ServerEvents.RoomState, roomState());
    socket.serverEmit(ServerEvents.PhaseChanged, { phase: 'lobby', endsAt: null });
    expect(store.phase).toBe('lobby');
    expect(store.game).toBeNull();
  });

  it('emoji chat messages also float as reactions for 2 seconds', () => {
    vi.useFakeTimers();
    const { store } = setup();
    socket.serverEmit(ServerEvents.ChatMessage, {
      id: 'm1',
      playerId: OPP.id,
      type: 'emoji',
      value: '🔥',
      sentAt: 0,
    });
    expect(store.chat).toHaveLength(1);
    expect(store.reactions).toEqual([{ id: 'm1', emoji: '🔥', playerId: OPP.id }]);
    vi.advanceTimersByTime(2_000);
    expect(store.reactions).toEqual([]);
  });

  it('tracks disconnected players and their grace deadline', () => {
    const { store } = setup();
    socket.serverEmit(ServerEvents.RoomState, roomState());
    socket.serverEmit(ServerEvents.PlayerDisconnected, { playerId: OPP.id, graceEndsAt: 5 });
    expect(store.room?.disconnected).toEqual([{ playerId: OPP.id, graceEndsAt: 5 }]);
    socket.serverEmit(ServerEvents.PlayerReconnected, { playerId: OPP.id, graceEndsAt: null });
    expect(store.room?.disconnected).toEqual([]);
  });

  it('an expired token logs the player out', () => {
    const { store, session } = setup();
    for (const handler of socket.handlers.get('connect_error') ?? []) {
      handler(new Error('UNAUTHORIZED'));
    }
    expect(session.player).toBeNull();
    expect(store.connection).toBe('idle');
    expect(store.error).toMatch(/session expired/i);
  });
});

describe('game store: actions', () => {
  it('dropToken sends the column with the current turnId', async () => {
    const { store } = setup();
    socket.serverEmit(ServerEvents.RoomState, roomState(playerView({ turnId: 7 })));
    await store.dropToken(4);
    expect(socket.sent).toContainEqual({
      event: ClientEvents.MoveDrop,
      payload: { column: 4, turnId: 7 },
    });
  });

  it('createRoom resolves with the code from the ack', async () => {
    const { store } = setup();
    socket.acks.set(ClientEvents.RoomCreate, { ok: true, data: { code: 'ABCDEF' } });
    expect(await store.createRoom()).toBe('ABCDEF');
  });

  it('createRoom asks for Minebot when a bot level is given', async () => {
    const { store } = setup();
    socket.acks.set(ClientEvents.RoomCreate, { ok: true, data: { code: 'ABCDEF' } });
    await store.createRoom('normal');
    await store.createRoom();
    expect(socket.sent.filter((m) => m.event === ClientEvents.RoomCreate)).toEqual([
      { event: ClientEvents.RoomCreate, payload: { bot: 'normal' } },
      { event: ClientEvents.RoomCreate, payload: {} },
    ]);
  });

  it('quick match: searching until the server pairs us, then remembers the room', async () => {
    const { store } = setup();
    await store.joinQueue();
    expect(store.queue).toBe('searching');
    socket.serverEmit(ServerEvents.QueueMatched, { code: 'QM1234' });
    expect(store.queue).toBe('idle');
    expect(store.matchedCode).toBe('QM1234');
  });

  it('quick match: a match arriving before the ack does not leave us "searching"', async () => {
    const { store } = setup();
    const original = socket.emitWithAck.bind(socket);
    socket.emitWithAck = (event, payload) => {
      socket.serverEmit(ServerEvents.QueueMatched, { code: 'FAST12' });
      return original(event, payload);
    };
    await store.joinQueue();
    expect(store.queue).toBe('idle');
    expect(store.matchedCode).toBe('FAST12');
  });

  it('quick match: cancel goes back to idle and tells the server', async () => {
    const { store } = setup();
    await store.joinQueue();
    await store.leaveQueue();
    expect(store.queue).toBe('idle');
    expect(socket.sent.map((m) => m.event)).toContain(ClientEvents.QueueLeave);
  });

  it('a spectator room:state marks us as a spectator; leaving resets it', async () => {
    const { store } = setup();
    socket.serverEmit(ServerEvents.RoomState, { ...roomState(), role: 'spectator' });
    expect(store.isSpectator).toBe(true);
    await store.leaveRoom();
    expect(store.isSpectator).toBe(false);
  });

  it('watchRoom asks to watch the room', async () => {
    const { store } = setup();
    await store.watchRoom('K7QX2M');
    expect(socket.sent).toContainEqual({
      event: ClientEvents.RoomWatch,
      payload: { code: 'K7QX2M' },
    });
  });

  it('a refused action shows a readable error', async () => {
    const { store } = setup();
    socket.acks.set(ClientEvents.MoveDrop, { ok: false, error: 'COLUMN_BLOCKED' });
    expect(await store.dropToken(3)).toEqual({ ok: false, error: 'COLUMN_BLOCKED' });
    expect(store.error).toBe('This column is blocked after an explosion.');
  });

  it('joinRoom errors are returned silently (the view shows them)', async () => {
    const { store } = setup();
    socket.acks.set(ClientEvents.RoomJoin, { ok: false, error: 'ROOM_FULL' });
    expect(await store.joinRoom('ABCDEF')).toEqual({ ok: false, error: 'ROOM_FULL' });
    expect(store.error).toBeNull();
  });

  it('leaving resets the local room state', async () => {
    const { store } = setup();
    socket.serverEmit(ServerEvents.RoomState, roomState());
    await store.leaveRoom();
    expect(store.room).toBeNull();
    expect(store.game).toBeNull();
  });
});
