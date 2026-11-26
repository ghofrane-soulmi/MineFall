/**
 * Helpers for integration tests: boot the real Nest app on a random port, create guests over
 * HTTP, connect typed Socket.IO clients and wait for specific server events.
 */
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  SOCKET_NAMESPACE,
  type ClientToServerEvents,
  type GuestSession,
  type Rng,
  type ServerPayload,
  type ServerToClientEvents,
} from '@minefall/shared';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { APP_CONFIG, RNG, type GameTimings } from '../src/config/app-config';
import { testConfig } from './fakes';

export type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type ServerEvent = keyof ServerToClientEvents;

export interface TestServer {
  readonly app: INestApplication;
  readonly url: string;
}

export async function startServer(
  timings: Partial<GameTimings> = {},
  rng?: Rng,
  databaseUrl?: string,
): Promise<TestServer> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue({ ...testConfig(timings), databaseUrl: databaseUrl ?? null });
  if (rng) builder = builder.overrideProvider(RNG).useValue(rng);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.listen(0);
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, url: `http://localhost:${port}` };
}

export async function createGuest(server: TestServer, nickname: string): Promise<GuestSession> {
  const response = await request(server.app.getHttpServer())
    .post('/auth/guest')
    .send({ nickname })
    .expect(201);
  return response.body as GuestSession;
}

/**
 * Connects to the /game namespace; rejects with the server's reason if refused.
 * The recorder is attached BEFORE connecting so no early event (e.g. room:state) is missed.
 */
export function connect(
  server: TestServer,
  token: string | undefined,
): Promise<{ socket: Client; rec: Recorder }> {
  const socket: Client = io(`${server.url}${SOCKET_NAMESPACE}`, {
    auth: token === undefined ? {} : { token },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  const rec = new Recorder(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve({ socket, rec }));
    socket.once('connect_error', (error) => {
      socket.close();
      reject(error);
    });
  });
}

interface Recorded {
  readonly event: string;
  readonly payload: unknown;
}

/**
 * Records every event a socket receives, so a test can await an event even if it arrived
 * before the test started waiting (the server emits before it sends the ack).
 */
export class Recorder {
  readonly events: Recorded[] = [];
  private readonly consumed = new Set<number>();
  private readonly listeners = new Set<() => void>();

  constructor(socket: Client) {
    socket.onAny((event: string, payload: unknown) => {
      this.events.push({ event, payload });
      for (const listener of [...this.listeners]) listener();
    });
  }

  /** Resolves with the first not-yet-consumed `event` matching `predicate`. */
  waitFor<E extends ServerEvent>(
    event: E,
    predicate: (payload: ServerPayload<E>) => boolean = () => true,
    timeoutMs = 5_000,
  ): Promise<ServerPayload<E>> {
    return new Promise((resolve, reject) => {
      const check = (): boolean => {
        const index = this.events.findIndex(
          (e, i) =>
            !this.consumed.has(i) && e.event === event && predicate(e.payload as ServerPayload<E>),
        );
        if (index === -1) return false;
        this.consumed.add(index);
        cleanup();
        resolve(this.events[index]?.payload as ServerPayload<E>);
        return true;
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for "${event}"`));
      }, timeoutMs);
      const cleanup = (): void => {
        clearTimeout(timer);
        this.listeners.delete(onEvent);
      };
      const onEvent = (): void => void check();
      if (!check()) this.listeners.add(onEvent);
    });
  }

  /** Every payload received so far for `event`. */
  all<E extends ServerEvent>(event: E): ServerPayload<E>[] {
    return this.events.filter((e) => e.event === event).map((e) => e.payload as ServerPayload<E>);
  }
}

/** A connected test player: their session, socket and event recorder. */
export interface TestPlayer {
  readonly id: string;
  readonly session: GuestSession;
  socket: Client;
  rec: Recorder;
}

export async function joinAsGuest(server: TestServer, nickname: string): Promise<TestPlayer> {
  const session = await createGuest(server, nickname);
  const { socket, rec } = await connect(server, session.token);
  return { id: session.player.id, session, socket, rec };
}

/** Simulates a page refresh: close the socket, open a new one with the same token. */
export async function reconnect(server: TestServer, player: TestPlayer): Promise<void> {
  player.socket.close();
  const { socket, rec } = await connect(server, player.session.token);
  player.socket = socket;
  player.rec = rec;
}
