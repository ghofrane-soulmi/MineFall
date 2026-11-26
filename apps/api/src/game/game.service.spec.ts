import { describe, expect, it } from 'vitest';
import { ServerEvents, type Cell, type PlayerId } from '@minefall/shared';
import {
  ALICE,
  BOB,
  CAROL,
  FakeClock,
  FakeNotifier,
  FakeScheduler,
  cellsIn,
  sequenceRng,
  testConfig,
} from '../../test/fakes';
import { RoomsService } from '../rooms/rooms.service';
import { GameService } from './game.service';

// Dice: each player rolls 2 dice from the RNG. 0.99 -> 6, 0 -> 1, so this makes Alice start
// (12 vs 2). Later RNG calls (random mines / timeout moves) reuse the same cycle.
const aliceStarts = () => sequenceRng(0.99, 0.99, 0, 0);

const ALICE_MINES: Cell[] = [
  { col: 0, row: 1 },
  { col: 1, row: 1 },
];
const BOB_MINES: Cell[] = [
  { col: 3, row: 5 }, // bottom of column 3: Alice will step on it in the explosion test
  { col: 6, row: 1 },
];

const PLACEMENT_MS = 30_000;
const TURN_MS = 20_000;
const GRACE_MS = 60_000;

function setup(rng = aliceStarts()) {
  const clock = new FakeClock();
  const notifier = new FakeNotifier();
  const scheduler = new FakeScheduler();
  const rooms = new RoomsService();
  const config = testConfig({
    placementMs: PLACEMENT_MS,
    turnMs: TURN_MS,
    disconnectGraceMs: GRACE_MS,
    roomIdleMs: 30 * 60_000,
  });
  const service = new GameService(rooms, scheduler, notifier, config, clock.now, rng);
  return { service, rooms, notifier, scheduler, clock };
}

type Ctx = ReturnType<typeof setup>;

/** Alice creates a room, Bob joins. Returns the room code. */
function lobby(ctx: Ctx): string {
  const created = ctx.service.createRoom(ALICE);
  if (!created.ok) throw new Error(created.error);
  expect(ctx.service.joinRoom(BOB, created.data.code)).toEqual({ ok: true });
  return created.data.code;
}

/** Lobby -> both ready -> both mines placed: Alice to move. */
function playing(ctx: Ctx): string {
  const code = lobby(ctx);
  ctx.service.setReady(ALICE.id, true);
  ctx.service.setReady(BOB.id, true);
  expect(ctx.service.placeMines(ALICE.id, { cells: ALICE_MINES })).toEqual({ ok: true });
  expect(ctx.service.placeMines(BOB.id, { cells: BOB_MINES })).toEqual({ ok: true });
  return code;
}

function drop(ctx: Ctx, playerId: PlayerId, column: number) {
  const room = ctx.rooms.findByPlayer(playerId);
  return ctx.service.dropToken(playerId, { column, turnId: room?.game?.turnId ?? -1 });
}

