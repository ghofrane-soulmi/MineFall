/**
 * Password hashing with Node's built-in scrypt (no extra library). Stored format:
 *   scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>
 * Parameters live in the string, so they can be raised later without breaking old hashes.
 */
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_BYTES = 16;
/** Cost parameters (N = CPU/memory cost). ~50 ms per hash on a normal server. */
const DEFAULT_PARAMS = { N: 16_384, r: 8, p: 1 } as const;

function scrypt(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_LENGTH,
      { ...options, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const { N, r, p } = DEFAULT_PARAMS;
  const hash = await scrypt(password, salt, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64'), hash.toString('base64')].join('$');
}

/** Constant-time comparison; false for any malformed stored value. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}

/** A valid hash of a random password: used to spend the same time when the email is unknown. */
export const DUMMY_HASH_PROMISE = hashPassword(randomBytes(16).toString('hex'));
