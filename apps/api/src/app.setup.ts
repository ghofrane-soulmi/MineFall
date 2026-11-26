/**
 * App-wide HTTP + WebSocket setup, shared by main.ts and the integration tests so tests run
 * the exact same configuration as production.
 */
import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';
import { APP_CONFIG, type AppConfig } from './config/app-config';

/** Socket.IO adapter that applies our CORS origins (decorators cannot read config). */
class ConfiguredIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly corsOrigins: readonly string[],
  ) {
    super(app);
  }

  override createIOServer(port: number | undefined, options?: ServerOptions): Server {
    // Spreading a full ServerOptions loses its exact optional typing; the shape is unchanged.
    const withCors = { ...options, cors: { origin: [...this.corsOrigins] } } as ServerOptions;
    return super.createIOServer(port, withCors);
  }
}

export function configureApp(app: INestApplication): AppConfig {
  const config = app.get<AppConfig>(APP_CONFIG);
  app.enableCors({ origin: [...config.corsOrigins] });
  app.useWebSocketAdapter(new ConfiguredIoAdapter(app, config.corsOrigins));
  app.enableShutdownHooks();
  return config;
}
