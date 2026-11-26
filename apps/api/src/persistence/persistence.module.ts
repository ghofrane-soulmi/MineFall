/**
 * Database wiring. One Prisma client for the whole app (`Database`), and the GameRecorder
 * chosen from it: PostgreSQL when DATABASE_URL is set, otherwise a no-op.
 * NestJS concept: `useFactory` is like a Laravel container binding with a closure.
 */
import { Logger, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { Database } from './database';
import { GameRecorder, NoopGameRecorder } from './game-recorder';
import { PrismaGameRecorder, createPrismaClient } from './prisma-game-recorder';

@Module({
  providers: [
    {
      provide: Database,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Database => {
        if (!config.databaseUrl) {
          new Logger('Persistence').warn(
            'DATABASE_URL not set: games are not saved, accounts and stats are disabled.',
          );
          return new Database(null);
        }
        return new Database(createPrismaClient(config.databaseUrl));
      },
    },
    {
      provide: GameRecorder,
      inject: [Database],
      useFactory: (db: Database): GameRecorder =>
        db.client ? new PrismaGameRecorder(db.client) : new NoopGameRecorder(),
    },
  ],
  exports: [Database, GameRecorder],
})
export class PersistenceModule {}
