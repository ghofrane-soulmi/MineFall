/**
 * HTTP calls to the API. In development Vite proxies these paths to the API server; in
 * production the API is served from the same origin (or VITE_API_URL when set).
 */
import type { GuestSession } from '@minefall/shared';

export const API_URL: string = import.meta.env['VITE_API_URL'] ?? '';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function loginAsGuest(nickname: string): Promise<GuestSession> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/guest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname }),
    });
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the server. Is it running?');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body && typeof body === 'object' ? Reflect.get(body, 'error') : null;
    throw new ApiError(String(error ?? 'HTTP_ERROR'), 'Could not create your guest profile.');
  }
  return body as GuestSession;
}
