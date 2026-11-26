import { describe, expect, it } from 'vitest';
import {
  normalizeNickname,
  normalizeRoomCode,
  parseChatSend,
  parseMinesPlace,
  parseMoveDrop,
  parseRoomJoin,
  parseRoomReady,
  sanitizeChatText,
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

describe('chat', () => {
  it('sanitizeChatText strips HTML brackets, control and invisible characters', () => {
    expect(sanitizeChatText('  hello   world ')).toBe('hello world');
    expect(sanitizeChatText('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    expect(sanitizeChatText('a\u0000b\u200Bc\u202Ed')).toBe('abcd');
    expect(sanitizeChatText('👨‍👩‍👧 gg')).toBe('👨‍👩‍👧 gg');
  });

  it('sanitizeChatText enforces 1-120 characters', () => {
    expect(sanitizeChatText('x'.repeat(120))).toHaveLength(120);
    expect(sanitizeChatText('x'.repeat(121))).toBeNull();
    expect(sanitizeChatText('   ')).toBeNull();
    expect(sanitizeChatText('<>')).toBeNull();
    expect(sanitizeChatText('x'.repeat(5000))).toBeNull();
    expect(sanitizeChatText(42)).toBeNull();
  });

  it('parseChatSend accepts known presets and emojis, and sanitised text', () => {
    expect(parseChatSend({ type: 'preset', value: 'gg' })).toEqual({ type: 'preset', value: 'gg' });
    expect(parseChatSend({ type: 'emoji', value: '💣' })).toEqual({ type: 'emoji', value: '💣' });
    expect(parseChatSend({ type: 'text', value: ' <b>hi</b> ' })).toEqual({
      type: 'text',
      value: 'bhi/b',
    });
  });

  it('parseChatSend refuses unknown presets, emojis and types', () => {
    expect(parseChatSend({ type: 'preset', value: 'insult' })).toBeNull();
    expect(parseChatSend({ type: 'emoji', value: '🐍' })).toBeNull();
    expect(parseChatSend({ type: 'html', value: 'x' })).toBeNull();
    expect(parseChatSend({ type: 'text', value: '' })).toBeNull();
    expect(parseChatSend('gg')).toBeNull();
  });
});
