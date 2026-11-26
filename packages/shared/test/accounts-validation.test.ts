import { describe, expect, it } from 'vitest';
import { isValidPassword, normalizeEmail } from '../src/protocol/accounts';

describe('normalizeEmail', () => {
  it('trims and lower-cases valid emails', () => {
    expect(normalizeEmail('  Ghof@Example.COM ')).toBe('ghof@example.com');
  });

  it.each(['', 'ghof', 'ghof@', '@x.com', 'a b@c.com', 'a@b', 'a@b.c', 42, null])(
    'rejects %j',
    (raw) => {
      expect(normalizeEmail(raw)).toBeNull();
    },
  );

  it('rejects absurdly long emails', () => {
    expect(normalizeEmail(`${'a'.repeat(250)}@b.com`)).toBeNull();
  });
});

describe('isValidPassword', () => {
  it('needs 8 to 128 characters, kept as typed', () => {
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword(' spaces count ')).toBe(true);
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('x'.repeat(129))).toBe(false);
    expect(isValidPassword(12345678)).toBe(false);
  });
});
