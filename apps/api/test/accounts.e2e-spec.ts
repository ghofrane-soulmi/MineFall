/**
 * Accounts + profile over real HTTP. The first block needs no database; the second runs
 * against a real, migrated PostgreSQL when TEST_DATABASE_URL is set (CI does this).
 */
import { randomUUID } from 'node:crypto';
import type { GuestSession, ProfileResponse } from '@minefall/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaGameRecorder, createPrismaClient } from '../src/persistence/prisma-game-recorder';
import { BOT_IDS } from '../src/rooms/rooms.service';
import { createGuest, startServer, type TestServer } from './socket-helpers';

describe('accounts without a database', () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startServer();
  });
  afterAll(() => server.app.close());

  it('profile and register need a token (401)', async () => {
    const http = request(server.app.getHttpServer());
    await http.get('/me/profile').expect(401);
    await http.get('/me/profile').set('Authorization', 'Bearer forged').expect(401);
    await http.post('/auth/register').send({ email: 'a@b.co', password: '12345678' }).expect(401);
  });

  it('answers 503 ACCOUNTS_DISABLED when the server runs without a database', async () => {
    const guest = await createGuest(server, 'NoDb');
    const res = await request(server.app.getHttpServer())
      .get('/me/profile')
      .set('Authorization', `Bearer ${guest.token}`)
      .expect(503);
    expect(res.body).toMatchObject({ error: 'ACCOUNTS_DISABLED' });
  });
});

const databaseUrl = process.env['TEST_DATABASE_URL'];

describe.runIf(databaseUrl)('accounts + profile (real PostgreSQL)', () => {
  let server: TestServer;
  const prisma = createPrismaClient(databaseUrl ?? '');
  beforeAll(async () => {
    server = await startServer({}, undefined, databaseUrl);
  });
  afterAll(async () => {
    await server.app.close();
    await prisma.$disconnect();
  });

  const http = () => request(server.app.getHttpServer());
  const uniqueEmail = () => `player-${randomUUID().slice(0, 8)}@minefall.test`;

  function register(guest: GuestSession, email: string, password = 'secret-pass') {
    return http()
      .post('/auth/register')
      .set('Authorization', `Bearer ${guest.token}`)
      .send({ email, password });
  }

  it('a guest becomes an account and keeps the same player id', async () => {
    const guest = await createGuest(server, 'Ghof');
    const email = uniqueEmail();
    const res = await register(guest, `  ${email.toUpperCase()} `).expect(201);
    expect(res.body).toMatchObject({ player: guest.player, email });
    expect(res.body.token).not.toBe(guest.token);
  });

  it('rejects bad input, a taken email and a second registration', async () => {
    const guest = await createGuest(server, 'Picky');
    expect((await register(guest, 'not-an-email').expect(400)).body.error).toBe('INVALID_EMAIL');
    expect((await register(guest, uniqueEmail(), 'short').expect(400)).body.error).toBe(
      'WEAK_PASSWORD',
    );

    const email = uniqueEmail();
    await register(guest, email).expect(201);
    expect((await register(guest, uniqueEmail()).expect(409)).body.error).toBe(
      'ALREADY_REGISTERED',
    );
    const other = await createGuest(server, 'Copycat');
    expect((await register(other, email).expect(409)).body.error).toBe('EMAIL_TAKEN');
  });

  it('logs in on "another device" with the same player id; wrong password is refused', async () => {
    const guest = await createGuest(server, 'Traveller');
    const email = uniqueEmail();
    await register(guest, email, 'my-password-1').expect(201);

    const ok = await http()
      .post('/auth/login')
      .send({ email, password: 'my-password-1' })
      .expect(200);
    expect(ok.body).toMatchObject({ player: guest.player, email });

    const bad = await http().post('/auth/login').send({ email, password: 'nope-nope' }).expect(401);
    expect(bad.body.error).toBe('INVALID_CREDENTIALS');
    const unknown = await http()
      .post('/auth/login')
      .send({ email: uniqueEmail(), password: 'whatever1' })
      .expect(401);
    expect(unknown.body.error).toBe('INVALID_CREDENTIALS'); // same answer: no email probing
  });

  it('blocks password guessing after 5 failures', async () => {
    const guest = await createGuest(server, 'Target');
    const email = uniqueEmail();
    await register(guest, email, 'real-password').expect(201);
    for (let i = 0; i < 5; i++) {
      await http()
        .post('/auth/login')
        .send({ email, password: `guess-${i}xx` })
        .expect(401);
    }
    const blocked = await http()
      .post('/auth/login')
      .send({ email, password: 'real-password' })
      .expect(429);
    expect(blocked.body.error).toBe('TOO_MANY_ATTEMPTS');
  });

  it('profile: totals, explosions and recent games computed from saved games', async () => {
    const guest = await createGuest(server, 'Stats');
    const me = guest.player;
    const rival = { id: randomUUID(), nickname: 'Rival' };
    const bot = { id: BOT_IDS.normal, nickname: 'Minebot' };
    const recorder = new PrismaGameRecorder(prisma);
    const base = { roomCode: 'STAT01', startedAt: new Date(1_000), mines: [] };

    // 1. I win vs Rival; Rival stepped on my mine once.
    await recorder.record({
      ...base,
      players: [me, rival],
      result: { type: 'win', winnerId: me.id, winningLine: [] },
      endedAt: new Date(10_000),
      moves: [
        {
          moveNumber: 1,
          playerId: me.id,
          column: 0,
          landedRow: 5,
          outcome: 'placed',
          timedOut: false,
          playedAt: new Date(2_000),
        },
        {
          moveNumber: 2,
          playerId: rival.id,
          column: 3,
          landedRow: 5,
          outcome: 'exploded',
          timedOut: false,
          playedAt: new Date(3_000),
        },
      ],
    });
    // 2. I lose vs Minebot after stepping on its mine.
    await recorder.record({
      ...base,
      players: [bot, me],
      result: { type: 'win', winnerId: bot.id, winningLine: [] },
      endedAt: new Date(20_000),
      moves: [
        {
          moveNumber: 1,
          playerId: me.id,
          column: 2,
          landedRow: 5,
          outcome: 'exploded',
          timedOut: false,
          playedAt: new Date(12_000),
        },
      ],
    });
    // 3. A draw.
    await recorder.record({
      ...base,
      players: [rival, me],
      result: { type: 'draw' },
      endedAt: new Date(30_000),
      moves: [],
    });

    const res = await http()
      .get('/me/profile')
      .set('Authorization', `Bearer ${guest.token}`)
      .expect(200);
    const profile = res.body as ProfileResponse;
    expect(profile.player).toEqual({ ...me, email: null }); // a guest has stats too
    expect(profile.stats).toEqual({
      gamesPlayed: 3,
      wins: 1,
      losses: 1,
      draws: 1,
      winRate: 1 / 3,
      minesStepped: 1,
      trapsTriggered: 1,
    });
    expect(profile.recentGames.map((g) => [g.result, g.reason, g.opponent])).toEqual([
      ['draw', 'draw', { nickname: 'Rival', bot: false }],
      ['loss', 'line', { nickname: 'Minebot', bot: true }],
      ['win', 'line', { nickname: 'Rival', bot: false }],
    ]);
    expect(profile.recentGames[2]?.moveCount).toBe(2);
  });
});
