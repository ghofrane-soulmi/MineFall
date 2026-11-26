/**
 * In-memory room registry (SPEC section 2: a Map for the MVP, Redis later). Handles who is
 * in which room; it knows nothing about sockets, timers or game rules.
 */
import { Injectable } from '@nestjs/common';
import type { GuestIdentity, PlayerId, ProtocolErrorCode } from '@minefall/shared';
import { MAX_ROOM_MEMBERS, type Room, type RoomMember } from './room';
import { generateRoomCode } from './room-code';

@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, Room>();
  private readonly roomCodeByPlayer = new Map<PlayerId, string>();

  /** Room code generator; replaceable in tests to force collisions. */
  generateCode: () => string = () => generateRoomCode();

  create(host: GuestIdentity, now: number): Room {
    let code = this.generateCode();
    while (this.rooms.has(code)) code = this.generateCode();

    const room: Room = {
      code,
      hostId: host.id,
      members: [newMember(host)],
      game: null,
      startingRoll: null,
      phaseEndsAt: null,
      gameStartedAt: null,
      moveTimes: [],
      lastActivityAt: now,
      graceEndsAt: new Map(),
    };
    this.rooms.set(code, room);
    this.roomCodeByPlayer.set(host.id, code);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  findByPlayer(playerId: PlayerId): Room | undefined {
    const code = this.roomCodeByPlayer.get(playerId);
    return code === undefined ? undefined : this.rooms.get(code);
  }

  all(): Room[] {
    return [...this.rooms.values()];
  }

  addMember(room: Room, player: GuestIdentity, now: number): ProtocolErrorCode | null {
    if (this.roomCodeByPlayer.has(player.id)) return 'ALREADY_IN_ROOM';
    if (room.members.length >= MAX_ROOM_MEMBERS) return 'ROOM_FULL';
    room.members.push(newMember(player));
    room.lastActivityAt = now;
    this.roomCodeByPlayer.set(player.id, room.code);
    return null;
  }

  /** Removes a member; hands the host role over, and deletes the room once it is empty. */
  removeMember(room: Room, playerId: PlayerId): void {
    room.members = room.members.filter((m) => m.id !== playerId);
    room.graceEndsAt.delete(playerId);
    this.roomCodeByPlayer.delete(playerId);
    const [nextHost] = room.members;
    if (!nextHost) {
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostId === playerId) room.hostId = nextHost.id;
  }

  delete(room: Room): void {
    for (const member of room.members) this.roomCodeByPlayer.delete(member.id);
    this.rooms.delete(room.code);
  }
}

function newMember(player: GuestIdentity): RoomMember {
  return {
    id: player.id,
    nickname: player.nickname,
    online: true,
    ready: false,
    wantsRematch: false,
  };
}
