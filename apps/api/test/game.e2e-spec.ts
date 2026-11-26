/**
 * Integration tests: the real NestJS app, real HTTP, two (or three) real Socket.IO clients.
 * They play complete games through the network exactly like two browser tabs would.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClientEvents, ServerEvents, type Cell, type MoveResultPayload } from '@minefall/shared';
import request from 'supertest';
import { cellsIn } from './fakes';
import {
  connect,
  joinAsGuest,
  reconnect,
  startServer,
  type TestPlayer,
  type TestServer,
} from './socket-helpers';

const FIRST_MINES: Cell[] = [
  { col: 0, row: 1 },
  { col: 1, row: 1 },
];
const SECOND_MINES: Cell[] = [
  { col: 3, row: 5 }, // bottom of column 3: the first player will step on it
  { col: 6, row: 1 }, // never reached: must stay secret until game over
];

/** Two guests in one room, both ready. Resolves once the dice decided who is first. */
async function startedRoom(server: TestServer) {
  const host = await joinAsGuest(server, 'Host');
  const guest = await joinAsGuest(server, 'Guest');

  const created = await host.socket.emitWithAck(ClientEvents.RoomCreate, {});
  if (!created.ok) throw new Error(created.error);
  const { code } = created.data;
  expect(await guest.socket.emitWithAck(ClientEvents.RoomJoin, { code })).toEqual({ ok: true });

  await host.socket.emitWithAck(ClientEvents.RoomReady, { ready: true });
  await guest.socket.emitWithAck(ClientEvents.RoomReady, { ready: true });
  const dice = await host.rec.waitFor(ServerEvents.DiceRolled);
  const [first, second] = dice.firstPlayerId === host.id ? [host, guest] : [guest, host];
  return { code, host, guest, first, second };
}

/** Both players place the scripted mines; resolves once play has started. */
async function placeMines(first: TestPlayer, second: TestPlayer): Promise<void> {
  expect(await first.socket.emitWithAck(ClientEvents.MinesPlace, { cells: FIRST_MINES })).toEqual({
    ok: true,
  });
  expect(await second.socket.emitWithAck(ClientEvents.MinesPlace, { cells: SECOND_MINES })).toEqual(
    { ok: true },
  );
  await first.rec.waitFor(ServerEvents.PhaseChanged, (p) => p.phase === 'playing');
}

/** Plays a move with the turnId taken from the last move:result (or 1 for the first move). */
async function play(player: TestPlayer, column: number, turnId: number) {
  return player.socket.emitWithAck(ClientEvents.MoveDrop, { column, turnId });
}

function close(...players: TestPlayer[]): void {
  for (const p of players) p.socket.close();
}

