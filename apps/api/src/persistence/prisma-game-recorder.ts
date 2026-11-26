/**
 * Writes a finished game with Prisma, in ONE transaction: upsert both guest users, then the
 * game with its mines and moves. Either everything is stored or nothing is.
 */
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { GameRecorder, type FinishedGameRecord } from './game-recorder';

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

@Injectable()
export class PrismaGameRecorder extends GameRecorder implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {
    super();
  }

  async record(game: FinishedGameRecord): Promise<string> {
    const [player1, player2] = game.players;
    const winnerId = game.result.type === 'draw' ? null : game.result.winnerId;

    return this.prisma.$transaction(async (tx) => {
      for (const player of game.players) {
        await tx.user.upsert({
          where: { id: player.id },
          create: { id: player.id, nickname: player.nickname, isGuest: true },
          update: { nickname: player.nickname },
        });
      }
      const created = await tx.game.create({
        data: {
          roomCode: game.roomCode,
          player1Id: player1.id,
          player2Id: player2.id,
          winnerId,
          result: game.result.type,
          startedAt: game.startedAt,
          endedAt: game.endedAt,
          mines: { createMany: { data: [...game.mines] } },
          moves: {
            createMany: {
              data: game.moves.map(({ playedAt, ...move }) => ({ ...move, createdAt: playedAt })),
            },
          },
        },
        select: { id: true },
      });
      return created.id;
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
