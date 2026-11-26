import { describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });
  const auth = new AuthService(jwt);

  it('creates a guest with a normalised nickname and a verifiable token', () => {
    const session = auth.createGuest('  Neo  ');
    expect(session?.player.nickname).toBe('Neo');
    expect(auth.verify(session?.token)).toEqual(session?.player);
  });

  it('gives every guest a different id', () => {
    expect(auth.createGuest('Neo')?.player.id).not.toBe(auth.createGuest('Neo')?.player.id);
  });

  it('refuses invalid nicknames', () => {
    expect(auth.createGuest('ab')).toBeNull();
    expect(auth.createGuest('<script>')).toBeNull();
    expect(auth.createGuest(undefined)).toBeNull();
  });

  it('rejects missing, garbage and forged tokens', () => {
    const forger = new AuthService(new JwtService({ secret: 'another-secret' }));
    const forged = forger.createGuest('Mallory')?.token;
    expect(auth.verify(undefined)).toBeNull();
    expect(auth.verify('')).toBeNull();
    expect(auth.verify('not.a.jwt')).toBeNull();
    expect(auth.verify(forged)).toBeNull();
  });

  it('rejects an expired token', () => {
    const expiredToken = jwt.sign({ sub: 'x', nickname: 'Old', guest: true }, { expiresIn: -10 });
    expect(auth.verify(expiredToken)).toBeNull();
  });

  it('rejects a validly signed token with a bad nickname', () => {
    expect(auth.verify(jwt.sign({ sub: 'x', nickname: '<b>', guest: true }))).toBeNull();
  });
});
