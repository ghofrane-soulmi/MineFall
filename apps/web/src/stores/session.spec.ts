import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ME } from '../test/fixtures';
import { useSessionStore } from './session';

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('session store: accounts', () => {
  it('register sends the guest token and stores the account session (same player)', async () => {
    const fetchMock = respond(201, { token: 'account-token', player: ME, email: 'ghof@x.io' });
    vi.stubGlobal('fetch', fetchMock);
    const session = useSessionStore();
    session.session = { token: 'guest-token', player: ME, email: null };

    await session.register('ghof@x.io', 'secret-pass');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/auth/register');
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer guest-token');
    expect(session.email).toBe('ghof@x.io');
    expect(session.player).toEqual(ME);
    expect(JSON.parse(localStorage.getItem('minefall.session') ?? '{}').token).toBe(
      'account-token',
    );
  });

  it('a failed login keeps the server message and changes nothing', async () => {
    vi.stubGlobal(
      'fetch',
      respond(401, { error: 'INVALID_CREDENTIALS', message: 'Wrong email or password.' }),
    );
    const session = useSessionStore();
    await expect(session.loginAccount('a@b.co', 'nope-nope')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Wrong email or password.',
    });
    expect(session.session).toBeNull();
  });

  it('reads sessions saved before accounts existed (no email field)', () => {
    localStorage.setItem('minefall.session', JSON.stringify({ token: 't', player: ME }));
    expect(useSessionStore().email).toBeNull();
  });
});

describe('api client', () => {
  it('a 200 answer that is not JSON (e.g. an HTML page from a proxy) is an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<!doctype html>', { status: 200 })),
    );
    setActivePinia(createPinia());
    await expect(useSessionStore().loginAccount('a@b.co', '12345678')).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
  });
});
