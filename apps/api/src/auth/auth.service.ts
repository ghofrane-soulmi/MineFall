/**
 * Guest identities: a random player id + nickname, signed as a JWT so the server can trust
 * it on every socket connection without storing sessions.
 */
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { normalizeNickname, type GuestIdentity, type GuestSession } from '@minefall/shared';

interface GuestTokenClaims {
  readonly sub: string;
  readonly nickname: string;
  readonly guest: true;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  /** Returns a new guest session, or null if the nickname breaks the rules. */
  createGuest(rawNickname: unknown): GuestSession | null {
    const nickname = normalizeNickname(rawNickname);
    if (!nickname) return null;
    const player: GuestIdentity = { id: randomUUID(), nickname };
    const claims: GuestTokenClaims = { sub: player.id, nickname, guest: true };
    return { token: this.jwt.sign(claims), player };
  }

  /** Verifies a token; returns the identity or null for a missing, forged or expired token. */
  verify(token: unknown): GuestIdentity | null {
    if (typeof token !== 'string' || token.length === 0) return null;
    try {
      const claims = this.jwt.verify<GuestTokenClaims>(token);
      const nickname = normalizeNickname(claims.nickname);
      if (typeof claims.sub !== 'string' || !nickname) return null;
      return { id: claims.sub, nickname };
    } catch {
      return null;
    }
  }
}
