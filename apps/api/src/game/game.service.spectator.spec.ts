import { MAX_SPECTATORS, ServerEvents, type Cell } from '@minefall/shared';
import { describe, expect, it } from 'vitest';
import {
  ALICE,
  BOB,
  CAROL,
  FakeClock,
  FakeNotifier,
  FakeRecorder,
  FakeScheduler,
  cellsIn,
  sequenceRng,
  testConfig,
} from '../../test/fakes';
import { RoomsService } from '../rooms/rooms.service';
import { GameService } from './game.service';

const ALICE_MINES: Cell[] = [
  { col: 0, row: 1 },
  { col: 1, row: 1 },
];
const BOB_MINES: Cell[] = [
  { col: 3, row: 5 },
  { col: 6, row: 1 },
];

function setup() {
  const notifier = new FakeNotifier();
  const rooms = new RoomsService();
  const service = new GameService(
    rooms,
    new FakeScheduler(),
    notifier,
    new FakeRecorder(),
    testConfig(),
    new FakeClock().now,
    sequenceRng(0.99, 0.99, 0, 0), // Alice starts
  );
  return { service, rooms, notifier };
}
type Ctx = ReturnType<typeof setup>;

/** Alice and Bob in a game with mines placed; returns the room code. */
function runningGame(ctx: Ctx): string {
  const created = ctx.service.createRoom(ALICE);
  if (!created.ok) throw new Error(created.error);
  const { code } = created.data;
  ctx.service.joinRoom(BOB, code);
  ctx.service.setReady(ALICE.id, true);
  ctx.service.setReady(BOB.id, true);
  ctx.service.placeMines(ALICE.id, { cells: ALICE_MINES });
  ctx.service.placeMines(BOB.id, { cells: BOB_MINES });
  return code;
}

