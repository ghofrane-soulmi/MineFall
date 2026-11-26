/**
 * The single database connection of the app. `client` is null when DATABASE_URL is not set:
 * the game still runs, while saving games, accounts and stats are simply unavailable.
 */
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class Database implements OnModuleDestroy {
  constructor(readonly client: PrismaClient | null) {}

  /** NestJS lifecycle hook: close the connection pool on shutdown. */
  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }
}
