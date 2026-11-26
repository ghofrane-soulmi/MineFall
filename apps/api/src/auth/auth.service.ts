/**
 * Player identities: a player id + nickname, signed as a JWT so the server can trust it on
 * every socket connection and HTTP request without storing sessions. Guests and accounts
 * share the same token format; an account simply keeps the id it had as a guest.
 */
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { normalizeNickname, type GuestIdentity, type GuestSession } from '@minefall/shared';

interface PlayerTokenClaims {
  readonly sub: string;
  readonly nickname: string;
  /** false once the player has an account (email + password). */
  readonly guest: boolean;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  /** Returns a new guest session, or null if the nickname breaks the rules. */
  createGuest(rawNickname: unknown): GuestSession | null {
    const nickname = normalizeNickname(rawNickname);
    if (!nickname) return null;
    return this.issue({ id: randomUUID(), nickname }, null);
  }

  /** Signs a session for a known identity (a guest, or an account when `email` is set). */
  issue(player: GuestIdentity, email: string | null): GuestSession {
    const claims: PlayerTokenClaims = { sub: player.id, nickname: player.nickname, guest: !email };
    return { token: this.jwt.sign(claims), player, email };
  }

  /** Verifies a token; returns the identity or null for a missing, forged or expired token. */
  verify(token: unknown): GuestIdentity | null {
    if (typeof token !== 'string' || token.length === 0) return null;
    try {
      const claims = this.jwt.verify<PlayerTokenClaims>(token);
      const nickname = normalizeNickname(claims.nickname);
      if (typeof claims.sub !== 'string' || !nickname) return null;
      return { id: claims.sub, nickname };
    } catch {
      return null;
    }
  }
}
