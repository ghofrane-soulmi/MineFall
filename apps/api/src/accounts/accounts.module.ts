import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { StatsService } from './stats.service';

@Module({
  imports: [AuthModule, PersistenceModule],
  controllers: [AccountsController],
  providers: [AccountsService, StatsService],
})
export class AccountsModule {}
