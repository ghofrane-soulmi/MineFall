/**
 * Runtime validation of untrusted client input. TypeScript types vanish at runtime, so every
 * payload is parsed here before reaching the engine. Each parser returns the clean value or null.
 */
import {
  CHAT_EMOJIS,
  CHAT_MAX_LENGTH,
  CHAT_PRESETS,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from '../constants';
import { BOT_LEVELS, type BotLevel } from '../bot/strategy';
import type { Cell } from '../types/board';
import type {
  ChatSendPayload,
  MinesPlacePayload,
  MoveDropPayload,
  RoomCreatePayload,
  RoomJoinPayload,
  RoomReadyPayload,
} from './payloads';

/** Upper bound on array sizes we are willing to read from a client. */
const MAX_CELLS_IN_PAYLOAD = 10;

/** Letters (any language), digits, spaces, '_' and '-'. No HTML can get through. */
const NICKNAME_PATTERN = /^[\p{L}\p{N} _-]+$/u;

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** Trims and collapses spaces; returns null if the nickname breaks the rules. */
export function normalizeNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const nickname = raw.trim().replace(/\s+/g, ' ');
  const length = [...nickname].length;
  if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) return null;
  return NICKNAME_PATTERN.test(nickname) ? nickname : null;
}

/** Upper-cases and checks a room code ("ab3xyz" -> "AB3XYZ"). */
export function normalizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

/** `{}` = room for two humans; `{ bot: 'easy' | 'normal' }` = play against Minebot. */
export function parseRoomCreate(payload: unknown): RoomCreatePayload | null {
  if (payload === undefined || payload === null) return {};
  if (!isRecord(payload)) return null;
  const bot = payload['bot'];
  if (bot === undefined) return {};
  return (BOT_LEVELS as readonly unknown[]).includes(bot) ? { bot: bot as BotLevel } : null;
}

export function parseRoomJoin(payload: unknown): RoomJoinPayload | null {
  if (!isRecord(payload)) return null;
  const code = normalizeRoomCode(payload['code']);
  return code ? { code } : null;
}

export function parseRoomReady(payload: unknown): RoomReadyPayload | null {
  if (!isRecord(payload) || typeof payload['ready'] !== 'boolean') return null;
  return { ready: payload['ready'] };
}

/** Checks the SHAPE only; mine rules (count, top row, duplicates) are the engine's job. */
export function parseMinesPlace(payload: unknown): MinesPlacePayload | null {
  if (!isRecord(payload)) return null;
  const cells = payload['cells'];
  if (!Array.isArray(cells) || cells.length > MAX_CELLS_IN_PAYLOAD) return null;
  const parsed: Cell[] = [];
  for (const cell of cells) {
    if (!isRecord(cell) || !isInteger(cell['col']) || !isInteger(cell['row'])) return null;
    parsed.push({ col: cell['col'], row: cell['row'] });
  }
  return { cells: parsed };
}

export function parseMoveDrop(payload: unknown): MoveDropPayload | null {
  if (!isRecord(payload)) return null;
  const { column, turnId } = payload;
  if (!isInteger(column) || !isInteger(turnId)) return null;
  return { column, turnId };
}

/**
 * Zero-width spaces and text-direction overrides (can disguise or reverse text). The zero-width
 * joiner (U+200D) is kept on purpose: emoji such as 👨‍👩‍👧 need it.
 */
const INVISIBLE_CHARACTERS = /[\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

/** Raw text longer than this is refused before any processing. */
const MAX_RAW_CHAT_LENGTH = 1_000;

/**
 * Makes free chat text safe and tidy: removes control characters, invisible characters and
 * angle brackets (no HTML can survive), collapses whitespace and trims. Returns null if nothing is left or too long.
 */
export function sanitizeChatText(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > MAX_RAW_CHAT_LENGTH) return null;
  const text = raw
    .replace(/[\p{Cc}<>]/gu, '')
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(/\s+/g, ' ')
    .trim();
  const length = [...text].length;
  return length === 0 || length > CHAT_MAX_LENGTH ? null : text;
}

export function parseChatSend(payload: unknown): ChatSendPayload | null {
  if (!isRecord(payload)) return null;
  const { type, value } = payload;
  if (type === 'preset') {
    return CHAT_PRESETS.some((p) => p.id === value) ? { type, value: value as string } : null;
  }
  if (type === 'emoji') {
    return (CHAT_EMOJIS as readonly unknown[]).includes(value)
      ? { type, value: value as string }
      : null;
  }
  if (type === 'text') {
    const text = sanitizeChatText(value);
    return text ? { type, value: text } : null;
  }
  return null;
}
