/**
 * Runtime validation of untrusted client input. TypeScript types vanish at runtime, so every
 * payload is parsed here before reaching the engine. Each parser returns the clean value or null.
 */
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from '../constants';
import type { Cell } from '../types/board';
import type {
  MinesPlacePayload,
  MoveDropPayload,
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