describe('GameService', () => {
  describe('rooms and lobby', () => {
    it('creates a room and sends the creator its state', () => {
      const ctx = setup();
      const result = ctx.service.createRoom(ALICE);
      expect(result).toEqual({ ok: true, data: { code: expect.any(String) } });
      const state = ctx.notifier.last(ALICE.id, ServerEvents.RoomState);
      expect(state.room.phase).toBe('lobby');
      expect(state.game).toBeNull();
    });

    it('refuses to create a second room for the same player', () => {
      const ctx = setup();
      ctx.service.createRoom(ALICE);
      expect(ctx.service.createRoom(ALICE)).toEqual({ ok: false, error: 'ALREADY_IN_ROOM' });
    });

    it('lets a second player join, and tells the room', () => {
      const ctx = setup();
      lobby(ctx);
      const players = ctx.notifier.last(ALICE.id, ServerEvents.RoomPlayers).players;
      expect(players.map((p) => p.nickname)).toEqual(['Alice', 'Bob']);
      expect(ctx.notifier.last(BOB.id, ServerEvents.RoomState).room.players).toHaveLength(2);
    });

    it('refuses unknown codes, full rooms and players already elsewhere', () => {
      const ctx = setup();
      const code = lobby(ctx);
      expect(ctx.service.joinRoom(CAROL, 'ZZZZZZ')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
      expect(ctx.service.joinRoom(CAROL, code)).toEqual({ ok: false, error: 'ROOM_FULL' });
      ctx.service.createRoom(CAROL);
      expect(ctx.service.joinRoom(CAROL, code)).toEqual({ ok: false, error: 'ALREADY_IN_ROOM' });
    });

    it('treats joining your own room again as a harmless resync', () => {
      const ctx = setup();
      const code = lobby(ctx);
      ctx.notifier.clear();
      expect(ctx.service.joinRoom(BOB, code)).toEqual({ ok: true });
      expect(ctx.notifier.receivedBy(BOB.id, ServerEvents.RoomState)).toHaveLength(1);
    });

    it('refuses actions from players who are in no room', () => {
      const ctx = setup();
      expect(ctx.service.setReady(CAROL.id, true)).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
      expect(ctx.service.leaveRoom(CAROL.id)).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
      expect(ctx.service.placeMines(CAROL.id, { cells: [] })).toEqual({
        ok: false,
        error: 'NOT_IN_ROOM',
      });
    });

    it('refuses game actions before the game starts', () => {
      const ctx = setup();
      lobby(ctx);
      expect(ctx.service.placeMines(ALICE.id, { cells: ALICE_MINES })).toEqual({
        ok: false,
        error: 'WRONG_PHASE',
      });
      expect(drop(ctx, ALICE.id, 0)).toEqual({ ok: false, error: 'WRONG_PHASE' });
      expect(ctx.service.requestRematch(ALICE.id)).toEqual({ ok: false, error: 'WRONG_PHASE' });
    });

    it('does not start with only one ready player, or alone', () => {
      const ctx = setup();
      ctx.service.createRoom(ALICE);
      ctx.service.setReady(ALICE.id, true);
      expect(ctx.rooms.findByPlayer(ALICE.id)?.game).toBeNull();
    });
  });

  describe('game start: dice + placement', () => {
    it('rolls the dice, starts placement and gives each player their own view', () => {
      const ctx = setup();
      const code = lobby(ctx);
      ctx.service.setReady(ALICE.id, true);
      ctx.service.setReady(BOB.id, true);

      const dice = ctx.notifier.last(BOB.id, ServerEvents.DiceRolled);
      expect(dice.firstPlayerId).toBe(ALICE.id);
      expect(dice.rounds[0]?.totals).toEqual([12, 2]);

      expect(ctx.notifier.last(BOB.id, ServerEvents.PhaseChanged)).toEqual({
        phase: 'placement',
        endsAt: ctx.clock.time + PLACEMENT_MS,
      });
      const players = ctx.notifier.last(BOB.id, ServerEvents.RoomPlayers).players;
      expect(players.map((p) => [p.id, p.color, p.ready])).toEqual([
        [ALICE.id, 'red', false],
        [BOB.id, 'yellow', false],
      ]);
      expect(ctx.notifier.last(ALICE.id, ServerEvents.RoomState).game?.viewerId).toBe(ALICE.id);
      expect(ctx.notifier.last(BOB.id, ServerEvents.RoomState).game?.viewerId).toBe(BOB.id);
      expect(ctx.scheduler.tasks.get(`${code}:phase`)?.delayMs).toBe(PLACEMENT_MS);
    });

    it('refuses "ready" once the game has started', () => {
      const ctx = setup();
      playing(ctx);
      expect(ctx.service.setReady(ALICE.id, false)).toEqual({ ok: false, error: 'WRONG_PHASE' });
    });

    it('starts play when both players confirmed their mines', () => {
      const ctx = setup();
      const code = playing(ctx);
      expect(ctx.notifier.receivedBy(ALICE.id, ServerEvents.MinesConfirmed)).toHaveLength(2);
      expect(ctx.notifier.last(ALICE.id, ServerEvents.PhaseChanged)).toEqual({
        phase: 'playing',
        endsAt: ctx.clock.time + TURN_MS,
      });
      expect(ctx.scheduler.tasks.get(`${code}:phase`)?.delayMs).toBe(TURN_MS);
    });

    it("resends each player's view when play starts (who moves first, turnId)", () => {
      const ctx = setup();
      playing(ctx);
      for (const player of [ALICE, BOB]) {
        const state = ctx.notifier.last(player.id, ServerEvents.RoomState);
        expect(state.game?.phase).toBe('playing');
        expect(state.game?.currentPlayerId).toBe(ALICE.id);
        expect(state.game?.turnId).toBe(1);
        expect(state.game?.viewerId).toBe(player.id);
      }
    });

    it('places random mines and starts play when the placement timer ends', () => {
      const ctx = setup();
      const code = lobby(ctx);
      ctx.service.setReady(ALICE.id, true);
      ctx.service.setReady(BOB.id, true);
      ctx.service.placeMines(ALICE.id, { cells: ALICE_MINES });

      ctx.scheduler.fire(`${code}:phase`);
      const game = ctx.rooms.get(code)?.game;
      expect(game?.phase).toBe('playing');
      expect(game?.mines[ALICE.id]).toEqual(ALICE_MINES);
      expect(game?.mines[BOB.id]).toHaveLength(2);
    });

    it('returns engine errors as acks', () => {
      const ctx = setup();
      lobby(ctx);
      ctx.service.setReady(ALICE.id, true);
      ctx.service.setReady(BOB.id, true);
      expect(ctx.service.placeMines(ALICE.id, { cells: [{ col: 0, row: 0 }] })).toEqual({
        ok: false,
        error: 'INVALID_MINE_COUNT',
      });
    });
  });

  describe('moves and timers', () => {
    it('applies a move and broadcasts the result with the next turn deadline', () => {
      const ctx = setup();
      playing(ctx);
      ctx.clock.advance(1_000);
      expect(drop(ctx, ALICE.id, 0)).toEqual({ ok: true });
      expect(ctx.notifier.last(BOB.id, ServerEvents.MoveResult)).toEqual({
        playerId: ALICE.id,
        column: 0,
        landedRow: 5,
        outcome: 'placed',
        timeout: false,
        explodedMine: null,
        blockedColumn: null,
        blockedColumns: {},
        nextPlayerId: BOB.id,
        turnEndsAt: ctx.clock.time + TURN_MS,
        turnId: 2,
      });
    });

    it('rejects an invalid move without emitting anything', () => {
      const ctx = setup();
      playing(ctx);
      ctx.notifier.clear();
      expect(drop(ctx, BOB.id, 0)).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
      expect(ctx.service.dropToken(ALICE.id, { column: 0, turnId: 999 })).toEqual({
        ok: false,
        error: 'STALE_TURN',
      });
      expect(ctx.notifier.sent).toEqual([]);
    });

    it('broadcasts explosions and the blocked column', () => {
      const ctx = setup();
      playing(ctx);
      drop(ctx, ALICE.id, 3); // lands on Bob's mine at (3,5)
      expect(ctx.notifier.last(ALICE.id, ServerEvents.MoveResult)).toMatchObject({
        outcome: 'exploded',
        explodedMine: { col: 3, row: 5, ownerId: BOB.id },
        blockedColumn: 3,
        blockedColumns: { 3: 1 },
      });
      drop(ctx, BOB.id, 0);
      expect(ctx.notifier.last(ALICE.id, ServerEvents.MoveResult).blockedColumns).toEqual({});
    });

    it('refuses the blocked column for the next move', () => {
      const ctx = setup();
      playing(ctx);
      drop(ctx, ALICE.id, 3);
      expect(drop(ctx, BOB.id, 3)).toEqual({ ok: false, error: 'COLUMN_BLOCKED' });
    });

    it('plays a random move when the turn timer ends', () => {
      const ctx = setup();
      const code = playing(ctx);
      ctx.scheduler.fire(`${code}:phase`);
      const result = ctx.notifier.last(BOB.id, ServerEvents.MoveResult);
      expect(result).toMatchObject({ playerId: ALICE.id, timeout: true, nextPlayerId: BOB.id });
    });

    it('ignores a turn timer that fires after the move was already played', () => {
      const ctx = setup();
      const code = playing(ctx);
      const staleTask = ctx.scheduler.tasks.get(`${code}:phase`)?.task;
      drop(ctx, ALICE.id, 0);
      ctx.notifier.clear();
      staleTask?.();
      expect(ctx.notifier.sent).toEqual([]);
    });

    it('ends the game on a win: winner, all mines revealed, timers stopped', () => {
      const ctx = setup();
      const code = playing(ctx);
      ctx.clock.advance(5_000);
      // Alice stacks column 4, Bob column 5: Alice wins vertically on her 4th token.
      for (const [player, col] of [
        [ALICE, 4],
        [BOB, 5],
        [ALICE, 4],
        [BOB, 5],
        [ALICE, 4],
        [BOB, 5],
        [ALICE, 4],
      ] as const) {
        expect(drop(ctx, player.id, col)).toEqual({ ok: true });
      }

      const over = ctx.notifier.last(BOB.id, ServerEvents.GameOver);
      expect(over.result).toMatchObject({ type: 'win', winnerId: ALICE.id });
      expect(over.allMines).toEqual(
        expect.arrayContaining([
          { ownerId: ALICE.id, col: 0, row: 1 },
          { ownerId: BOB.id, col: 3, row: 5 },
        ]),
      );
      expect(over.moveCount).toBe(7);
      expect(over.durationMs).toBe(5_000);
      expect(ctx.notifier.last(BOB.id, ServerEvents.PhaseChanged)).toEqual({
        phase: 'finished',
        endsAt: null,
      });
      expect([...ctx.scheduler.tasks.keys()].filter((k) => k.startsWith(code))).toEqual([]);
    });
  });

  describe('rematch', () => {
    function finishedByForfeit(ctx: Ctx): string {
      const code = playing(ctx);
      ctx.service.playerDisconnected(BOB.id);
      ctx.scheduler.fire(`${code}:grace:${BOB.id}`);
      ctx.service.playerConnected(BOB);
      return code;
    }

    it('starts a new game with the starting player swapped once both ask', () => {
      const ctx = setup();
      const code = finishedByForfeit(ctx);
      expect(ctx.service.requestRematch(ALICE.id)).toEqual({ ok: true });
      expect(ctx.rooms.get(code)?.game?.phase).toBe('finished');
      expect(ctx.notifier.last(BOB.id, ServerEvents.RoomPlayers).players[0]?.wantsRematch).toBe(
        true,
      );

      ctx.notifier.clear();
      expect(ctx.service.requestRematch(BOB.id)).toEqual({ ok: true });
      const game = ctx.rooms.get(code)?.game;
      expect(game?.phase).toBe('placement');
      expect(game?.players[0].id).toBe(BOB.id); // Alice started last time
      expect(ctx.notifier.receivedBy(ALICE.id, ServerEvents.DiceRolled)).toEqual([]); // no dice
    });
  });

  describe('leaving', () => {
    it('leaving during a game is a forfeit; the other player is back in the lobby', () => {
      const ctx = setup();
      const code = playing(ctx);
      expect(ctx.service.leaveRoom(BOB.id)).toEqual({ ok: true });

      expect(ctx.notifier.last(ALICE.id, ServerEvents.GameOver).result).toEqual({
        type: 'forfeit',
        winnerId: ALICE.id,
      });
      expect(ctx.notifier.last(ALICE.id, ServerEvents.PhaseChanged)).toEqual({
        phase: 'lobby',
        endsAt: null,
      });
      const room = ctx.rooms.get(code);
      expect(room?.members.map((m) => m.id)).toEqual([ALICE.id]);
      expect(room?.game).toBeNull();
      expect(ctx.rooms.findByPlayer(BOB.id)).toBeUndefined();
    });

    it('a new player can then join the remaining host', () => {
      const ctx = setup();
      const code = playing(ctx);
      ctx.service.leaveRoom(BOB.id);
      expect(ctx.service.joinRoom(CAROL, code)).toEqual({ ok: true });
    });

    it('the last player leaving deletes the room and its timers', () => {
      const ctx = setup();
      const code = lobby(ctx);
      ctx.service.leaveRoom(ALICE.id);
      expect(ctx.rooms.get(code)?.hostId).toBe(BOB.id);
      ctx.service.leaveRoom(BOB.id);
      expect(ctx.rooms.get(code)).toBeUndefined();
    });
  });

  describe('disconnection and reconnection', () => {
    it('gives a disconnected player 60 s during a game, then forfeits', () => {
      const ctx = setup();
      const code = playing(ctx);
      ctx.service.playerDisconnected(BOB.id);
      expect(ctx.notifier.last(ALICE.id, ServerEvents.PlayerDisconnected)).toEqual({
        playerId: BOB.id,
        graceEndsAt: ctx.clock.time + GRACE_MS,
      });
      expect(ctx.notifier.last(ALICE.id, ServerEvents.RoomPlayers).players[1]?.online).toBe(false);

      ctx.scheduler.fire(`${code}:grace:${BOB.id}`);
      expect(ctx.notifier.last(ALICE.id, ServerEvents.GameOver).result).toEqual({
        type: 'forfeit',
        winnerId: ALICE.id,
      });
    });

    it('reconnecting in time cancels the forfeit and resends the exact state', () => {
      const ctx = setup();
      const code = playing(ctx);
      drop(ctx, ALICE.id, 0);
      ctx.service.playerDisconnected(BOB.id);
      ctx.notifier.clear();

      ctx.service.playerConnected(BOB);
      expect(ctx.scheduler.tasks.has(`${code}:grace:${BOB.id}`)).toBe(false);
      expect(ctx.notifier.last(ALICE.id, ServerEvents.PlayerReconnected)).toEqual({
        playerId: BOB.id,
        graceEndsAt: null,
      });
      const state = ctx.notifier.last(BOB.id, ServerEvents.RoomState);
      expect(state.game?.board[5]?.[0]).toBe('red');
      expect(state.game?.ownMines).toEqual(BOB_MINES);
      expect(state.game?.currentPlayerId).toBe(BOB.id);
    });

    it('a disconnection in the lobby has no grace timer', () => {
      const ctx = setup();
      lobby(ctx);
      ctx.service.playerDisconnected(BOB.id);
      expect(ctx.notifier.last(ALICE.id, ServerEvents.PlayerDisconnected).graceEndsAt).toBeNull();
      expect(ctx.scheduler.tasks.size).toBe(0);
    });

    it('a stale grace timer does nothing once the player is back', () => {
      const ctx = setup();
      const code = playing(ctx);
      ctx.service.playerDisconnected(BOB.id);
      const staleTask = ctx.scheduler.tasks.get(`${code}:grace:${BOB.id}`)?.task;
      ctx.service.playerConnected(BOB);
      staleTask?.();
      expect(ctx.rooms.get(code)?.game?.phase).toBe('playing');
    });

    it('connecting without a room does nothing', () => {
      const ctx = setup();
      ctx.service.playerConnected(CAROL);
      ctx.service.playerDisconnected(CAROL.id);
      expect(ctx.notifier.sent).toEqual([]);
    });
  });

  describe('chat', () => {
    it('broadcasts a message to the room with an id and timestamp', () => {
      const ctx = setup();
      lobby(ctx);
      expect(ctx.service.sendChat(ALICE.id, { type: 'preset', value: 'gg' })).toEqual({ ok: true });
      expect(ctx.notifier.last(BOB.id, ServerEvents.ChatMessage)).toEqual({
        id: expect.any(String),
        playerId: ALICE.id,
        type: 'preset',
        value: 'gg',
        sentAt: ctx.clock.time,
      });
    });

    it('allows one message per second per player', () => {
      const ctx = setup();
      lobby(ctx);
      ctx.service.sendChat(ALICE.id, { type: 'emoji', value: '🔥' });
      ctx.clock.advance(999);
      expect(ctx.service.sendChat(ALICE.id, { type: 'emoji', value: '🔥' })).toEqual({
        ok: false,
        error: 'RATE_LIMITED',
      });
      expect(ctx.service.sendChat(BOB.id, { type: 'emoji', value: '🔥' })).toEqual({ ok: true });
      ctx.clock.advance(1);
      expect(ctx.service.sendChat(ALICE.id, { type: 'text', value: 'ok' })).toEqual({ ok: true });
    });

    it('refuses chat from a player in no room', () => {
      const ctx = setup();
      expect(ctx.service.sendChat(CAROL.id, { type: 'preset', value: 'gg' })).toEqual({
        ok: false,
        error: 'NOT_IN_ROOM',
      });
    });
  });

  describe('room state', () => {
    it('includes the server time so clients can correct their clock', () => {
      const ctx = setup();
      ctx.service.createRoom(ALICE);
      expect(ctx.notifier.last(ALICE.id, ServerEvents.RoomState).serverTime).toBe(ctx.clock.time);
    });
  });

  describe('idle room cleanup', () => {
    it('removes rooms idle for longer than the limit, and only those', () => {
      const ctx = setup();
      const oldCode = lobby(ctx);
      ctx.clock.advance(31 * 60_000);
      ctx.service.createRoom(CAROL);
      expect(ctx.service.cleanupIdleRooms()).toBe(1);
      expect(ctx.rooms.get(oldCode)).toBeUndefined();
      expect(ctx.rooms.findByPlayer(CAROL.id)).toBeDefined();
    });
  });

  describe('SECURITY: hidden mines', () => {
    it("no event a player receives before game over contains the opponent's unexploded mines", () => {
      const ctx = setup();
      playing(ctx);
      drop(ctx, ALICE.id, 3); // explosion: (3,5) becomes public, Bob's (6,1) stays secret
      drop(ctx, BOB.id, 0);
      ctx.service.playerDisconnected(ALICE.id);
      ctx.service.playerConnected(ALICE); // reconnection resends the whole state

      const secretFromAlice = [{ col: 6, row: 1 }];
      const secretFromBob = ALICE_MINES;
      const leaks = (playerId: PlayerId, secret: Cell[]) =>
        ctx.notifier
          .receivedBy(playerId)
          .flatMap((e) => cellsIn(e.payload).map((c) => ({ event: e.event, ...c })))
          .filter((c) => secret.some((s) => s.col === c.col && s.row === c.row));

      expect(leaks(ALICE.id, secretFromAlice)).toEqual([]);
      expect(leaks(BOB.id, secretFromBob)).toEqual([]);
    });
  });
});
