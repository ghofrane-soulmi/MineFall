import { describe, expect, it } from 'vitest';
import {
  normalizeNickname,
  normalizeRoomCode,
  parseMinesPlace,
  parseMoveDrop,
  parseRoomJoin,
  parseRoomReady,
} from '../src/protocol/validation';

describe('normalizeNickname', () => {
  it.each([
    ['Ghof', 'Ghof'],
    ['  Neo  ', 'Neo'],
    ['Ana   Maria', 'Ana Maria'],
    ['Zoé_42', 'Zoé_42'],
    ['ليلى', 'ليلى'],
    ['a'.repeat(16), 'a'.repeat(16)],
  ])('accepts %j', (raw, expected) => {
    expect(normalizeNickname(raw)).toBe(expected);
  });

  it.each([
    ['too short', 'ab'],
    ['too long', 'a'.repeat(17)],
    ['only spaces', '     '],
    ['HTML', '<b>bob</b>'],
    ['script', 'x"><script>'],
    ['not a string', 42],
    ['missing', undefined],
  ])('rejects %s', (_label, raw) => {
    expect(normalizeNickname(raw)).toBeNull();
  });
});

describe('normalizeRoomCode', () => {
  it('upper-cases and trims a valid code', () => {
    expect(normalizeRoomCode(' ab3xyz ')).toBe('AB3XYZ');
  });

  it.each(['ABC', 'ABCDEFG', 'ABCDE0', 'ABCDEI', 'ABC-EF', 123456, null])('rejects %j', (raw) => {
    expect(normalizeRoomCode(raw)).toBeNull();
  });
});

describe('payload parsers', () => {
  it('parseRoomJoin', () => {
    expect(parseRoomJoin({ code: 'ab3xyz' })).toEqual({ code: 'AB3XYZ' });
    expect(parseRoomJoin({ code: 'nope' })).toBeNull();
    expect(parseRoomJoin('AB3XYZ')).toBeNull();
    expect(parseRoomJoin(null)).toBeNull();
  });

  it('parseRoomReady', () => {
    expect(parseRoomReady({ ready: true })).toEqual({ ready: true });
    expect(parseRoomReady({ ready: 'yes' })).toBeNull();
    expect(parseRoomReady([])).toBeNull();
  });

  it('parseMinesPlace keeps only col/row and checks shape', () => {
    expect(parseMinesPlace({ cells: [{ col: 1, row: 2, owner: 'x' }] })).toEqual({
      cells: [{ col: 1, row: 2 }],
    });
    expect(parseMinesPlace({ cells: [{ col: 1.5, row: 2 }] })).toBeNull();
    expect(parseMinesPlace({ cells: [{ col: '1', row: 2 }] })).toBeNull();
    expect(parseMinesPlace({ cells: 'A1' })).toBeNull();
    expect(parseMinesPlace({ cells: Array(11).fill({ col: 1, row: 1 }) })).toBeNull();
    expect(parseMinesPlace({ cells: [null] })).toBeNull();
  });

  it('parseMoveDrop', () => {
    expect(parseMoveDrop({ column: 3, turnId: 7, extra: true })).toEqual({ column: 3, turnId: 7 });
    expect(parseMoveDrop({ column: '3', turnId: 7 })).toBeNull();
    expect(parseMoveDrop({ column: 3 })).toBeNull();
    expect(parseMoveDrop(undefined)).toBeNull();
  });
});
