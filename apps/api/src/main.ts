import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = configureApp(app);
  await app.listen(config.port);
  Logger.log(`Minefall API listening on http://localhost:${config.port}`, 'Bootstrap');
}

void bootstrap();
