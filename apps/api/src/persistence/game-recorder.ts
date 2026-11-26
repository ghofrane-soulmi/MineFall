/**
 * Saving finished games. GameService depends on the abstract GameRecorder only:
 * - PrismaGameRecorder writes to PostgreSQL (when DATABASE_URL is set)
 * - NoopGameRecorder keeps the game playable without a database (tests, quick demos)
 */
import { Injectable } from '@nestjs/common';
import type {
  Cell,
  GameResult,
  GameState,
  GuestIdentity,
  MoveOutcome,
  PlayerId,
} from '@minefall/shared';

export interface FinishedGameRecord {
  readonly roomCode: string;
  /** [player 1 (red), player 2 (yellow)] */
  readonly players: readonly [GuestIdentity, GuestIdentity];
  readonly result: GameResult;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly mines: readonly (Cell & {
    readonly ownerId: PlayerId;
    readonly exploded: boolean;
    readonly explodedAtMove: number | null;
  })[];
  readonly moves: readonly {
    readonly moveNumber: number;
    readonly playerId: PlayerId;
    readonly column: number;
    readonly landedRow: number;
    readonly outcome: MoveOutcome;
    readonly timedOut: boolean;
    readonly playedAt: Date;
  }[];
}

export abstract class GameRecorder {
  /** Persists a finished game. Resolves with its id, or null if nothing was stored. */
  abstract record(game: FinishedGameRecord): Promise<string | null>;
}

@Injectable()
export class NoopGameRecorder extends GameRecorder {
  record(): Promise<null> {
    return Promise.resolve(null);
  }
}

export interface FinishedGameInput {
  readonly roomCode: string;
  readonly game: GameState;
  readonly nicknames: ReadonlyMap<PlayerId, string>;
  readonly startedAt: number;
  readonly endedAt: number;
  /** When each move was played (epoch ms), index = moveNumber - 1. */
  readonly moveTimes: readonly number[];
}

/** Turns the final in-memory state into the record we store (pure, unit-tested). */
export function toFinishedGameRecord(input: FinishedGameInput): FinishedGameRecord {
  const { game } = input;
  if (!game.result) throw new Error('toFinishedGameRecord: the game is not finished');
  const identity = (id: PlayerId): GuestIdentity => ({
    id,
    nickname: input.nicknames.get(id) ?? 'Unknown',
  });

  const remaining = game.players.flatMap(({ id }) =>
    (game.mines[id] ?? []).map((m) => ({
      ownerId: id,
      col: m.col,
      row: m.row,
      exploded: false,
      explodedAtMove: null,
    })),
  );
  const exploded = game.explodedMines.map((m) => ({
    ownerId: m.ownerId,
    col: m.col,
    row: m.row,
    exploded: true,
    explodedAtMove: m.moveNumber,
  }));

  return {
    roomCode: input.roomCode,
    players: [identity(game.players[0].id), identity(game.players[1].id)],
    result: game.result,
    startedAt: new Date(input.startedAt),
    endedAt: new Date(input.endedAt),
    mines: [...exploded, ...remaining],
    moves: game.moveHistory.map((m) => ({
      moveNumber: m.moveNumber,
      playerId: m.playerId,
      column: m.column,
      landedRow: m.landedRow,
      outcome: m.outcome,
      timedOut: m.timeout,
      playedAt: new Date(input.moveTimes[m.moveNumber - 1] ?? input.endedAt),
    })),
  };
}
