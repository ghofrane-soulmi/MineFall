/**
 * Real PostgreSQL test for PrismaGameRecorder. Runs only when TEST_DATABASE_URL points to a
 * migrated database (CI does this; locally: docker compose up -d postgres + db:migrate).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { FinishedGameRecord } from '../src/persistence/game-recorder';
import { PrismaGameRecorder, createPrismaClient } from '../src/persistence/prisma-game-recorder';

const databaseUrl = process.env['TEST_DATABASE_URL'];

describe.runIf(databaseUrl)('PrismaGameRecorder (real PostgreSQL)', () => {
  const prisma = createPrismaClient(databaseUrl ?? '');
  const recorder = new PrismaGameRecorder(prisma);
  afterAll(() => recorder.onModuleDestroy());

  function record(): FinishedGameRecord {
    const red = { id: randomUUID(), nickname: 'Red' };
    const yellow = { id: randomUUID(), nickname: 'Yellow' };
    return {
      roomCode: 'TEST42',
      players: [red, yellow],
      result: { type: 'win', winnerId: red.id, winningLine: [] },
      startedAt: new Date('2026-01-01T10:00:00Z'),
      endedAt: new Date('2026-01-01T10:03:00Z'),
      mines: [
        { ownerId: yellow.id, col: 3, row: 5, exploded: true, explodedAtMove: 1 },
        { ownerId: red.id, col: 0, row: 1, exploded: false, explodedAtMove: null },
      ],
      moves: [
        {
          moveNumber: 1,
          playerId: red.id,
          column: 3,
          landedRow: 5,
          outcome: 'exploded',
          timedOut: false,
          playedAt: new Date('2026-01-01T10:01:00Z'),
        },
        {
          moveNumber: 2,
          playerId: yellow.id,
          column: 0,
          landedRow: 5,
          outcome: 'placed',
          timedOut: true,
          playedAt: new Date('2026-01-01T10:02:00Z'),
        },
      ],
    };
  }

  it('stores the game with its users, mines and moves', async () => {
    const id = await recorder.record(record());
    const stored = await prisma.game.findUniqueOrThrow({
      where: { id },
      include: { mines: true, moves: { orderBy: { moveNumber: 'asc' } }, winner: true },
    });
    expect(stored).toMatchObject({ roomCode: 'TEST42', result: 'win' });
    expect(stored.winner?.nickname).toBe('Red');
    expect(stored.mines).toHaveLength(2);
    expect(stored.moves.map((m) => [m.outcome, m.timedOut])).toEqual([
      ['exploded', false],
      ['placed', true],
    ]);
  });

  it('upserts returning guests: nickname updated, no duplicate user', async () => {
    const first = record();
    await recorder.record(first);
    await recorder.record({
      ...first,
      players: [{ ...first.players[0], nickname: 'Renamed' }, first.players[1]],
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: first.players[0].id } });
    expect(user.nickname).toBe('Renamed');
    expect(await prisma.game.count({ where: { player1Id: user.id } })).toBe(2);
  });

  it('stores a draw without a winner', async () => {
    const id = await recorder.record({ ...record(), result: { type: 'draw' } });
    const stored = await prisma.game.findUniqueOrThrow({ where: { id } });
    expect(stored.winnerId).toBeNull();
  });
});
