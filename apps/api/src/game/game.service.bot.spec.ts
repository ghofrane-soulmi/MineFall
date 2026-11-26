import { ServerEvents, getValidColumns } from '@minefall/shared';
import { describe, expect, it } from 'vitest';
import {
  ALICE,
  FakeClock,
  FakeNotifier,
  FakeRecorder,
  FakeScheduler,
  seededRng,
  testConfig,
} from '../../test/fakes';
import { BOT_IDS, RoomsService } from '../rooms/rooms.service';
import { GameService } from './game.service';

function setup(seed = 7) {
  const clock = new FakeClock();
  const notifier = new FakeNotifier();
  const scheduler = new FakeScheduler();
  const rooms = new RoomsService();
  const recorder = new FakeRecorder();
  const service = new GameService(
    rooms,
    scheduler,
    notifier,
    recorder,
    testConfig(),
    clock.now,
    seededRng(seed),
  );
  return { service, rooms, notifier, scheduler, recorder };
}
type Ctx = ReturnType<typeof setup>;

function botRoom(ctx: Ctx, level: 'easy' | 'normal' = 'normal'): string {
  const ack = ctx.service.createRoom(ALICE, level);
  if (!ack.ok) throw new Error(ack.error);
  return ack.data.code;
}

/** Plays the game to the end: Alice takes the first valid column, Minebot acts on its timer. */
function playToEnd(ctx: Ctx, code: string): void {
  ctx.service.placeMines(ALICE.id, {
    cells: [
      { col: 0, row: 1 },
      { col: 6, row: 1 },
    ],
  });
  for (let step = 0; step < 200; step++) {
    const game = ctx.rooms.get(code)?.game;
    if (!game || game.phase === 'finished') return;
    if (ctx.scheduler.tasks.has(`${code}:bot`)) {
      ctx.scheduler.fire(`${code}:bot`);
    } else if (game.phase === 'playing' && game.currentPlayerId === ALICE.id) {
      const [column] = getValidColumns(game.board, game.blockedColumns);
      ctx.service.dropToken(ALICE.id, { column: column ?? 0, turnId: game.turnId });
    } else {
      throw new Error(`stuck in phase ${game.phase}`);
    }
  }
  throw new Error('game did not finish');
}

describe('GameService: playing against Minebot', () => {
  it('creates the room with Minebot and starts the game at once', () => {
    const ctx = setup();
    const code = botRoom(ctx);
    const room = ctx.rooms.get(code);

    expect(room?.members.map((m) => [m.nickname, m.bot])).toEqual([
      ['Alice', null],
      ['Minebot', 'normal'],
    ]);
    expect(room?.game?.phase).toBe('placement');
    expect(ctx.notifier.last(ALICE.id, ServerEvents.DiceRolled).rounds.length).toBeGreaterThan(0);
    expect(ctx.notifier.last(ALICE.id, ServerEvents.ChatMessage)).toMatchObject({
      playerId: BOT_IDS.normal,
      value: 'good-luck',
    });
    expect(ctx.scheduler.tasks.has(`${code}:bot`)).toBe(true); // Minebot will hide its mines
  });

  it('Minebot hides its mines on its timer, like a player', () => {
    const ctx = setup();
    const code = botRoom(ctx);
    ctx.scheduler.fire(`${code}:bot`);
    expect(ctx.rooms.get(code)?.game?.minesConfirmed[BOT_IDS.normal]).toBe(true);
    expect(ctx.notifier.last(ALICE.id, ServerEvents.MinesConfirmed).playerId).toBe(BOT_IDS.normal);
  });

  it.each([1, 2, 3, 4, 5, 6])('plays complete games to the end (seed %i)', (seed) => {
    const ctx = setup(seed);
    const code = botRoom(ctx, seed % 2 ? 'easy' : 'normal');
    playToEnd(ctx, code);

    const over = ctx.notifier.last(ALICE.id, ServerEvents.GameOver);
    expect(['win', 'draw']).toContain(over.result.type);
    const botIds: string[] = Object.values(BOT_IDS);
    const botMoves = ctx.notifier
      .receivedBy(ALICE.id, ServerEvents.MoveResult)
      .filter((e) => botIds.includes((e.payload as { playerId: string }).playerId));
    expect(botMoves.length).toBeGreaterThan(0);
    expect(ctx.recorder.recorded).toHaveLength(1);
  });

  it('after the game Minebot says GG and accepts a rematch straight away', () => {
    const ctx = setup(3);
    const code = botRoom(ctx);
    playToEnd(ctx, code);

    expect(ctx.notifier.last(ALICE.id, ServerEvents.ChatMessage).value).toBe('gg');
    const bot = ctx.notifier
      .last(ALICE.id, ServerEvents.RoomPlayers)
      .players.find((p) => p.bot !== null);
    expect(bot?.wantsRematch).toBe(true);

    expect(ctx.service.requestRematch(ALICE.id)).toEqual({ ok: true });
    expect(ctx.rooms.get(code)?.game?.phase).toBe('placement');
  });

  it('leaving a bot room deletes it and stops Minebot', () => {
    const ctx = setup();
    const code = botRoom(ctx);
    ctx.service.leaveRoom(ALICE.id);
    expect(ctx.rooms.get(code)).toBeUndefined();
    expect([...ctx.scheduler.tasks.keys()].some((k) => k.startsWith(code))).toBe(false);
  });
});