describe('Minefall API (integration)', () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startServer();
  });
  afterAll(async () => {
    await server.app.close();
  });

  describe('HTTP', () => {
    it('GET /health', async () => {
      await request(server.app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
    });

    it('POST /auth/guest returns a token, or 400 for a bad nickname', async () => {
      const ok = await request(server.app.getHttpServer())
        .post('/auth/guest')
        .send({ nickname: ' Zoé ' })
        .expect(201);
      expect(ok.body).toMatchObject({ token: expect.any(String), player: { nickname: 'Zoé' } });

      const bad = await request(server.app.getHttpServer())
        .post('/auth/guest')
        .send({ nickname: '<img onerror=x>' })
        .expect(400);
      expect(bad.body).toMatchObject({ error: 'INVALID_NICKNAME' });
    });
  });

  describe('socket authentication', () => {
    it('refuses a socket without a token', async () => {
      await expect(connect(server, undefined)).rejects.toThrow('UNAUTHORIZED');
    });

    it('refuses a forged token', async () => {
      await expect(connect(server, 'eyJhbGciOiJIUzI1NiJ9.e30.forged')).rejects.toThrow(
        'UNAUTHORIZED',
      );
    });
  });

  describe('rooms', () => {
    it('rejects bad payloads, unknown codes and a third player', async () => {
      const { code, host, guest } = await startedRoom(server);
      const third = await joinAsGuest(server, 'Third');

      expect(await third.socket.emitWithAck(ClientEvents.RoomJoin, { code: 42 } as never)).toEqual({
        ok: false,
        error: 'INVALID_PAYLOAD',
      });
      expect(await third.socket.emitWithAck(ClientEvents.RoomJoin, { code: 'ZZZZZZ' })).toEqual({
        ok: false,
        error: 'ROOM_NOT_FOUND',
      });
      expect(await third.socket.emitWithAck(ClientEvents.RoomJoin, { code })).toEqual({
        ok: false,
        error: 'ROOM_FULL',
      });
      close(host, guest, third);
    });
  });

  describe('a full game over the network', () => {
    it('plays placement, an explosion, a blocked column and a win; mines stay hidden', async () => {
      const { first, second } = await startedRoom(server);

      // Both players get their own view of the new game.
      const firstState = await first.rec.waitFor(ServerEvents.RoomState, (s) => s.game !== null);
      expect(firstState.room.phase).toBe('placement');
      expect(firstState.game?.players[0]?.id).toBe(first.id);

      await placeMines(first, second);
      expect(first.rec.all(ServerEvents.MinesConfirmed)).toHaveLength(2);

      // Wrong player / stale turn are refused.
      expect(await play(second, 0, 1)).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
      expect(await play(first, 0, 99)).toEqual({ ok: false, error: 'STALE_TURN' });

      // First player lands on the second player's mine: explosion, column 3 blocked.
      expect(await play(first, 3, 1)).toEqual({ ok: true });
      const boom: MoveResultPayload = await second.rec.waitFor(ServerEvents.MoveResult);
      expect(boom).toMatchObject({
        outcome: 'exploded',
        explodedMine: { col: 3, row: 5, ownerId: second.id },
        blockedColumn: 3,
        nextPlayerId: second.id,
      });
      expect(await play(second, 3, boom.turnId)).toEqual({ ok: false, error: 'COLUMN_BLOCKED' });

      // Then the first player stacks column 4 while the second plays column 5.
      await first.rec.waitFor(ServerEvents.MoveResult); // first's copy of the explosion
      let turnId = boom.turnId;
      const script: [TestPlayer, number][] = [
        [second, 5],
        [first, 4],
        [second, 5],
        [first, 4],
        [second, 5],
        [first, 4],
        [second, 0],
        [first, 4],
      ];
      for (const [player, column] of script) {
        expect(await play(player, column, turnId)).toEqual({ ok: true });
        turnId = (await first.rec.waitFor(ServerEvents.MoveResult)).turnId;
      }

      const [overForFirst, overForSecond] = await Promise.all([
        first.rec.waitFor(ServerEvents.GameOver),
        second.rec.waitFor(ServerEvents.GameOver),
      ]);
      expect(overForFirst.result).toMatchObject({ type: 'win', winnerId: first.id });
      expect(overForSecond.result).toEqual(overForFirst.result);
      expect(overForSecond.allMines).toContainEqual({ ownerId: second.id, col: 6, row: 1 });
      expect(overForFirst.moveCount).toBe(9);

      // SECURITY: before game over, no payload received by a player contained one of the
      // opponent's unexploded mines (checked on the raw recorded network traffic).
      const beforeGameOver = (p: TestPlayer) =>
        p.rec.events.slice(
          0,
          p.rec.events.findIndex((e) => e.event === ServerEvents.GameOver),
        );
      const leaked = (p: TestPlayer, secret: Cell[]) =>
        beforeGameOver(p)
          .flatMap((e) => cellsIn(e.payload))
          .filter((c) => secret.some((s) => s.col === c.col && s.row === c.row));
      expect(leaked(first, [{ col: 6, row: 1 }])).toEqual([]);
      expect(leaked(second, FIRST_MINES)).toEqual([]);

      close(first, second);
    });
  });

  describe('chat', () => {
    it('delivers presets, emojis and sanitised text; rejects spam and bad payloads', async () => {
      const { host, guest } = await startedRoom(server);
      const send = (value: string, type: 'preset' | 'emoji' | 'text') =>
        host.socket.emitWithAck(ClientEvents.ChatSend, { type, value });

      expect(await send('<i>hi</i>', 'text')).toEqual({ ok: true });
      const message = await guest.rec.waitFor(ServerEvents.ChatMessage);
      expect(message).toMatchObject({ playerId: host.id, type: 'text', value: 'ihi/i' });

      expect(await send('gg', 'preset')).toEqual({ ok: false, error: 'RATE_LIMITED' });
      expect(await send('🐍', 'emoji')).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
      close(host, guest);
    });
  });

  describe('reconnection and leaving', () => {
    it('a page refresh restores the exact game state', async () => {
      const { first, second } = await startedRoom(server);
      await placeMines(first, second);
      await play(first, 0, 1);
      const afterFirst = await second.rec.waitFor(ServerEvents.MoveResult);
      await play(second, 1, afterFirst.turnId);
      await first.rec.waitFor(ServerEvents.MoveResult, (m) => m.playerId === second.id);

      await reconnect(server, second); // the refresh
      const disconnected = await first.rec.waitFor(ServerEvents.PlayerDisconnected);
      expect(disconnected).toEqual({ playerId: second.id, graceEndsAt: expect.any(Number) });
      await first.rec.waitFor(ServerEvents.PlayerReconnected);

      const state = await second.rec.waitFor(ServerEvents.RoomState);
      expect(state.room.phase).toBe('playing');
      expect(state.game?.board[5]?.slice(0, 2)).toEqual(['red', 'yellow']);
      expect(state.game?.ownMines).toEqual(SECOND_MINES);
      expect(state.game?.currentPlayerId).toBe(first.id);
      expect(state.game?.turnId).toBe(3);

      // The game simply continues.
      expect(await play(first, 2, 3)).toEqual({ ok: true });
      close(first, second);
    });

    it('leaving during a game is a forfeit; the winner goes back to the lobby', async () => {
      const { first, second } = await startedRoom(server);
      await placeMines(first, second);

      expect(await second.socket.emitWithAck(ClientEvents.RoomLeave, {})).toEqual({ ok: true });
      const over = await first.rec.waitFor(ServerEvents.GameOver);
      expect(over.result).toEqual({ type: 'forfeit', winnerId: first.id });
      await first.rec.waitFor(ServerEvents.PhaseChanged, (p) => p.phase === 'lobby');
      close(first, second);
    });

    it('rematch: both ask, a new game starts with the other player first', async () => {
      const { first, second } = await startedRoom(server);
      await placeMines(first, second);
      await playQuickWin(first, second);

      expect(await first.socket.emitWithAck(ClientEvents.GameRematch, {})).toEqual({ ok: true });
      expect(await second.socket.emitWithAck(ClientEvents.GameRematch, {})).toEqual({ ok: true });
      const state = await first.rec.waitFor(
        ServerEvents.RoomState,
        (s) => s.game?.phase === 'placement' && s.game.players[0]?.id === second.id,
      );
      expect(state.game?.players[0]?.id).toBe(second.id);
      close(first, second);
    });
  });

  /** Finishes a game fast: the first player wins vertically in column 0. */
  async function playQuickWin(first: TestPlayer, second: TestPlayer): Promise<void> {
    let turnId = 1;
    for (const [player, column] of [
      [first, 0],
      [second, 2],
      [first, 0],
      [second, 2],
      [first, 0],
      [second, 2],
      [first, 0],
    ] as const) {
      expect(await play(player, column, turnId)).toEqual({ ok: true });
      turnId = (await first.rec.waitFor(ServerEvents.MoveResult)).turnId;
    }
    await first.rec.waitFor(ServerEvents.GameOver);
  }
});

describe('Minefall API (server timers, short durations)', () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startServer({ placementMs: 300, turnMs: 400, disconnectGraceMs: 300 });
  });
  afterAll(async () => {
    await server.app.close();
  });

  it('places mines randomly when placement time runs out, then plays for an idle player', async () => {
    const { first, second } = await startedRoom(server);
    await first.rec.waitFor(ServerEvents.PhaseChanged, (p) => p.phase === 'playing');
    const auto = await second.rec.waitFor(ServerEvents.MoveResult);
    expect(auto).toMatchObject({ playerId: first.id, timeout: true });
    close(first, second);
  });

  it('a player who stays disconnected past the grace period forfeits', async () => {
    const { first, second } = await startedRoom(server);
    second.socket.close();
    const over = await first.rec.waitFor(ServerEvents.GameOver);
    expect(over.result).toEqual({ type: 'forfeit', winnerId: first.id });
    close(first);
  });
});
