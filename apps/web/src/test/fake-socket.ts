/**
 * A stand-in for the Socket.IO client: tests can play the server (fire events, choose the ack)
 * and inspect what the client sent.
 */
import type { Ack, ServerPayload, ServerToClientEvents } from '@minefall/shared';
import type { GameClient } from '../services/socket';

type Handler = (payload: unknown) => void;
/** Any acknowledgement shape: `{ ok: true }`, `{ ok: true, data }` or an error. */
type AnyAck = Ack | Ack<unknown>;

export class FakeSocket {
  readonly handlers = new Map<string, Handler[]>();
  readonly sent: { event: string; payload: unknown }[] = [];
  /** The ack the "server" returns for each client event (default: ok). */
  readonly acks = new Map<string, AnyAck>();
  connected = false;

  on(event: string, handler: Handler): this {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }

  connect(): this {
    this.connected = true;
    this.fire('connect', undefined);
    return this;
  }

  disconnect(): this {
    this.connected = false;
    return this;
  }

  removeAllListeners(): this {
    this.handlers.clear();
    return this;
  }

  timeout(): this {
    return this;
  }

  emitWithAck(event: string, payload: unknown): Promise<AnyAck> {
    this.sent.push({ event, payload });
    return Promise.resolve(this.acks.get(event) ?? { ok: true });
  }

  /** Simulates the server emitting an event. */
  serverEmit<E extends keyof ServerToClientEvents>(event: E, payload: ServerPayload<E>): void {
    this.fire(event, payload);
  }

  private fire(event: string, payload: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) handler(payload);
  }

  asClient(): GameClient {
    return this as unknown as GameClient;
  }
}
