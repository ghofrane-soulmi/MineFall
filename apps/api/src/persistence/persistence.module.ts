/**
 * Chooses the GameRecorder at startup: PostgreSQL when DATABASE_URL is set, otherwise a no-op
 * (the game stays fully playable, finished games are simply not stored).
 * NestJS concept: `useFactory` is like a Laravel container binding with a closure.
 */
import { Logger, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { GameRecorder, NoopGameRecorder } from './game-recorder';
import { PrismaGameRecorder, createPrismaClient } from './prisma-game-recorder';

@Module({
  providers: [
    {
      provide: GameRecorder,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): GameRecorder => {
        if (!config.databaseUrl) {
          new Logger('Persistence').warn('DATABASE_URL not set: finished games are not saved.');
          return new NoopGameRecorder();
        }
        return new PrismaGameRecorder(createPrismaClient(config.databaseUrl));
      },
    },
  ],
  exports: [GameRecorder],
})
export class PersistenceModule {}
