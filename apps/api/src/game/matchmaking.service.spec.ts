import { ServerEvents } from '@minefall/shared';
import { describe, expect, it } from 'vitest';
import {
  ALICE,
  BOB,
  CAROL,
  FakeClock,
  FakeNotifier,
  FakeRecorder,
  FakeScheduler,
  seededRng,
  testConfig,
} from '../../test/fakes';
import { RoomsService } from '../rooms/rooms.service';
import { GameService } from './game.service';
import { MatchmakingService } from './matchmaking.service';

function setup() {
  const notifier = new FakeNotifier();
  const rooms = new RoomsService();
  const game = new GameService(
    rooms,
    new FakeScheduler(),
    notifier,
    new FakeRecorder(),
    testConfig(),
    new FakeClock().now,
    seededRng(1),
  );
  return { matchmaking: new MatchmakingService(game, rooms, notifier), rooms, notifier, game };
}

describe('MatchmakingService (quick match)', () => {
  it('the first player waits', () => {
    const { matchmaking, notifier } = setup();
    expect(matchmaking.join(ALICE)).toEqual({ ok: true });
    expect(matchmaking.isWaiting(ALICE.id)).toBe(true);
    expect(notifier.sent).toEqual([]);
  });

  it('the second player is matched with the first; both get the room code and the game starts', () => {
    const { matchmaking, rooms, notifier } = setup();
    matchmaking.join(ALICE);
    expect(matchmaking.join(BOB)).toEqual({ ok: true });

    const code = notifier.last(ALICE.id, ServerEvents.QueueMatched).code;
    expect(notifier.last(BOB.id, ServerEvents.QueueMatched).code).toBe(code);
    const room = rooms.get(code);
    expect(room?.members.map((m) => m.id)).toEqual([ALICE.id, BOB.id]);
    expect(room?.game?.phase).toBe('placement');
    expect(notifier.receivedBy(BOB.id, ServerEvents.DiceRolled)).toHaveLength(1);
    expect(matchmaking.size).toBe(0);
  });

  it('pairs players in arrival order', () => {
    const { matchmaking, rooms } = setup();
    matchmaking.join(ALICE);
    matchmaking.join(BOB); // Alice + Bob
    matchmaking.join(CAROL); // Carol waits
    expect(rooms.findByPlayer(ALICE.id)).toBe(rooms.findByPlayer(BOB.id));
    expect(matchmaking.isWaiting(CAROL.id)).toBe(true);
  });

  it('joining twice (double click, second tab) does not match a player with themself', () => {
    const { matchmaking } = setup();
    matchmaking.join(ALICE);
    expect(matchmaking.join(ALICE)).toEqual({ ok: true });
    expect(matchmaking.size).toBe(1);
  });

  it('cancel removes the player from the queue', () => {
    const { matchmaking, rooms } = setup();
    matchmaking.join(ALICE);
    expect(matchmaking.leave(ALICE.id)).toEqual({ ok: true });
    matchmaking.join(BOB);
    expect(rooms.findByPlayer(BOB.id)).toBeUndefined();
    expect(matchmaking.isWaiting(BOB.id)).toBe(true);
  });

  it('a player already in a room cannot queue', () => {
    const { matchmaking, game } = setup();
    game.createRoom(ALICE);
    expect(matchmaking.join(ALICE)).toEqual({ ok: false, error: 'ALREADY_IN_ROOM' });
  });
});
