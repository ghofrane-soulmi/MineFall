/**
 * The typed Socket.IO client. Event names and payloads come from @minefall/shared, so a typo
 * in an event name or a wrong payload shape is a compile error, not a runtime bug.
 */
import {
  SOCKET_NAMESPACE,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@minefall/shared';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

export type GameClient = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Creates (but does not open) a socket authenticated with the guest token. */
export function createGameSocket(token: string): GameClient {
  return io(`${API_URL}${SOCKET_NAMESPACE}`, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: false,
  });
}
