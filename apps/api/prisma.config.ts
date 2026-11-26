/**
 * Prisma 7 configuration. Reads DATABASE_URL from the environment (or from apps/api/.env if
 * present, via Node's built-in loader; no dotenv dependency).
 */
import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the real environment (CI, Docker).
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? '' },
});
