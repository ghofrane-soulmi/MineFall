/**
 * Quick match (SPEC F14): a first-come, first-served queue of players waiting for an opponent.
 * When a second player arrives, both are put in a new room and the game starts at once.
 */
import { Injectable } from '@nestjs/common';
import {
  ServerEvents,
  type Ack,
  type AckErrorCode,
  type GuestIdentity,
  type PlayerId,
} from '@minefall/shared';
import { RoomsService } from '../rooms/rooms.service';
import { GameNotifier } from './game-notifier';
import { GameService } from './game.service';

const fail = (error: AckErrorCode): Ack => ({ ok: false, error });

@Injectable()
export class MatchmakingService {
  /** Waiting players, oldest first. */
  private readonly queue: GuestIdentity[] = [];

  constructor(
    private readonly game: GameService,
    private readonly rooms: RoomsService,
    private readonly notifier: GameNotifier,
  ) {}

  /** Joins the queue, or is matched immediately with the player who waited longest. */
  join(player: GuestIdentity): Ack {
    if (this.rooms.findByPlayer(player.id)) return fail('ALREADY_IN_ROOM');
    if (this.isWaiting(player.id)) return { ok: true }; // double click / second tab

    const opponent = this.queue.shift();
    if (!opponent) {
      this.queue.push(player);
      return { ok: true };
    }

    // The player who waited becomes the room host; the dice still decide who starts.
    const code = this.game.createMatchedRoom(opponent, player);
    for (const matched of [opponent, player]) {
      this.notifier.toPlayer(matched.id, ServerEvents.QueueMatched, { code });
    }
    return { ok: true };
  }

  /** Leaves the queue (Cancel button, or the player's last tab closed). Always succeeds. */
  leave(playerId: PlayerId): Ack {
    const index = this.queue.findIndex((p) => p.id === playerId);
    if (index >= 0) this.queue.splice(index, 1);
    return { ok: true };
  }

  isWaiting(playerId: PlayerId): boolean {
    return this.queue.some((p) => p.id === playerId);
  }

  get size(): number {
    return this.queue.length;
  }
}
