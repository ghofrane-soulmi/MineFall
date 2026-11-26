/**
 * Application settings, read once from environment variables (like Laravel's config/*.php
 * reading .env). Everything else receives them through dependency injection.
 */
import {
  DISCONNECT_GRACE_MS,
  PLACEMENT_DURATION_MS,
  ROOM_IDLE_TIMEOUT_MS,
  TURN_DURATION_MS,
} from '@minefall/shared';

export interface GameTimings {
  readonly placementMs: number;
  readonly turnMs: number;
  readonly disconnectGraceMs: number;
  readonly roomIdleMs: number;
  readonly cleanupIntervalMs: number;
  /** Minebot thinks for a random time in this range before acting. */
  readonly botThinkMinMs: number;
  readonly botThinkMaxMs: number;
}

export interface AppConfig {
  readonly port: number;
  readonly corsOrigins: readonly string[];
  readonly jwtSecret: string;
  /** PostgreSQL connection string; null = run without saving finished games. */
  readonly databaseUrl: string | null;
  readonly timings: GameTimings;
}

/** Injection tokens. Interfaces do not exist at runtime, so Nest needs a value to key on. */
export const APP_CONFIG = Symbol('APP_CONFIG');
export const CLOCK = Symbol('CLOCK');
export const RNG = Symbol('RNG');

/** Current time in epoch milliseconds. Injected so tests can control time. */
export type Clock = () => number;

const DEV_JWT_SECRET = 'minefall-dev-secret-do-not-use-in-production';

export const DEFAULT_TIMINGS: GameTimings = {
  placementMs: PLACEMENT_DURATION_MS,
  turnMs: TURN_DURATION_MS,
  disconnectGraceMs: DISCONNECT_GRACE_MS,
  roomIdleMs: ROOM_IDLE_TIMEOUT_MS,
  cleanupIntervalMs: 60_000,
  botThinkMinMs: 700,
  botThinkMaxMs: 1_500,
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = env['NODE_ENV'] === 'production';
  const jwtSecret = env['JWT_SECRET'] ?? (isProduction ? undefined : DEV_JWT_SECRET);
  if (!jwtSecret) throw new Error('JWT_SECRET must be set in production');

  return {
    port: Number(env['PORT'] ?? 3000),
    corsOrigins: (env['CORS_ORIGIN'] ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    jwtSecret,
    databaseUrl: env['DATABASE_URL'] || null,
    timings: DEFAULT_TIMINGS,
  };
}
