/** Root module: wires every feature module together (like config/app.php's providers list). */
import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { GameModule } from './game/game.module';
import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule, AuthModule, GameModule, AccountsModule],
  controllers: [HealthController],
})
export class AppModule {}
