/**
 * NestJS concept: a @Module groups providers (injectable values/classes), like a Laravel
 * service provider registering bindings. @Global makes these available everywhere without
 * re-importing the module.
 */
import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, CLOCK, RNG, loadConfig } from './app-config';

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig() },
    { provide: CLOCK, useValue: () => Date.now() },
    { provide: RNG, useValue: () => Math.random() },
  ],
  exports: [APP_CONFIG, CLOCK, RNG],
})
export class ConfigModule {}
