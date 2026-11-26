/**
 * NestJS concept: a @Controller maps HTTP routes to methods, like a Laravel controller plus
 * its routes/api.php entry in one place (`@Post('guest')` under `@Controller('auth')`).
 */
import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import type { GuestSession } from '@minefall/shared';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /auth/guest { nickname } -> { token, player } */
  @Post('guest')
  createGuest(@Body() body: unknown): GuestSession {
    const nickname =
      typeof body === 'object' && body !== null ? Reflect.get(body, 'nickname') : null;
    const session = this.auth.createGuest(nickname);
    if (!session) {
      throw new BadRequestException({
        error: 'INVALID_NICKNAME',
        message: 'Nickname must be 3-16 letters, digits, spaces, "_" or "-".',
      });
    }
    return session;
  }
}
