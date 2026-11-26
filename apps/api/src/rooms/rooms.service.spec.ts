import { beforeEach, describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@minefall/shared';
import { ALICE, BOB, CAROL } from '../../test/fakes';
import { generateRoomCode } from './room-code';
import { RoomsService } from './rooms.service';

describe('generateRoomCode', () => {
  it('uses only the readable alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect([...code].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
    }
  });

  it('is driven by the random source', () => {
    expect(generateRoomCode(() => 0)).toBe(ROOM_CODE_ALPHABET.charAt(0).repeat(ROOM_CODE_LENGTH));
  });
});

describe('RoomsService', () => {
  let rooms: RoomsService;
  beforeEach(() => {
    rooms = new RoomsService();
  });

  it('creates a room with the creator as host and only member', () => {
    const room = rooms.create(ALICE, 100);
    expect(room.hostId).toBe(ALICE.id);
    expect(room.members.map((m) => m.id)).toEqual([ALICE.id]);
    expect(rooms.get(room.code)).toBe(room);
    expect(rooms.findByPlayer(ALICE.id)).toBe(room);
  });

  it('retries the code on a collision', () => {
    const codes = ['AAAAAA', 'AAAAAA', 'BBBBBB'];
    rooms.generateCode = () => codes.shift() ?? 'ZZZZZZ';
    expect(rooms.create(ALICE, 0).code).toBe('AAAAAA');
    expect(rooms.create(BOB, 0).code).toBe('BBBBBB');
  });

  it('accepts a second member and refuses a third (room full)', () => {
    const room = rooms.create(ALICE, 0);
    expect(rooms.addMember(room, BOB, 5)).toBeNull();
    expect(room.lastActivityAt).toBe(5);
    expect(rooms.addMember(room, CAROL, 6)).toBe('ROOM_FULL');
    expect(rooms.findByPlayer(CAROL.id)).toBeUndefined();
  });

  it('refuses a player who is already in a room', () => {
    const room = rooms.create(ALICE, 0);
    const other = rooms.create(BOB, 0);
    expect(rooms.addMember(other, ALICE, 0)).toBe('ALREADY_IN_ROOM');
    expect(room.members).toHaveLength(1);
  });

  it('hands the host role over when the host leaves, and deletes an empty room', () => {
    const room = rooms.create(ALICE, 0);
    rooms.addMember(room, BOB, 0);
    rooms.removeMember(room, ALICE.id);
    expect(room.hostId).toBe(BOB.id);
    expect(rooms.findByPlayer(ALICE.id)).toBeUndefined();
    rooms.removeMember(room, BOB.id);
    expect(rooms.get(room.code)).toBeUndefined();
  });

  it('keeps the host when a guest leaves', () => {
    const room = rooms.create(ALICE, 0);
    rooms.addMember(room, BOB, 0);
    rooms.removeMember(room, BOB.id);
    expect(room.hostId).toBe(ALICE.id);
  });

  it('delete() forgets the room and all its members', () => {
    const room = rooms.create(ALICE, 0);
    rooms.addMember(room, BOB, 0);
    rooms.delete(room);
    expect(rooms.all()).toEqual([]);
    expect(rooms.findByPlayer(BOB.id)).toBeUndefined();
  });
});
