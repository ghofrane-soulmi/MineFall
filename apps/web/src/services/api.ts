/**
 * HTTP calls to the API. In development Vite proxies these paths to the API server; in
 * production the API is served from the same origin (or VITE_API_URL when set).
 */
import type { GuestSession, ProfileResponse } from '@minefall/shared';

export const API_URL: string = import.meta.env['VITE_API_URL'] ?? '';

/** An API failure with the server's stable error code (e.g. INVALID_CREDENTIALS). */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.token) headers['authorization'] = `Bearer ${init.token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the server. Is it running?');
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && body === null) {
    // e.g. a proxy answered with an HTML page instead of forwarding to the API
    throw new ApiError('BAD_RESPONSE', 'The server sent an unexpected response.');
  }
  if (!response.ok) {
    const read = (key: string): unknown =>
      body && typeof body === 'object' ? Reflect.get(body, key) : undefined;
    const code = read('error');
    const message = read('message');
    throw new ApiError(
      typeof code === 'string' ? code : 'HTTP_ERROR',
      typeof message === 'string' ? message : 'Something went wrong.',
    );
  }
  return body as T;
}

/** Old stored sessions predate accounts: they have no `email` field. */
function withEmail(session: GuestSession): GuestSession {
  return { ...session, email: session.email ?? null };
}

export async function loginAsGuest(nickname: string): Promise<GuestSession> {
  return withEmail(await call<GuestSession>('/auth/guest', { method: 'POST', body: { nickname } }));
}

/** Turns the current guest (token) into an account: same player id, same games. */
export async function registerAccount(
  token: string,
  email: string,
  password: string,
): Promise<GuestSession> {
  return withEmail(
    await call<GuestSession>('/auth/register', {
      method: 'POST',
      token,
      body: { email, password },
    }),
  );
}

export async function loginWithPassword(email: string, password: string): Promise<GuestSession> {
  return withEmail(
    await call<GuestSession>('/auth/login', { method: 'POST', body: { email, password } }),
  );
}

export function fetchProfile(token: string): Promise<ProfileResponse> {
  return call<ProfileResponse>('/me/profile', { token });
}
