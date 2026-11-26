import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

// Local development: load apps/api/.env if present (Node built-in, no dotenv needed).
try {
  process.loadEnvFile('.env');
} catch {
  // No .env: use the real environment (Docker, CI).
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = configureApp(app);
  await app.listen(config.port);
  Logger.log(`Minefall API listening on http://localhost:${config.port}`, 'Bootstrap');
}

void bootstrap();
