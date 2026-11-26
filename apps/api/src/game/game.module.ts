import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { RoomsModule } from '../rooms/rooms.module';
import { GameNotifier, SocketGameNotifier } from './game-notifier';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { MatchmakingService } from './matchmaking.service';
import { Scheduler, TimeoutScheduler } from './scheduler';

@Module({
  imports: [AuthModule, RoomsModule, PersistenceModule],
  providers: [
    GameGateway,
    GameService,
    MatchmakingService,
    SocketGameNotifier,
    // "When someone asks for GameNotifier / Scheduler, give them this implementation."
    { provide: GameNotifier, useExisting: SocketGameNotifier },
    { provide: Scheduler, useClass: TimeoutScheduler },
  ],
})
export class GameModule {}
