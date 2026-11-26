/**
 * Accounts (SPEC F15): a guest becomes an account by adding an email + password. The player
 * id does not change, so every game already saved under it stays theirs. Login returns a
 * normal player token for that id, on any device.
 */
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import {
  isValidPassword,
  normalizeEmail,
  type AccountErrorCode,
  type GuestIdentity,
  type GuestSession,
} from '@minefall/shared';
import { AuthService } from '../auth/auth.service';
import { CLOCK, type Clock } from '../config/app-config';
import { Database } from '../persistence/database';
import type { PrismaClient } from '../generated/prisma/client';
import { LoginThrottle } from './login-throttle';
import { DUMMY_HASH_PROMISE, hashPassword, verifyPassword } from './passwords';

const MESSAGES: Record<AccountErrorCode, string> = {
  INVALID_EMAIL: 'Please enter a valid email address.',
  WEAK_PASSWORD: 'Passwords need at least 8 characters.',
  EMAIL_TAKEN: 'An account already uses this email.',
  ALREADY_REGISTERED: 'You already have an account.',
  INVALID_CREDENTIALS: 'Wrong email or password.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Please wait a minute.',
  ACCOUNTS_DISABLED: 'Accounts are not available on this server (no database).',
};

const STATUS: Record<AccountErrorCode, HttpStatus> = {
  INVALID_EMAIL: HttpStatus.BAD_REQUEST,
  WEAK_PASSWORD: HttpStatus.BAD_REQUEST,
  EMAIL_TAKEN: HttpStatus.CONFLICT,
  ALREADY_REGISTERED: HttpStatus.CONFLICT,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  TOO_MANY_ATTEMPTS: HttpStatus.TOO_MANY_REQUESTS,
  ACCOUNTS_DISABLED: HttpStatus.SERVICE_UNAVAILABLE,
};

/** HTTP error with a stable `{ error, message }` body the client can switch on. */
export function accountError(code: AccountErrorCode): HttpException {
  const body = { error: code, message: MESSAGES[code] };
  switch (STATUS[code]) {
    case HttpStatus.BAD_REQUEST:
      return new BadRequestException(body);
    case HttpStatus.CONFLICT:
      return new ConflictException(body);
    case HttpStatus.UNAUTHORIZED:
      return new UnauthorizedException(body);
    case HttpStatus.SERVICE_UNAVAILABLE:
      return new ServiceUnavailableException(body);
    default:
      return new HttpException(body, STATUS[code]);
  }
}

@Injectable()
export class AccountsService {
  private readonly throttle = new LoginThrottle();

  constructor(
    private readonly db: Database,
    private readonly auth: AuthService,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  /** Turns the current guest into an account (same id, same nickname). */
  async register(player: GuestIdentity, body: unknown): Promise<GuestSession> {
    const client = this.requireDatabase();
    const email = normalizeEmail(field(body, 'email'));
    const password = field(body, 'password');
    if (!email) throw accountError('INVALID_EMAIL');
    if (!isValidPassword(password)) throw accountError('WEAK_PASSWORD');

    const existing = await client.user.findUnique({ where: { id: player.id } });
    if (existing?.email) throw accountError('ALREADY_REGISTERED');
    if (await client.user.findUnique({ where: { email } })) throw accountError('EMAIL_TAKEN');

    const passwordHash = await hashPassword(password);
    try {
      await client.user.upsert({
        where: { id: player.id },
        create: { id: player.id, nickname: player.nickname, email, passwordHash, isGuest: false },
        update: { nickname: player.nickname, email, passwordHash, isGuest: false },
      });
    } catch (error) {
      // Two sign-ups with the same email at the same instant: the unique index decides.
      if (isUniqueViolation(error)) throw accountError('EMAIL_TAKEN');
      throw error;
    }
    return this.auth.issue(player, email);
  }

  async login(body: unknown): Promise<GuestSession> {
    const client = this.requireDatabase();
    const email = normalizeEmail(field(body, 'email'));
    const password = field(body, 'password');
    if (!email || typeof password !== 'string') throw accountError('INVALID_CREDENTIALS');
    if (this.throttle.isBlocked(email, this.now())) throw accountError('TOO_MANY_ATTEMPTS');

    const user = await client.user.findUnique({ where: { email } });
    // Always run one hash check, so "unknown email" and "wrong password" take the same time.
    const valid = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH_PROMISE));
    if (!user || !valid) {
      this.throttle.recordFailure(email, this.now());
      throw accountError('INVALID_CREDENTIALS');
    }
    this.throttle.reset(email);
    return this.auth.issue({ id: user.id, nickname: user.nickname }, email);
  }

  private requireDatabase(): PrismaClient {
    if (!this.db.client) throw accountError('ACCOUNTS_DISABLED');
    return this.db.client;
  }
}

function field(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null ? Reflect.get(body, name) : undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'code') === 'P2002';
}
