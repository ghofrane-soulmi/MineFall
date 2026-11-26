/**
 * Accounts and stats (SPEC F15 / F16): HTTP request/response shapes and their validators.
 * An account is a guest who added an email + password: same player id, so past games stay theirs.
 */
import type { PlayerId } from '../types/game';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
const EMAIL_MAX_LENGTH = 254;
/** Pragmatic check (something@something.tld); the real proof would be a confirmation email. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Error codes returned by the account endpoints (HTTP body `{ error, message }`). */
export type AccountErrorCode =
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'EMAIL_TAKEN'
  | 'ALREADY_REGISTERED'
  | 'INVALID_CREDENTIALS'
  | 'TOO_MANY_ATTEMPTS'
  | 'ACCOUNTS_DISABLED';

export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
}
export type LoginRequest = RegisterRequest;

export interface PlayerStats {
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  /** 0..1, wins / games played (0 when no games). */
  readonly winRate: number;
  /** Explosions caused by this player stepping on an opponent's mine. */
  readonly minesStepped: number;
  /** Explosions caused by the opponent stepping on one of this player's mines. */
  readonly trapsTriggered: number;
}

export interface GameHistoryEntry {
  readonly id: string;
  readonly endedAt: string;
  readonly opponent: { readonly nickname: string; readonly bot: boolean };
  readonly result: 'win' | 'loss' | 'draw';
  /** How it ended: four in a row, a forfeit, or a draw. */
  readonly reason: 'line' | 'forfeit' | 'draw';
  readonly moveCount: number;
}

/** GET /me/profile */
export interface ProfileResponse {
  readonly player: {
    readonly id: PlayerId;
    readonly nickname: string;
    readonly email: string | null;
  };
  readonly stats: PlayerStats;
  readonly recentGames: readonly GameHistoryEntry[];
}

/** Lower-cases and trims an email; null if it does not look like one. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email) ? email : null;
}

/** Passwords are kept as typed (no trimming): only their length is checked. */
export function isValidPassword(raw: unknown): raw is string {
  return (
    typeof raw === 'string' &&
    [...raw].length >= PASSWORD_MIN_LENGTH &&
    raw.length <= PASSWORD_MAX_LENGTH
  );
}
