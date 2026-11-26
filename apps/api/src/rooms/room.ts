/**
 * The server-side room record and the functions that turn it into PUBLIC payloads.
 * A room holds up to 2 members and, once started, the authoritative GameState.
 * Nothing here ever exposes `game.mines`: game data leaves only through `toPlayerView`.
 */
import type {
  GameState,
  PlayerId,
  RoomPhase,
  RoomPlayerInfo,
  RoomPlayersPayload,
  RoomSnapshot,
  StartingRoll,
} from '@minefall/shared';

export const MAX_ROOM_MEMBERS = 2;

export interface RoomMember {
  readonly id: PlayerId;
  readonly nickname: string;
  online: boolean;
  ready: boolean;
  wantsRematch: boolean;
}

export interface Room {
  readonly code: string;
  hostId: PlayerId;
  members: RoomMember[];
  game: GameState | null;
  startingRoll: StartingRoll | null;
  /** End of the current placement phase or turn (epoch ms). */
  phaseEndsAt: number | null;
  gameStartedAt: number | null;
  lastActivityAt: number;
  /** Disconnected players during a game -> when they forfeit (epoch ms). */
  graceEndsAt: Map<PlayerId, number>;
}

export function roomPhase(room: Room): RoomPhase {
  return room.game?.phase ?? 'lobby';
}

export function isGameRunning(room: Room): boolean {
  const phase = roomPhase(room);
  return phase === 'placement' || phase === 'playing';
}

export function findMember(room: Room, playerId: PlayerId): RoomMember | undefined {
  return room.members.find((m) => m.id === playerId);
}

export function toRoomPlayers(room: Room): RoomPlayerInfo[] {
  return room.members.map((m) => ({
    id: m.id,
    nickname: m.nickname,
    color: room.game?.players.find((p) => p.id === m.id)?.color ?? null,
    online: m.online,
    ready: m.ready,
    wantsRematch: m.wantsRematch,
  }));
}

export function toRoomPlayersPayload(room: Room): RoomPlayersPayload {
  return { hostId: room.hostId, players: toRoomPlayers(room) };
}

export function toRoomSnapshot(room: Room): RoomSnapshot {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: roomPhase(room),
    players: toRoomPlayers(room),
    phaseEndsAt: room.phaseEndsAt,
    startingRoll: room.startingRoll,
    disconnected: [...room.graceEndsAt].map(([playerId, graceEndsAt]) => ({
      playerId,
      graceEndsAt,
    })),
  };
}
