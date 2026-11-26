import { describe, expect, it } from 'vitest';
import { LoginThrottle } from './login-throttle';
import { hashPassword, verifyPassword } from './passwords';

describe('passwords (scrypt)', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(hash).not.toContain('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterY', hash)).toBe(false);
  });

  it('salts every hash: the same password never gives the same string', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });

  it('treats malformed stored values as "no match" instead of crashing', async () => {
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$whatever')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$16384$8$1$c2FsdA==$dG9vc2hvcnQ=')).toBe(false);
  });
});

describe('LoginThrottle', () => {
  it('blocks after 5 failures within a minute, then forgets them', () => {
    const throttle = new LoginThrottle(5, 60_000);
    for (let i = 0; i < 5; i++) throttle.recordFailure('a@b.co', 1_000 + i);
    expect(throttle.isBlocked('a@b.co', 2_000)).toBe(true);
    expect(throttle.isBlocked('other@b.co', 2_000)).toBe(false);
    expect(throttle.isBlocked('a@b.co', 61_005)).toBe(false);
  });

  it('a successful login resets the counter', () => {
    const throttle = new LoginThrottle(2, 60_000);
    throttle.recordFailure('a@b.co', 0);
    throttle.recordFailure('a@b.co', 1);
    throttle.reset('a@b.co');
    expect(throttle.isBlocked('a@b.co', 2)).toBe(false);
  });
});
