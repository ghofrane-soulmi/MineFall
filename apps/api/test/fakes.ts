/**
 * Test doubles for GameService unit tests: a scheduler you fire by hand, a notifier that
 * records every emit (and who would receive it), and a clock you move forward manually.
 */
import type {
  GuestIdentity,
  PlayerId,
  Rng,
  ServerPayload,
  ServerToClientEvents,
} from '@minefall/shared';
import { DEFAULT_TIMINGS, type AppConfig, type GameTimings } from '../src/config/app-config';
import { GameNotifier } from '../src/game/game-notifier';
import { GameRecorder, type FinishedGameRecord } from '../src/persistence/game-recorder';
import { Scheduler } from '../src/game/scheduler';

type ServerEvent = keyof ServerToClientEvents;

export interface SentEvent {
  readonly event: ServerEvent;
  readonly payload: unknown;
  /** Players who would receive it (resolved at send time). */
  readonly recipients: readonly PlayerId[];
}

export class FakeNotifier extends GameNotifier {
  readonly sent: SentEvent[] = [];
  private readonly members = new Map<string, Set<PlayerId>>();

  toPlayer<E extends ServerEvent>(playerId: PlayerId, event: E, payload: ServerPayload<E>): void {
    this.sent.push({ event, payload, recipients: [playerId] });
  }

  toRoom<E extends ServerEvent>(code: string, event: E, payload: ServerPayload<E>): void {
    this.sent.push({ event, payload, recipients: [...(this.members.get(code) ?? [])] });
  }

  joinRoom(playerId: PlayerId, code: string): void {
    const set = this.members.get(code) ?? new Set<PlayerId>();
    set.add(playerId);
    this.members.set(code, set);
  }

  leaveRoom(playerId: PlayerId, code: string): void {
    this.members.get(code)?.delete(playerId);
  }

  /** Every event a player received, optionally filtered by name. */
  receivedBy(playerId: PlayerId, event?: ServerEvent): SentEvent[] {
    return this.sent.filter(
      (s) => s.recipients.includes(playerId) && (event === undefined || s.event === event),
    );
  }

  /** Payload of the last `event` a player received. */
  last<E extends ServerEvent>(playerId: PlayerId, event: E): ServerPayload<E> {
    const found = this.receivedBy(playerId, event).at(-1);
    if (!found) throw new Error(`${playerId} never received ${event}`);
    return found.payload as ServerPayload<E>;
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export class FakeScheduler extends Scheduler {
  readonly tasks = new Map<string, { delayMs: number; task: () => void }>();

  schedule(key: string, delayMs: number, task: () => void): void {
    this.tasks.set(key, { delayMs, task });
  }

  cancel(key: string): void {
    this.tasks.delete(key);
  }

  cancelByPrefix(prefix: string): void {
    for (const key of [...this.tasks.keys()]) if (key.startsWith(prefix)) this.tasks.delete(key);
  }

  /** Simulates the timer firing. */
  fire(key: string): void {
    const entry = this.tasks.get(key);
    if (!entry) throw new Error(`no timer "${key}" (have: ${[...this.tasks.keys()].join(', ')})`);
    this.tasks.delete(key);
    entry.task();
  }
}

export class FakeClock {
  constructor(public time = 1_000_000) {}
  readonly now = (): number => this.time;
  advance(ms: number): void {
    this.time += ms;
  }
}

/** RNG returning the given values in a loop. */
export function sequenceRng(...values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length] as number;
}

export function testConfig(timings: Partial<GameTimings> = {}): AppConfig {
  return {
    port: 0,
    corsOrigins: ['http://localhost:5173'],
    jwtSecret: 'test-secret',
    databaseUrl: null,
    timings: { ...DEFAULT_TIMINGS, ...timings },
  };
}

export const ALICE: GuestIdentity = { id: 'alice-id', nickname: 'Alice' };
export const BOB: GuestIdentity = { id: 'bob-id', nickname: 'Bob' };
export const CAROL: GuestIdentity = { id: 'carol-id', nickname: 'Carol' };

/** Every {col,row} object anywhere inside a payload. */
export function cellsIn(payload: unknown): { col: number; row: number }[] {
  const found: { col: number; row: number }[] = [];
  JSON.parse(JSON.stringify(payload), (_key, value: unknown) => {
    if (value && typeof value === 'object' && 'col' in value && 'row' in value) {
      found.push(value as { col: number; row: number });
    }
    return value;
  });
  return found;
}

export class FakeRecorder extends GameRecorder {
  readonly recorded: FinishedGameRecord[] = [];
  failWith: Error | null = null;

  record(game: FinishedGameRecord): Promise<string> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.recorded.push(game);
    return Promise.resolve(`game-${this.recorded.length}`);
  }
}
