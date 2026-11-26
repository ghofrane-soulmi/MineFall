/**
 * Account + profile HTTP routes. `@UseGuards(AuthGuard)` is NestJS's version of Laravel's
 * `->middleware('auth')`: the handler only runs with a valid player token.
 *   POST /auth/register  (guest token)  { email, password } -> session (same player id)
 *   POST /auth/login                    { email, password } -> session
 *   GET  /me/profile     (any token)                        -> stats + recent games
 */
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { GuestIdentity, GuestSession, ProfileResponse } from '@minefall/shared';
import { AuthGuard, CurrentPlayer } from '../auth/auth.guard';
import { AccountsService } from './accounts.service';
import { StatsService } from './stats.service';

@Controller()
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly stats: StatsService,
  ) {}

  @Post('auth/register')
  @UseGuards(AuthGuard)
  register(@CurrentPlayer() player: GuestIdentity, @Body() body: unknown): Promise<GuestSession> {
    return this.accounts.register(player, body);
  }

  @Post('auth/login')
  @HttpCode(200)
  login(@Body() body: unknown): Promise<GuestSession> {
    return this.accounts.login(body);
  }

  @Get('me/profile')
  @UseGuards(AuthGuard)
  profile(@CurrentPlayer() player: GuestIdentity): Promise<ProfileResponse> {
    return this.stats.profile(player);
  }
}
