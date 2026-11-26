/** Root module: wires every feature module together (like config/app.php's providers list). */
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { GameModule } from './game/game.module';
import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule, AuthModule, GameModule],
  controllers: [HealthController],
})
export class AppModule {}
