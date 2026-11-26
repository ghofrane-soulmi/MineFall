/**
 * NestJS concept: a Guard decides whether a request may reach the controller, like Laravel's
 * `auth` middleware. This one requires `Authorization: Bearer <token>` (guest or account) and
 * attaches the verified identity to the request; `@CurrentPlayer()` reads it back.
 */
import {
  Injectable,
  UnauthorizedException,
  createParamDecorator,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { GuestIdentity } from '@minefall/shared';
import { AuthService } from './auth.service';

/** The parts of the HTTP request this guard uses (no need for the full Express types). */
interface AuthenticatedRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  player?: GuestIdentity;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers['authorization'];
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice('Bearer '.length)
        : null;
    const player = this.auth.verify(token);
    if (!player) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid token.',
      });
    }
    request.player = player;
    return true;
  }
}

/** Controller parameter decorator: the identity verified by AuthGuard. */
export const CurrentPlayer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): GuestIdentity => {
    const player = context.switchToHttp().getRequest<AuthenticatedRequest>().player;
    if (!player) throw new UnauthorizedException({ error: 'UNAUTHORIZED' });
    return player;
  },
);
