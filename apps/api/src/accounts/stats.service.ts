/**
 * Player profile (SPEC F16): totals and the last games, computed from the saved games.
 * Works for guests too: their games are stored under their player id like any account.
 */
import { Injectable } from '@nestjs/common';
import type {
  GameHistoryEntry,
  GuestIdentity,
  PlayerStats,
  ProfileResponse,
} from '@minefall/shared';
import { Database } from '../persistence/database';
import { BOT_IDS } from '../rooms/rooms.service';
import { accountError } from './accounts.service';

const RECENT_GAMES = 20;
const BOT_ID_SET = new Set<string>(Object.values(BOT_IDS));

@Injectable()
export class StatsService {
  constructor(private readonly db: Database) {}

  async profile(player: GuestIdentity): Promise<ProfileResponse> {
    const client = this.db.client;
    if (!client) throw accountError('ACCOUNTS_DISABLED');
    const mine = { OR: [{ player1Id: player.id }, { player2Id: player.id }] };

    const [user, games, minesStepped, trapsTriggered] = await Promise.all([
      client.user.findUnique({ where: { id: player.id }, select: { email: true } }),
      client.game.findMany({
        where: mine,
        orderBy: { endedAt: 'desc' },
        select: {
          id: true,
          endedAt: true,
          result: true,
          winnerId: true,
          player1Id: true,
          player1: { select: { id: true, nickname: true } },
          player2: { select: { id: true, nickname: true } },
          _count: { select: { moves: true } },
        },
      }),
      // An explosion on MY move = I stepped on the opponent's mine.
      client.gameMove.count({ where: { playerId: player.id, outcome: 'exploded' } }),
      // An explosion on the OPPONENT's move in my games = one of my traps worked.
      client.gameMove.count({
        where: { outcome: 'exploded', playerId: { not: player.id }, game: mine },
      }),
    ]);

    const wins = games.filter((g) => g.winnerId === player.id).length;
    const draws = games.filter((g) => g.result === 'draw').length;
    const stats: PlayerStats = {
      gamesPlayed: games.length,
      wins,
      losses: games.length - wins - draws,
      draws,
      winRate: games.length === 0 ? 0 : wins / games.length,
      minesStepped,
      trapsTriggered,
    };

    const recentGames: GameHistoryEntry[] = games.slice(0, RECENT_GAMES).map((g) => {
      const opponent = g.player1Id === player.id ? g.player2 : g.player1;
      return {
        id: g.id,
        endedAt: g.endedAt.toISOString(),
        opponent: { nickname: opponent.nickname, bot: BOT_ID_SET.has(opponent.id) },
        result: g.result === 'draw' ? 'draw' : g.winnerId === player.id ? 'win' : 'loss',
        reason: g.result === 'win' ? 'line' : g.result,
        moveCount: g._count.moves,
      };
    });

    return {
      player: { id: player.id, nickname: player.nickname, email: user?.email ?? null },
      stats,
      recentGames,
    };
  }
}