describe('GameService: spectators', () => {
  it('a spectator receives the room as a spectator, with no mines at all', () => {
    const ctx = setup();
    const code = runningGame(ctx);
    expect(ctx.service.watchRoom(CAROL, code)).toEqual({ ok: true });

    const state = ctx.notifier.last(CAROL.id, ServerEvents.RoomState);
    expect(state.role).toBe('spectator');
    expect(state.game?.ownMines).toEqual([]);
    expect(state.room.spectatorCount).toBe(1);
    expect(ctx.notifier.last(ALICE.id, ServerEvents.RoomPlayers).spectatorCount).toBe(1);
  });

  it('a spectator who arrived during placement learns who moves first when play starts', () => {
    const ctx = setup();
    const created = ctx.service.createRoom(ALICE);
    if (!created.ok) throw new Error(created.error);
    const { code } = created.data;
    ctx.service.joinRoom(BOB, code);
    ctx.service.setReady(ALICE.id, true);
    ctx.service.setReady(BOB.id, true);
    ctx.service.watchRoom(CAROL, code); // watching during mine placement
    ctx.service.placeMines(ALICE.id, { cells: ALICE_MINES });
    ctx.service.placeMines(BOB.id, { cells: BOB_MINES });

    const state = ctx.notifier.last(CAROL.id, ServerEvents.RoomState);
    expect(state.game?.phase).toBe('playing');
    expect(state.game?.currentPlayerId).toBe(ALICE.id);
    expect(state.game?.ownMines).toEqual([]);
  });

  it('players still get role "player"', () => {
    const ctx = setup();
    runningGame(ctx);
    expect(ctx.notifier.last(ALICE.id, ServerEvents.RoomState).role).toBe('player');
  });

  it('a spectator follows the game live (moves are broadcast to them)', () => {
    const ctx = setup();
    const code = runningGame(ctx);
    ctx.service.watchRoom(CAROL, code);
    const turnId = ctx.rooms.get(code)?.game?.turnId ?? -1;
    ctx.service.dropToken(ALICE.id, { column: 0, turnId });
    expect(ctx.notifier.last(CAROL.id, ServerEvents.MoveResult).playerId).toBe(ALICE.id);
  });

  it('spectators cannot act: play, place mines, chat or rematch', () => {
    const ctx = setup();
    const code = runningGame(ctx);
    ctx.service.watchRoom(CAROL, code);
    const notInRoom = { ok: false, error: 'NOT_IN_ROOM' };
    expect(ctx.service.dropToken(CAROL.id, { column: 0, turnId: 1 })).toEqual(notInRoom);
    expect(ctx.service.placeMines(CAROL.id, { cells: ALICE_MINES })).toEqual(notInRoom);
    expect(ctx.service.sendChat(CAROL.id, { type: 'preset', value: 'gg' })).toEqual(notInRoom);
    expect(ctx.service.requestRematch(CAROL.id)).toEqual(notInRoom);
  });

  it('SECURITY: nothing a spectator receives before game over contains any unexploded mine', () => {
    const ctx = setup();
    const code = runningGame(ctx);
    ctx.service.watchRoom(CAROL, code);
    const turnId = () => ctx.rooms.get(code)?.game?.turnId ?? -1;
    ctx.service.dropToken(ALICE.id, { column: 3, turnId: turnId() }); // explodes Bob's (3,5)
    ctx.service.dropToken(BOB.id, { column: 0, turnId: turnId() });
    ctx.service.playerDisconnected(CAROL.id); // refresh: the spectator leaves...
    ctx.service.watchRoom(CAROL, code); // ...and comes back

    const secret = [...ALICE_MINES, { col: 6, row: 1 }];
    const leaked = ctx.notifier
      .receivedBy(CAROL.id)
      .flatMap((e) => cellsIn(e.payload))
      .filter((c) => secret.some((s) => s.col === c.col && s.row === c.row));
    expect(leaked).toEqual([]);
  });

  it('a spectator who reopens the link of a full room is resynced as a spectator', () => {
    const ctx = setup();
    const code = runningGame(ctx);
    ctx.service.watchRoom(CAROL, code);
    expect(ctx.service.joinRoom(CAROL, code)).toEqual({ ok: true });
    expect(ctx.notifier.last(CAROL.id, ServerEvents.RoomState).role).toBe('spectator');
  });

  it('a spectator takes a free seat when joining a room that has one', () => {
    const ctx = setup();
    const created = ctx.service.createRoom(ALICE);
    if (!created.ok) throw new Error(created.error);
    ctx.service.watchRoom(CAROL, created.data.code);
    expect(ctx.service.joinRoom(CAROL, created.data.code)).toEqual({ ok: true });
    expect(ctx.rooms.get(created.data.code)?.spectators.size).toBe(0);
    expect(ctx.notifier.last(CAROL.id, ServerEvents.RoomState).role).toBe('player');
  });

  it('stop watching (leave) and disconnecting remove the spectator', () => {
    const ctx = setup();
    const code = runningGame(ctx);
    ctx.service.watchRoom(CAROL, code);
    expect(ctx.service.leaveRoom(CAROL.id)).toEqual({ ok: true });
    expect(ctx.rooms.get(code)?.spectators.size).toBe(0);
    expect(ctx.rooms.get(code)?.game?.phase).toBe('playing'); // no forfeit for spectators
  });

  it('refuses unknown rooms, players of another room, and more than the limit', () => {
    const ctx = setup();
    const code = runningGame(ctx);
    expect(ctx.service.watchRoom(CAROL, 'ZZZZZZ')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });

    const other = setup();
    const otherCode = runningGame(other);
    other.service.createRoom(CAROL);
    expect(other.service.watchRoom(CAROL, otherCode)).toEqual({
      ok: false,
      error: 'ALREADY_IN_ROOM',
    });

    for (let i = 0; i < MAX_SPECTATORS; i++) {
      expect(ctx.service.watchRoom({ id: `viewer-${i}`, nickname: `V${i}` }, code).ok).toBe(true);
    }
    expect(ctx.service.watchRoom(CAROL, code)).toEqual({ ok: false, error: 'ROOM_FULL' });
  });
});
